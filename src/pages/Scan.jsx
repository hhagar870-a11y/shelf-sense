import React, { useEffect, useMemo, useState } from "react";
import {
  Container, Box, Typography, TextField, InputAdornment, ToggleButton, ToggleButtonGroup,
  IconButton, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import EditNoteIcon from "@mui/icons-material/EditNote";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import LinkIcon from "@mui/icons-material/Link";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import ScannedMedicineCard from "./ScannedMedicineCard";

/* ============================================================
   Scan page — two modes, one toggle up top:

   - "Scan"              → the existing scan/lookup panel
                            (ScannedMedicineCard with no scannedCode,
                            so it shows the manual "scan or type a
                            code" field for a USB scanner or manual entry).
   - "Manage QR Content"  → a searchable table of every medicine,
                            split into "Has saved content" (a message
                            and/or links already attached — from here
                            or from the Label Editor's Content tab)
                            and "No content yet", each row editable
                            in place via a small dialog.

   Both the Label Editor and this page write to the same Firestore
   qrMessages/{id} documents, keyed the same way (by NUPCO code when
   the medicine has a real one, otherwise by its Firestore id) — so
   editing here or from the Label Editor always touches the exact
   same saved message/links.
   ============================================================ */

function qrIdFor(med) {
  const hasRealCode = med.code && med.code !== "No Code Available";
  return hasRealCode ? `msg_code_${String(med.code).replace(/\//g, "_")}` : `msg_${med.id}`;
}

// تحويل بسيط بين النص العادي (اللي تكتبينه بصندوق التعديل) وHTML البسيط
// اللي يتخزن ويتعرض بصفحة QRLanding — كفاية لرسالة نصية سطرين ثلاثة،
// بدون ما نحتاج محرر نص غني كامل بهالصفحة الإدارية
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
  const [qrContent, setQrContent] = useState({}); // { [qrId]: { html, links } }
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

export default function Scan() {
  const [mode, setMode] = useState("scan");

  return (
    <Container maxWidth="sm" sx={{ mt: 4, mb: 6 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, textAlign: "center", mb: 0.5 }}>
        💊 Scan Medicine
      </Typography>
      <Typography variant="body2" sx={{ color: "#6b7280", textAlign: "center", mb: 3 }}>
        Scan a barcode/QR, or manage the message and links attached to each medicine's code
      </Typography>

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

      {mode === "scan" ? <ScannedMedicineCard /> : <ManageQrContent />}
    </Container>
  );
}