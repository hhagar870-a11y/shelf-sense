import React, { useEffect, useMemo, useState } from "react";
import { Paper, Box, Typography, Chip, Button, TextField, Alert } from "@mui/material";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { getDrugCategories } from "../data/getDrugCategories";

/* ============================================================
   ScannedMedicineCard — the single "what did we just scan" panel,
   used two ways:

   1) QR (camera) scans — QRLanding.jsx passes the decoded code in
      via <ScannedMedicineCard scannedCode={code} />.
   2) Linear barcode (USB scanner) scans — mount this with no
      scannedCode prop anywhere in the app (e.g. a "Scan" page).
      A barcode scanner is just a keyboard that types fast + Enter,
      so the always-focused text field below already works with it
      out of the box — no special driver/integration needed.

   Shows the official ministry name, NUPCO code, every alternate
   name other suppliers use for the same medicine (from Excel
   imports), and flags High Alert / Hazardous / Look-Alike /
   Sound-Alike medicines with a loud warning.
   ============================================================ */

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

const STATUS_CHIP = { Safe: "success", "Near Expiry": "warning", Expired: "error" };
const CATEGORY_STYLE = {
  "High Alert": { bg: "#E53935", text: "#fff", emoji: "⚠️ " },
  Hazardous: { bg: "#8B5CF6", text: "#fff", emoji: "" },
  "Sound Alike": { bg: "#FFD54F", text: "#000", emoji: "👂 " },
  "Look Alike": { bg: "#FFD54F", text: "#000", emoji: "👁️ " },
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

export default function ScannedMedicineCard({ scannedCode }) {
  const [manualCode, setManualCode] = useState("");
  const [medicines, setMedicines] = useState([]);
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
        const snap = await getDocs(collection(db, "medicines"));
        setMedicines(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => !m.isSection));
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
      (m) => (m.code && String(m.code) === codeToLookup) || m.name === codeToLookup
    );
    if (!med) return { notFound: true, code: codeToLookup };
    const dates = med.expiryDates?.length ? med.expiryDates : [med.expiry];
    const statuses = dates.map((d) => getStatus(d));
    const categories = [...new Set(med.categories || getDrugCategories(med.name, med.code))];
    const otherNames = (med.otherNames || []).filter((n) => n && n !== med.name);
    return { med, dates, statuses, categories, otherNames };
  }, [codeToLookup, medicines, loading]);

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
          size="small"
          fullWidth
          autoFocus
          label="Scan or enter code"
          placeholder="e.g. 5110159100100"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          sx={{ mb: 2 }}
        />
      )}

      {loading && <Typography variant="body2" sx={{ color: "#9ca3af" }}>Loading medicines…</Typography>}

      {!loading && !codeToLookup && (
        <Typography variant="body2" sx={{ color: "#9ca3af" }}>Scan or enter a code to see medicine details.</Typography>
      )}

      {result?.notFound && (
        <Alert severity="warning">No medicine found for code "{result.code}".</Alert>
      )}

      {result && !result.notFound && (
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid #e5e7eb" }}>
          {hasWarning && (
            <Alert icon={<WarningAmberIcon />} severity="error" sx={{ mb: 2, fontWeight: 700 }}>
              {result.categories.includes("High Alert") && "High Alert medication — double-check the dose. "}
              {result.categories.includes("Hazardous") && "Hazardous — follow special handling/disposal precautions. "}
              {result.categories.includes("Look Alike") && "Look-Alike — confirm this is the correct medicine before dispensing. "}
              {result.categories.includes("Sound Alike") && "Sound-Alike — confirm this is the correct medicine before dispensing."}
            </Alert>
          )}

          <Typography variant="h6" sx={{ fontWeight: 700 }}>{result.med.name}</Typography>
          <Typography variant="caption" sx={{ color: "#9ca3af", display: "block", mb: 0.5 }}>Official Ministry Name</Typography>
          <Typography variant="body2" sx={{ color: "#6b7280", fontFamily: "monospace", mb: 1.5 }}>
            NUPCO: {result.med.code} · Qty: {result.med.quantity ?? "—"}
          </Typography>

          {result.otherNames.length > 0 && (
            <Box sx={{ mb: 1.5, p: 1.5, bgcolor: "#F8FAFC", borderRadius: 2, border: "1px solid #e5e7eb" }}>
              <Typography variant="caption" sx={{ color: "#6b7280", fontWeight: 700, display: "block", mb: 0.5 }}>
                Also known as (other supplier names):
              </Typography>
              {result.otherNames.map((n, i) => (
                <Typography key={i} variant="body2" sx={{ color: "#334155" }}>• {n}</Typography>
              ))}
            </Box>
          )}

          {result.categories.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1.5 }}>
              {result.categories.map((cat, i) => {
                const style = CATEGORY_STYLE[cat] || { bg: "#ccc", text: "#fff", emoji: "" };
                return <Chip key={i} size="small" label={`${style.emoji}${cat}`} sx={{ bgcolor: style.bg, color: style.text, fontWeight: 700 }} />;
              })}
            </Box>
          )}

          <Box sx={{ mb: 2 }}>
            {result.dates.map((d, i) => {
              const days = daysUntil(d);
              return (
                <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <Typography variant="body2">{d || "—"}</Typography>
                  {d && <Chip size="small" label={result.statuses[i]} color={STATUS_CHIP[result.statuses[i]]} />}
                  {d && days !== null && (
                    <Typography variant="caption" sx={{ color: "#9ca3af" }}>
                      {days >= 0 ? `${days} days left` : `${Math.abs(days)} days overdue`}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>

          <Button variant="contained" startIcon={<LocalOfferIcon />} onClick={goToLabel}
            sx={{ textTransform: "none", fontWeight: 600, borderRadius: "8px" }}>
            Generate Label for this medicine
          </Button>
        </Paper>
      )}
    </Box>
  );
}