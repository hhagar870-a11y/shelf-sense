import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Container, Typography, Button, Chip, Box, Paper, ToggleButton, ToggleButtonGroup,
  TextField, InputAdornment, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import SearchIcon from "@mui/icons-material/Search";
import EditNoteIcon from "@mui/icons-material/EditNote";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import LinkIcon from "@mui/icons-material/Link";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";

import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import ScannedMedicineCard from "./ScannedMedicineCard";

/* ============================================================
   SmartScan — the real "Scan" page (routed at /scan in App.jsx).

   Two modes, one toggle up top:
   - "Scan"              → live camera (or uploaded image) barcode/QR
                            reading via zxing, then the decoded code
                            is looked up for real against Firestore
                            through ScannedMedicineCard (same panel
                            QRLanding.jsx uses for printed-label QR
                            scans) — full medicine info, warnings,
                            shipment history, Add-to-Mawsool, all of it.
   - "Manage QR Content"  → a searchable list of every medicine, split
                            into "Has saved content" and "No content
                            yet", each editable in place. Writes to
                            the same qrMessages/{id} documents the
                            Label Editor's Content tab uses.

   NOTE: this used to look medicines up in localStorage, which never
   matched anything real. It's wired to live Firestore data now via
   ScannedMedicineCard, the same lookup every printed label's QR uses.

   NOTE: Sidebar is NOT rendered here — App.jsx's route already wraps
   this page in <Sidebar />, so rendering it again here would show it
   twice.
   ============================================================ */

const BRAND = "#1985cd";

function extractCode(decodedText) {
  const text = (decodedText || "").trim();
  if (!text) return "";
  // لو المسحوح كان فعليًا رابط ليبل مطبوع (زي /scan-result?code=...)
  // بدل رقم خام، نطلع رقم الكود منه بدل ما نبحث عن الرابط نفسه كأنه كود
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const codeParam = url.searchParams.get("code");
      if (codeParam) return codeParam;
    } catch {
      // مو رابط صحيح فعليًا — نكمل ونعامله كنص عادي تحت
    }
  }
  return text;
}

function qrIdFor(med) {
  const hasRealCode = med.code && med.code !== "No Code Available";
  return hasRealCode ? `msg_code_${String(med.code).replace(/\//g, "_")}` : `msg_${med.id}`;
}
function htmlToPlainText(html) {
  if (!html) return "";
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
}
function plainTextToHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}

