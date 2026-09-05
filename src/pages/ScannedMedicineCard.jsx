import React, { useEffect, useMemo, useState } from "react";
import { Box, Typography, TextField, InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import HistoryIcon from "@mui/icons-material/History";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { getDrugCategories } from "../data/getDrugCategories";

/* ============================================================
   ScannedMedicineCard — the single "what did we just scan" panel,
   used two ways:

   1) QR (camera) scans — QRLanding.jsx passes the decoded code in
      via <ScannedMedicineCard scannedCode={code} theme={...} />.
      The optional `theme` prop lets it match whichever page mounts
      it (Hail Health Cluster blue on the public scan-result page);
      it falls back to sensible defaults when mounted with no theme
      (e.g. a "Scan" page inside the main app).
   2) Linear barcode (USB scanner) scans — mount this with no
      scannedCode prop anywhere in the app (e.g. a "Scan" page).
      A barcode scanner is just a keyboard that types fast + Enter,
      so the always-focused text field below already works with it
      out of the box — no special driver/integration needed.

   Shows the official ministry name, NUPCO code, every alternate
   name other suppliers use for the same medicine (from Excel
   imports), flags High Alert / Hazardous / Look-Alike / Sound-Alike
   medicines with a loud warning, and lists the full shipment
   history recorded from Excel imports (medicineBatches collection)
   — every batch that ever arrived for this exact medicine, newest
   first, with its own quantity + expiry date(s) + date received.
   ============================================================ */

const DEFAULT_THEME = {
  headerFrom: "#0B4A7A",
  headerTo: "#0F6CBD",
  page: "#F3F6FA",
  card: "#FFFFFF",
  border: "#E3E9F0",
  text: "#0F2A43",
  muted: "#64748B",
};

function getStatus(expiry) {
  if (!expiry) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(expiry);
  expiryDate.setHours(23, 59, 59, 999);
  const nearExpiryThreshold = new Date(expiryDate);
  nearExpiryThreshold.setMonth(nearExpiryThreshold.getMonth() - 3);
  nearExpiryThreshold.setHours(0, 0, 0, 0);
  if (today > expiryDate) return "Expired";
  if (today >= nearExpiryThreshold) return "Near Expiry";
  return "Safe";
}

const STATUS_STYLE = {
  Safe: { bg: "#E7F7EE", text: "#0F7A3D", dot: "#22C55E" },
  "Near Expiry": { bg: "#FFF6E5", text: "#96650A", dot: "#F59E0B" },
  Expired: { bg: "#FDECEA", text: "#B3261E", dot: "#EF4444" },
};

const CATEGORY_STYLE = {
  "High Alert": { bg: "#E53935", text: "#fff", emoji: "⚠️" },
  Hazardous: { bg: "#8B5CF6", text: "#fff", emoji: "☣" },
  "Sound Alike": { bg: "#FFD54F", text: "#5A4300", emoji: "👂" },
  "Look Alike": { bg: "#FFD54F", text: "#5A4300", emoji: "👁️" },
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

// بطاقة إحصائية صغيرة (الكمية الحالية، عدد الشحنات...) — عنصر بصري نعيد
// استخدامه بأكثر من مكان بالواجهة بدل ما نكرر نفس الـ sx كل مرة
function StatPill({ icon, label, value, theme }) {
  return (
    <Box sx={{
      flex: 1, minWidth: 120, p: 1.5, borderRadius: "12px",
      bgcolor: theme.page, border: `1px solid ${theme.border}`,
      display: "flex", alignItems: "center", gap: 1.2,
    }}>
      <Box sx={{
        width: 34, height: 34, borderRadius: "10px", flexShrink: 0,
        bgcolor: `${theme.headerTo}1A`, color: theme.headerTo,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 11, color: theme.muted, fontWeight: 600, lineHeight: 1.3 }}>{label}</Typography>
        <Typography sx={{ fontSize: 15, color: theme.text, fontWeight: 800, lineHeight: 1.3 }}>{value}</Typography>
      </Box>
    </Box>
  );
}

export default function ScannedMedicineCard({ scannedCode, theme: themeProp }) {
  const theme = themeProp || DEFAULT_THEME;
  const [manualCode, setManualCode] = useState("");
  const [medicines, setMedicines] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const inputRef = React.useRef(null);

  // Keep the scan field focused so a USB barcode scanner can type into it
  // the instant the page loads, without the user clicking first.
  useEffect(() => {
    if (!scannedCode) inputRef.current?.focus();
  }, [scannedCode]);

  useEffect(() => {
    async function fetchMedicines() {
      try {
        const [medsSnap, batchesSnap] = await Promise.all([
          getDocs(collection(db, "medicines")),
          getDocs(collection(db, "medicineBatches")),
        ]);
        setMedicines(medsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => !m.isSection));
        setBatches(batchesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to load medicines from Firestore:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchMedicines();
  }, []);

  const codeToLookup = (scannedCode || manualCode || "").replace(/^ss:/, "").trim();

  const result = useMemo(() => {
    if (!codeToLookup || loading) return null;
    // نبحث بالكود أول (Nupco Code)، وبس لو الكود موجود فعليًا بالدواء
    // (مو فاضي) — عشان أدوية بدون كود ما تتصادم مع بعضها بالخطأ. لو ما
    // فيه تطابق بالكود، نبحث بالاسم بالضبط (هذا اللي يستخدمه الـQR أصلاً
    // كبديل لما الدواء ما عنده كود من الأساس)
    const med = medicines.find(
      (m) => (m.code && m.code !== "No Code Available" && String(m.code) === codeToLookup)
        || m.name === codeToLookup
        || (m.name && m.name.toLowerCase() === codeToLookup.toLowerCase())
    );
    if (!med) return { notFound: true, code: codeToLookup };
    const dates = med.expiryDates?.length ? med.expiryDates : [med.expiry];
    const statuses = dates.map((d) => getStatus(d));
    const categories = [...new Set(med.categories || getDrugCategories(med.name, med.code))];
    const otherNames = (med.otherNames || []).filter((n) => n && n !== med.name);
    const history = batches
      .filter((b) => b.medicineId === med.id)
      .sort((a, b) => new Date(b.importedAt) - new Date(a.importedAt));
    const lastBatch = history[0] || null;
    return { med, dates, statuses, categories, otherNames, history, lastBatch };
  }, [codeToLookup, medicines, batches, loading]);

  function goToLabel() {
    sessionStorage.setItem("labelTarget", codeToLookup);
    navigate("/labels");
  }

  const hasWarning = result?.categories?.some((c) => ["High Alert", "Hazardous", "Look Alike", "Sound Alike"].includes(c));

  return (
    <Box>
      {!scannedCode && (
        <TextField
          inputRef={inputRef}
          fullWidth
          autoFocus
          placeholder="Scan or enter NUPCO code, e.g. 5110159100100"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: theme.muted, fontSize: 20 }} /></InputAdornment>,
            sx: { borderRadius: "14px", bgcolor: theme.card, fontSize: 15 },
          }}
          sx={{ mb: 2.5 }}
        />
      )}

      {loading && (
        <Box sx={{ p: 3, textAlign: "center", color: theme.muted, fontSize: 14 }}>
          Loading medicines…
        </Box>
      )}

      {!loading && !codeToLookup && (
        <Box sx={{
          p: 4, textAlign: "center", borderRadius: "16px",
          bgcolor: theme.card, border: `1px dashed ${theme.border}`, color: theme.muted, fontSize: 14,
        }}>
          Scan or enter a code to see medicine details.
        </Box>
      )}

      {result?.notFound && (
        <Box sx={{
          p: 2.5, borderRadius: "14px", bgcolor: "#FFF6E5", border: "1px solid #FCE29B",
          color: "#96650A", fontSize: 14, display: "flex", alignItems: "flex-start", gap: 1.2,
        }}>
          <WarningAmberIcon sx={{ fontSize: 20, mt: "1px" }} />
          <span>No medicine found for code <strong>"{result.code}"</strong>.</span>
        </Box>
      )}

      {result && !result.notFound && (
        <Box sx={{
          borderRadius: "18px", overflow: "hidden",
          bgcolor: theme.card, border: `1px solid ${theme.border}`,
          boxShadow: "0 1px 3px rgba(15,42,67,0.06), 0 8px 24px rgba(15,42,67,0.05)",
        }}>
          {hasWarning && (
            <Box sx={{
              px: 2.5, py: 1.75, bgcolor: "#FDECEA", borderBottom: "1px solid #F6C6C2",
              display: "flex", alignItems: "flex-start", gap: 1.2,
            }}>
              <WarningAmberIcon sx={{ color: "#B3261E", fontSize: 22, mt: "1px", flexShrink: 0 }} />
              <Typography sx={{ color: "#7A0C0C", fontWeight: 700, fontSize: 13.5, lineHeight: 1.5 }}>
                {result.categories.includes("High Alert") && "High Alert medication — double-check the dose. "}
                {result.categories.includes("Hazardous") && "Hazardous — follow special handling/disposal precautions. "}
                {result.categories.includes("Look Alike") && "Look-Alike — confirm this is the correct medicine before dispensing. "}
                {result.categories.includes("Sound Alike") && "Sound-Alike — confirm this is the correct medicine before dispensing."}
              </Typography>
            </Box>
          )}

          <Box sx={{ p: { xs: 2.5, sm: 3 } }}>
            <Typography sx={{ fontSize: { xs: 21, sm: 23 }, fontWeight: 800, color: theme.text, lineHeight: 1.25 }}>
              {result.med.name}
            </Typography>
            <Typography sx={{ fontSize: 11, color: theme.muted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", mt: 0.3, mb: 1.75 }}>
              Official Ministry Name
            </Typography>

            <Box sx={{ display: "flex", gap: 1.25, flexWrap: "wrap", mb: 2 }}>
              <StatPill theme={theme} icon={<LocalOfferIcon sx={{ fontSize: 18 }} />} label="NUPCO Code" value={result.med.code || "—"} />
              <StatPill theme={theme} icon={<Inventory2Icon sx={{ fontSize: 18 }} />} label="Current Quantity" value={result.med.quantity ?? "—"} />
            </Box>

            {result.categories.length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2 }}>
                {result.categories.map((cat, i) => {
                  const style = CATEGORY_STYLE[cat] || { bg: "#E5E7EB", text: "#374151", emoji: "" };
                  return (
                    <Box key={i} sx={{
                      display: "inline-flex", alignItems: "center", gap: 0.5,
                      bgcolor: style.bg, color: style.text, fontWeight: 800, fontSize: 12,
                      borderRadius: "999px", px: 1.4, py: 0.5,
                    }}>
                      <span>{style.emoji}</span>{cat}
                    </Box>
                  );
                })}
              </Box>
            )}

            {result.otherNames.length > 0 && (
              <Box sx={{ mb: 2, p: 1.75, bgcolor: theme.page, borderRadius: "12px", border: `1px solid ${theme.border}` }}>
                <Typography sx={{ fontSize: 11, color: theme.muted, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", display: "block", mb: 0.75 }}>
                  Also known as (other supplier names)
                </Typography>
                {result.otherNames.map((n, i) => (
                  <Typography key={i} sx={{ fontSize: 13.5, color: theme.text, lineHeight: 1.7 }}>• {n}</Typography>
                ))}
              </Box>
            )}

            <Typography sx={{ fontSize: 11, color: theme.muted, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", display: "block", mb: 1 }}>
              Expiry
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mb: 2.5 }}>
              {result.dates.map((d, i) => {
                const days = daysUntil(d);
                const st = STATUS_STYLE[result.statuses[i]] || STATUS_STYLE.Safe;
                return (
                  <Box key={i} sx={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1,
                    p: 1.25, borderRadius: "10px", bgcolor: theme.page, border: `1px solid ${theme.border}`,
                  }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <CalendarMonthIcon sx={{ fontSize: 17, color: theme.muted }} />
                      <Typography sx={{ fontSize: 13.5, color: theme.text, fontWeight: 600 }}>{d || "—"}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {d && days !== null && (
                        <Typography sx={{ fontSize: 11.5, color: theme.muted }}>
                          {days >= 0 ? `${days}d left` : `${Math.abs(days)}d overdue`}
                        </Typography>
                      )}
                      {d && (
                        <Box sx={{
                          display: "inline-flex", alignItems: "center", gap: 0.5,
                          bgcolor: st.bg, color: st.text, fontWeight: 800, fontSize: 11,
                          borderRadius: "999px", px: 1.1, py: 0.35,
                        }}>
                          <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: st.dot }} />
                          {result.statuses[i]}
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>

            <Box component="button" onClick={goToLabel} sx={{
              width: "100%", border: "none", cursor: "pointer",
              borderRadius: "14px", py: 1.5,
              background: `linear-gradient(135deg, ${theme.headerFrom}, ${theme.headerTo})`,
              color: "#fff", fontWeight: 700, fontSize: 14.5,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 1,
              boxShadow: `0 6px 16px ${theme.headerTo}40`,
              fontFamily: "inherit",
            }}>
              <LocalOfferIcon sx={{ fontSize: 19 }} />
              Generate Label for this medicine
            </Box>
          </Box>

          {result.history.length > 0 && (
            <Box sx={{ px: { xs: 2.5, sm: 3 }, pb: { xs: 2.5, sm: 3 }, pt: 0.5, borderTop: `1px solid ${theme.border}`, mt: 0.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 2, mb: 1.5 }}>
                <HistoryIcon sx={{ fontSize: 17, color: theme.muted }} />
                <Typography sx={{ fontSize: 11, color: theme.muted, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>
                  Shipment History · {result.history.length} {result.history.length === 1 ? "batch" : "batches"}
                </Typography>
              </Box>

              {result.lastBatch && (
                <Typography sx={{ fontSize: 12.5, color: theme.muted, mb: 1.5 }}>
                  Last received: <strong style={{ color: theme.text }}>{formatDate(result.lastBatch.importedAt)}</strong>
                  {" · "}Qty <strong style={{ color: theme.text }}>{result.lastBatch.quantity}</strong>
                </Typography>
              )}

              <Box sx={{ position: "relative", pl: 2.5 }}>
                <Box sx={{ position: "absolute", left: 5, top: 6, bottom: 6, width: "2px", bgcolor: theme.border }} />
                {result.history.map((h, i) => (
                  <Box key={h.id} sx={{ position: "relative", pb: i === result.history.length - 1 ? 0 : 1.5 }}>
                    <Box sx={{
                      position: "absolute", left: -20.5, top: 4,
                      width: 11, height: 11, borderRadius: "50%",
                      bgcolor: i === 0 ? theme.headerTo : "#fff",
                      border: `2px solid ${i === 0 ? theme.headerTo : theme.border}`,
                    }} />
                    <Box sx={{
                      p: 1.25, borderRadius: "10px", bgcolor: theme.page, border: `1px solid ${theme.border}`,
                    }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 800, color: theme.text }}>
                          Qty: {h.quantity}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: theme.muted }}>
                          {formatDate(h.importedAt)}
                        </Typography>
                      </Box>
                      {h.expiryDates?.filter(Boolean).length > 0 && (
                        <Typography sx={{ fontSize: 11.5, color: theme.muted, mt: 0.25 }}>
                          Expiry: {h.expiryDates.filter(Boolean).join(", ")}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}