function EditQrContentDialog({ open, onClose, medicine, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [links, setLinks] = useState([]);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !medicine) return;
    setLoading(true);
    (async () => {
      try {
        const snap = await getDoc(doc(db, "qrMessages", qrIdFor(medicine)));
        if (snap.exists()) {
          setMessage(htmlToPlainText(snap.data().html || ""));
          setLinks(Array.isArray(snap.data().links) ? snap.data().links : []);
        } else {
          setMessage("");
          setLinks([]);
        }
      } catch (err) {
        console.error("Failed to load QR content:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, medicine]);

  function addLink() {
    const url = newLinkUrl.trim();
    if (!url) return;
    setLinks([...links, { label: newLinkLabel.trim() || url, url }]);
    setNewLinkLabel("");
    setNewLinkUrl("");
  }
  function removeLink(i) {
    setLinks(links.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!medicine) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "qrMessages", qrIdFor(medicine)), {
        html: plainTextToHtml(message),
        links,
        updatedAt: Date.now(),
      }, { merge: true });
      onSaved?.();
      onClose();
    } catch (err) {
      console.error("Failed to save QR content:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>
        {medicine?.name}
        <Typography variant="caption" sx={{ display: "block", color: "#6b7280", fontWeight: 400, mt: 0.25 }}>
          NUPCO: {medicine?.code || "—"}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Typography variant="body2" sx={{ color: "#9ca3af" }}>Loading…</Typography>
        ) : (
          <>
            <Typography variant="caption" sx={{ color: "#6b7280", fontWeight: 700, display: "block", mb: 0.75 }}>
              Message (shown when this medicine's label is scanned)
            </Typography>
            <TextField
              fullWidth multiline minRows={3} maxRows={6}
              placeholder="e.g. Store below 25°C. Check with pharmacist before dispensing to pediatric patients."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              sx={{ mb: 2.5 }}
            />

            <Typography variant="caption" sx={{ color: "#6b7280", fontWeight: 700, display: "block", mb: 0.75 }}>
              Attached links
            </Typography>
            {links.map((link, i) => (
              <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <Box sx={{ flex: 1, fontSize: 13, p: 1, border: "1px solid #e5e7eb", borderRadius: 1, bgcolor: "#F8FAFC", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <strong>{link.label}</strong> — {link.url}
                </Box>
                <IconButton size="small" onClick={() => removeLink(i)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
              <TextField size="small" placeholder="Label (e.g. Dosage sheet)" value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)} sx={{ flex: 1 }} />
              <TextField size="small" placeholder="https://..." value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)} sx={{ flex: 1.4 }} />
              <Button size="small" variant="outlined" onClick={addLink} sx={{ textTransform: "none", whiteSpace: "nowrap" }}>
                + Add
              </Button>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading || saving} sx={{ textTransform: "none", fontWeight: 600 }}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function MedicineRow({ medicine, content, onEdit }) {
  const preview = content ? htmlToPlainText(content.html) : "";
  const linkCount = content?.links?.length || 0;
  return (
    <Box sx={{
      display: "flex", alignItems: "center", gap: 1.5, p: 1.5,
      borderRadius: 2, border: "1px solid #e5e7eb", bgcolor: "#fff", mb: 1,
    }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {medicine.name}
        </Typography>
        <Typography variant="caption" sx={{ color: "#9ca3af", fontFamily: "monospace" }}>
          {medicine.code || "No code"}
        </Typography>
        {preview && (
          <Typography variant="caption" sx={{ display: "block", color: "#6b7280", mt: 0.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {preview}
          </Typography>
        )}
      </Box>
      {linkCount > 0 && (
        <Chip size="small" icon={<LinkIcon sx={{ fontSize: 14 }} />} label={linkCount} sx={{ fontWeight: 700 }} />
      )}
      <IconButton size="small" onClick={() => onEdit(medicine)} sx={{ bgcolor: "#F3F6FA" }}>
        {content ? <EditIcon fontSize="small" /> : <AddIcon fontSize="small" />}
      </IconButton>
    </Box>
  );
}

function ManageQrContent() {
  const [medicines, setMedicines] = useState([]);
  const [qrContent, setQrContent] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [medsSnap, qrSnap] = await Promise.all([
        getDocs(collection(db, "medicines")),
        getDocs(collection(db, "qrMessages")),
      ]);
      setMedicines(medsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => !m.isSection));
      const map = {};
      qrSnap.docs.forEach((d) => { map[d.id] = d.data(); });
      setQrContent(map);
    } catch (err) {
      console.error("Failed to load QR content list:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return medicines;
    return medicines.filter((m) =>
      (m.name && m.name.toLowerCase().includes(q)) || (m.code && String(m.code).toLowerCase().includes(q))
    );
  }, [medicines, search]);

  const withContent = [];
  const withoutContent = [];
  filtered.forEach((m) => {
    const content = qrContent[qrIdFor(m)];
    const hasContent = content && (htmlToPlainText(content.html || "").length > 0 || (content.links || []).length > 0);
    (hasContent ? withContent : withoutContent).push({ medicine: m, content: hasContent ? content : null });
  });

  return (
    <Box>
      <TextField
        fullWidth size="small" placeholder="Search by medicine name or NUPCO code…"
        value={search} onChange={(e) => setSearch(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 19, color: "#9ca3af" }} /></InputAdornment> }}
        sx={{ mb: 3 }}
      />

      {loading && <Typography variant="body2" sx={{ color: "#9ca3af" }}>Loading…</Typography>}

      {!loading && (
        <>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 0.75, mb: 1.25 }}>
            <ChatBubbleOutlineIcon sx={{ fontSize: 18, color: "#2563EB" }} />
            Has saved content ({withContent.length})
          </Typography>
          {withContent.length === 0 ? (
            <Typography variant="body2" sx={{ color: "#9ca3af", mb: 3 }}>Nothing here yet.</Typography>
          ) : (
            <Box sx={{ mb: 3 }}>
              {withContent.map(({ medicine, content }) => (
                <MedicineRow key={medicine.id} medicine={medicine} content={content} onEdit={setEditing} />
              ))}
            </Box>
          )}

          <Typography variant="subtitle2" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 0.75, mb: 1.25 }}>
            <EditNoteIcon sx={{ fontSize: 18, color: "#9ca3af" }} />
            No content yet ({withoutContent.length})
          </Typography>
          {withoutContent.length === 0 ? (
            <Typography variant="body2" sx={{ color: "#9ca3af" }}>Every medicine already has something saved 🎉</Typography>
          ) : (
            <Box>
              {withoutContent.map(({ medicine }) => (
                <MedicineRow key={medicine.id} medicine={medicine} content={null} onEdit={setEditing} />
              ))}
            </Box>
          )}
        </>
      )}

      <EditQrContentDialog
        open={!!editing}
        medicine={editing}
        onClose={() => setEditing(null)}
        onSaved={loadAll}
      />
    </Box>
  );
}

function LiveScanner() {
  const videoRef = useRef(null);
  const [detectedCode, setDetectedCode] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.EAN_13,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.QR_CODE,
    ]);

    const codeReader = new BrowserMultiFormatReader(hints);
    let cancelled = false;
    codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
      if (result && !cancelled) {
        setDetectedCode(extractCode(result.getText()));
      }
    });

    return () => {
      cancelled = true;
      if (codeReader.stopContinuousDecode) codeReader.stopContinuousDecode();
    };
  }, []);

  async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const image = new Image();
    image.src = URL.createObjectURL(file);

    image.onload = async () => {
      try {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128,
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.QR_CODE,
        ]);
        const reader = new BrowserMultiFormatReader(hints);
        const result = await reader.decodeFromImageElement(image);
        setDetectedCode(extractCode(result.getText()));
      } catch (err) {
        alert("No barcode detected in the image");
      }
    };
  }

  return (
    <Box>
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: "#ffffff", border: "1px solid #e2e8f0" }}>
        <Box sx={{
          position: "relative", width: "100%", maxWidth: "560px", height: "260px", mx: "auto",
          borderRadius: 3, overflow: "hidden", bgcolor: "#0f172a", border: `2px solid ${BRAND}`,
        }}>
          <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </Box>

        <Box sx={{ mt: 2.5, display: "flex", justifyContent: "space-between", alignItems: "center", px: 1 }}>
          <Typography variant="body2" color="text.secondary" fontWeight="500">
            Detection Status
          </Typography>
          <Chip
            label={detectedCode ? `Detected: ${detectedCode}` : "Awaiting scan input…"}
            size="small"
            sx={{
              fontWeight: 600,
              bgcolor: detectedCode ? "#ecfdf5" : "#f1f5f9",
              color: detectedCode ? "#047857" : "#475569",
              border: `1px solid ${detectedCode ? "#a7f3d0" : "#e2e8f0"}`,
            }}
          />
        </Box>
      </Paper>

      <Box sx={{ mt: 2.5, display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
        <Button
          variant="contained"
          startIcon={<ReplayOutlinedIcon />}
          fullWidth
          sx={{ py: 1.5, borderRadius: 2.5, textTransform: "none", fontWeight: 600, bgcolor: BRAND, boxShadow: "none", "&:hover": { bgcolor: "#146cbe", boxShadow: "none" } }}
          onClick={() => setDetectedCode("")}
        >
          Reset Scanner
        </Button>

        <Button
          variant="outlined"
          component="label"
          startIcon={<UploadFileOutlinedIcon />}
          fullWidth
          sx={{ py: 1.5, borderRadius: 2.5, textTransform: "none", fontWeight: 600, borderColor: "#cbd5e1", color: BRAND, bgcolor: "#ffffff", "&:hover": { borderColor: BRAND, bgcolor: "#f8fafc" } }}
        >
          Upload Barcode Image
          <input hidden accept="image/*" type="file" onChange={handleImageUpload} />
        </Button>
      </Box>

      {detectedCode && (
        <Paper elevation={0} sx={{ mt: 3, p: 3, borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#ffffff" }}>
          <ScannedMedicineCard scannedCode={detectedCode} />
        </Paper>
      )}
    </Box>
  );
}

export default function SmartScan() {
  const [mode, setMode] = useState("scan");
  const navigate = useNavigate();

  return (
    <Container maxWidth="md" sx={{ mt: 5, mb: 5 }}>
      <Paper elevation={0} sx={{
        p: 3, mb: 3, borderRadius: 3, bgcolor: "#ffffff", border: "1px solid #e2e8f0",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2,
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
          <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "#eaf5ff", color: BRAND, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <QrCodeScannerIcon sx={{ fontSize: 30 }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight="700" sx={{ color: BRAND }}>
              Scan Medicine
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Barcode / QR lookup — or manage each medicine's scan-result message and links
            </Typography>
          </Box>
        </Box>

        <Button
          variant="outlined"
          startIcon={<SupportAgentIcon />}
          onClick={() => navigate("/support")}
          sx={{ borderColor: BRAND, color: BRAND, borderRadius: 2.5, textTransform: "none", fontWeight: 600, px: 2.5, py: 1, "&:hover": { borderColor: "#146cbe", bgcolor: "#f0f7ff" } }}
        >
          Contact & Support
        </Button>
      </Paper>

      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={(e, v) => v && setMode(v)}
        fullWidth
        sx={{ mb: 3 }}
      >
        <ToggleButton value="scan" sx={{ textTransform: "none", fontWeight: 600, gap: 0.75 }}>
          <QrCodeScannerIcon sx={{ fontSize: 19 }} /> Scan
        </ToggleButton>
        <ToggleButton value="manage" sx={{ textTransform: "none", fontWeight: 600, gap: 0.75 }}>
          <EditNoteIcon sx={{ fontSize: 19 }} /> Manage QR Content
        </ToggleButton>
      </ToggleButtonGroup>

      {mode === "scan" ? <LiveScanner /> : <ManageQrContent />}
    </Container>
  );
}