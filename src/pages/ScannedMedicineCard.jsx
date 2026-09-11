import React, { useEffect, useMemo, useState } from "react";
import { Box, Typography, TextField, InputAdornment, Divider } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import HistoryIcon from "@mui/icons-material/History";
import ConstructionIcon from "@mui/icons-material/Construction";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, doc, updateDoc, addDoc } from "firebase/firestore";
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

   Plain white, flat layout on purpose — no nested colored boxes,
   just typography + thin dividers, per direct feedback. Category
   badges (High Alert etc.) and the expiry-status pill stay colored
   since those are safety signals, not decoration.

   Shows the official ministry name, NUPCO code, every alternate
   name other suppliers use for the same medicine (from Excel
   imports), flags High Alert / Hazardous / Look-Alike / Sound-Alike
   medicines with a loud warning, and lists the full shipment
   history recorded from Excel imports (medicineBatches collection)
   — every batch that ever arrived for this exact medicine, newest
   first. Falls back to medicines_trash if the medicine was deleted,
   so the code keeps working (with a "no longer in inventory" note)
   instead of going dead.
   ============================================================ */

const ACCENT = "#0F6CBD";
const TEXT = "#0F2A43";
const MUTED = "#64748B";
const BORDER = "#E7EAEE";

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

// صف إحصائية بسيط (كود نيبكو، الكمية...) — سطر واحد ممتد بعرض الكارت
// كامل، بدون أي صندوق/خلفية حوله، عشان الرقم الطويل ما ينكسر ولا يطلع
// بشكل غريب زي لما كان جوه صندوق نص العرض
function StatRow({ icon, label, value }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1.1 }}>
      {icon}
      <Typography sx={{ fontSize: 12.5, color: MUTED, fontWeight: 600, flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: 14.5, color: TEXT, fontWeight: 800, ml: "auto", textAlign: "right" }}>{value}</Typography>
    </Box>
  );
}

export default function ScannedMedicineCard({ scannedCode }) {
  const [manualCode, setManualCode] = useState("");
  const [medicines, setMedicines] = useState([]);
  const [trashMedicines, setTrashMedicines] = useState([]);
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
        const [medsSnap, trashSnap, batchesSnap] = await Promise.all([
          getDocs(collection(db, "medicines")),
          getDocs(collection(db, "medicines_trash")),
          getDocs(collection(db, "medicineBatches")),
        ]);
        setMedicines(medsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => !m.isSection));
        setTrashMedicines(trashSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => !m.isSection));
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
    const matcher = (m) =>
      (m.code && m.code !== "No Code Available" && String(m.code) === codeToLookup)
        || m.name === codeToLookup
        || (m.name && m.name.toLowerCase() === codeToLookup.toLowerCase());
    // نبحث بالكود أول (Nupco Code)، وبس لو الكود موجود فعليًا بالدواء
    // (مو فاضي) — عشان أدوية بدون كود ما تتصادم مع بعضها بالخطأ. لو ما
    // فيه تطابق بالكود، نبحث بالاسم بالضبط (هذا اللي يستخدمه الـQR أصلاً
    // كبديل لما الدواء ما عنده كود من الأساس)
    let med = medicines.find(matcher);
    let deleted = false;
    if (!med) {
      // مو موجود بالمخزون الحي — نجرّب سلة المهملات قبل ما نستسلم، عشان
      // الباركود يفضل يعرض المعلومة (مع تنبيه إنه محذوف) بدل صفحة فاضية
      med = trashMedicines.find(matcher);
      deleted = !!med;
    }
    if (!med) return { notFound: true, code: codeToLookup };
    const dates = med.expiryDates?.length ? med.expiryDates : [med.expiry];
    const statuses = dates.map((d) => getStatus(d));
    const categories = [...new Set(med.categories || getDrugCategories(med.name, med.code))];
    const otherNames = (med.otherNames || []).filter((n) => n && n !== med.name);
    const hasRealCode = med.code && med.code !== "No Code Available";
    // نربط الهيستوري بكود الدواء نفسه (مو بمعرّف Firestore الداخلي) لما
    // يكون عنده كود حقيقي — الكود ثابت دائمًا، بعكس المعرّف اللي يتغيّر
    // كل مرة الدواء ينحذف وينضاف من جديد (بعد استيراد إكسل مثلاً). بهالطريقة
    // الهيستوري يستمر ويكتمل حتى لو الدواء اتحذف ورجع أكثر من مرة
    const history = batches
      .filter((b) => (hasRealCode && b.code === med.code) || b.medicineId === med.id)
      .sort((a, b) => new Date(b.importedAt) - new Date(a.importedAt));
    const lastBatch = history[0] || null;
    // لو الدواء موجود بالمخزون الحي، الفلاق يجي منه مباشرة. لو محذوف
    // (بسلة المهملات)، ما فيه مستند حي نتأكد منه، فندور بقائمة الأدوية
    // الحية عن أي مستند "طلب خارجي" اتضاف قبل بنفس الكود عشان ما نكرر
    // نفس الطلب بموصول مرتين
    const alreadyInMawsool = !deleted
      ? !!med.mawsoolOrder
      : medicines.some((m) => hasRealCode && m.code === med.code && m.mawsoolOrder);
    return { med, dates, statuses, categories, otherNames, history, lastBatch, deleted, hasRealCode, alreadyInMawsool };
  }, [codeToLookup, medicines, trashMedicines, batches, loading]);

  const [addingToMawsool, setAddingToMawsool] = useState(false);
  const [justAddedToMawsool, setJustAddedToMawsool] = useState(false);
  useEffect(() => { setJustAddedToMawsool(false); }, [codeToLookup]);

  async function handleAddToMawsool() {
    if (!result || result.notFound || result.alreadyInMawsool || justAddedToMawsool || addingToMawsool) return;
    setAddingToMawsool(true);
    try {
      if (!result.deleted) {
        // دواء حي بالمخزون — نفس الفلاق اللي يستخدمه تشييك بوكس الإضافة
        // لموصول بصفحة Inventory، بس مع علامة إضافية توضح إنه انضاف من
        // شاشة المسح المباشر (مو من التشييك بوكس العادي)
        await updateDoc(doc(db, "medicines", result.med.id), {
          mawsoolOrder: true,
          mawsoolSource: "liveScan",
        });
      } else {
        // دواء محذوف (بسلة المهملات) — ما نرجّعه للمخزون الحي، بس نضيف
        // طلب موصول خفيف له بنفس طريقة "Add Medicine Not in Inventory"
        // اللي تستخدمها صفحة موصول نفسها
        await addDoc(collection(db, "medicines"), {
          name: result.med.name,
          code: result.med.code || "",
          orderQty: "",
          orderNote: "",
          isSection: false,
          mawsoolOrder: true,
          isExternal: true,
          isVerified: true,
          mawsoolSource: "liveScan",
        });
      }
      setJustAddedToMawsool(true);
    } catch (err) {
      console.error("Failed to add to Mawsool:", err);
    } finally {
      setAddingToMawsool(false);
    }
  }

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
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: MUTED, fontSize: 20 }} /></InputAdornment>,
          }}
          sx={{ mb: 3 }}
        />
      )}

      {loading && (
        <Typography sx={{ color: MUTED, fontSize: 14 }}>Loading medicines…</Typography>
      )}

      {!loading && !codeToLookup && (
        <Typography sx={{ color: MUTED, fontSize: 14 }}>
          Scan or enter a code to see medicine details.
        </Typography>
      )}

      {result?.notFound && (
        <Box sx={{
          display: "flex", alignItems: "flex-start", gap: 1, color: "#96650A", fontSize: 14,
          bgcolor: "#FFF6E5", border: "1px solid #F5DFA6", borderRadius: "10px", px: 1.5, py: 1.25,
        }}>
          <WarningAmberIcon sx={{ fontSize: 20, mt: "1px", flexShrink: 0 }} />
          <Box>
            <Typography component="span" sx={{ fontSize: 14, fontWeight: 700, display: "block" }}>
              No medicine found for code "{result.code}".
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: "#96650A", mt: 0.5, lineHeight: 1.5 }}>
              This isn't a system error — this code was either never added, or was permanently removed from inventory (including the trash bin). If it should still exist, please contact the pharmacy supervisor to add it back.
            </Typography>
          </Box>
        </Box>
      )}

      {result && !result.notFound && (
        <Box>
          {result.deleted && (
            <Box sx={{
              display: "flex", alignItems: "flex-start", gap: 1, mb: 2.5,
              bgcolor: "#FDECEA", border: "1px solid #F6C6C2", borderRadius: "10px",
              px: 1.5, py: 1.25,
            }}>
              <WarningAmberIcon sx={{ color: "#B3261E", fontSize: 19, mt: "1px", flexShrink: 0 }} />
              <Typography sx={{ color: "#B3261E", fontWeight: 700, fontSize: 13, lineHeight: 1.5 }}>
                This medicine has been removed from inventory. The details below are its last known information.
              </Typography>
            </Box>
          )}

          {hasWarning && (
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 2 }}>
              <WarningAmberIcon sx={{ color: "#B3261E", fontSize: 20, mt: "1px", flexShrink: 0 }} />
              <Typography sx={{ color: "#7A0C0C", fontWeight: 700, fontSize: 13.5, lineHeight: 1.5 }}>
                {result.categories.includes("High Alert") && "High Alert medication — double-check the dose. "}
                {result.categories.includes("Hazardous") && "Hazardous — follow special handling/disposal precautions. "}
                {result.categories.includes("Look Alike") && "Look-Alike — confirm this is the correct medicine before dispensing. "}
                {result.categories.includes("Sound Alike") && "Sound-Alike — confirm this is the correct medicine before dispensing."}
              </Typography>
            </Box>
          )}

          <Typography sx={{ fontSize: 22, fontWeight: 800, color: TEXT, lineHeight: 1.25 }}>
            {result.med.name}
          </Typography>
          <Typography sx={{ fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", mt: 0.3 }}>
            Official Ministry Name
          </Typography>

          <Divider sx={{ mt: 1.5 }} />
          <StatRow icon={<LocalOfferIcon sx={{ fontSize: 17, color: ACCENT }} />} label="NUPCO Code" value={result.med.code || "—"} />
          <Divider />
          <StatRow icon={<Inventory2Icon sx={{ fontSize: 17, color: ACCENT }} />} label="Current Quantity" value={result.med.quantity ?? "—"} />
          <Divider sx={{ mb: 2 }} />

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
            <Box sx={{ mb: 2.5 }}>
              <Typography sx={{ fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", mb: 0.5 }}>
                Also known as (other supplier names)
              </Typography>
              {result.otherNames.map((n, i) => (
                <Typography key={i} sx={{ fontSize: 13.5, color: TEXT, lineHeight: 1.7 }}>• {n}</Typography>
              ))}
            </Box>
          )}

          {/* قيد التطوير — نبذة مختصرة عن الدواء (دواعي الاستعمال، ملاحظات
              عامة...) تُدخَل لاحقًا من نفس مكان الرسالة/الروابط */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5, color: "#B08900" }}>
            <ConstructionIcon sx={{ fontSize: 16 }} />
            <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
              About this medicine — coming soon
            </Typography>
          </Box>

          <Typography sx={{ fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", mb: 0.75 }}>
            Expiry
          </Typography>
          {result.dates.map((d, i) => {
            const days = daysUntil(d);
            const st = STATUS_STYLE[result.statuses[i]] || STATUS_STYLE.Safe;
            return (
              <React.Fragment key={i}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, py: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CalendarMonthIcon sx={{ fontSize: 16, color: MUTED }} />
                    <Typography sx={{ fontSize: 13.5, color: TEXT, fontWeight: 600 }}>{d || "—"}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {d && days !== null && (
                      <Typography sx={{ fontSize: 11.5, color: MUTED }}>
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
                <Divider />
              </React.Fragment>
            );
          })}

          <Box component="button" onClick={goToLabel} sx={{
            width: "100%", border: "none", cursor: "pointer",
            borderRadius: "10px", py: 1.5, mt: 3,
            bgcolor: ACCENT, color: "#fff", fontWeight: 700, fontSize: 14.5,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 1,
            fontFamily: "inherit",
          }}>
            <LocalOfferIcon sx={{ fontSize: 19 }} />
            Generate Label for this medicine
          </Box>

          <Box component="button"
            onClick={handleAddToMawsool}
            disabled={result.alreadyInMawsool || justAddedToMawsool || addingToMawsool}
            sx={{
              width: "100%", cursor: (result.alreadyInMawsool || justAddedToMawsool) ? "default" : "pointer",
              borderRadius: "10px", py: 1.5, mt: 1.25,
              bgcolor: (result.alreadyInMawsool || justAddedToMawsool) ? "#EFF6FF" : "#fff",
              color: (result.alreadyInMawsool || justAddedToMawsool) ? "#1D4ED8" : ACCENT,
              border: `1.5px solid ${(result.alreadyInMawsool || justAddedToMawsool) ? "#93C5FD" : ACCENT}`,
              fontWeight: 700, fontSize: 14.5,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 1,
              fontFamily: "inherit", opacity: addingToMawsool ? 0.6 : 1,
            }}>
            <QrCodeScannerIcon sx={{ fontSize: 18 }} />
            {result.alreadyInMawsool || justAddedToMawsool
              ? "Already in Mawsool order ✓"
              : addingToMawsool ? "Adding…" : "Add to Mawsool order"}
          </Box>

          {result.history.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1.5 }}>
                <HistoryIcon sx={{ fontSize: 16, color: MUTED }} />
                <Typography sx={{ fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>
                  Shipment History · {result.history.length} {result.history.length === 1 ? "batch" : "batches"}
                </Typography>
              </Box>

              {result.lastBatch && (
                <Typography sx={{ fontSize: 12.5, color: MUTED, mb: 1.5 }}>
                  Last received: <strong style={{ color: TEXT }}>{formatDate(result.lastBatch.importedAt)}</strong>
                  {" · "}Qty <strong style={{ color: TEXT }}>{result.lastBatch.quantity}</strong>
                </Typography>
              )}

              <Box sx={{ position: "relative", pl: 2.5 }}>
                <Box sx={{ position: "absolute", left: 5, top: 6, bottom: 6, width: "2px", bgcolor: BORDER }} />
                {result.history.map((h, i) => (
                  <Box key={h.id} sx={{ position: "relative", pb: i === result.history.length - 1 ? 0 : 1.5 }}>
                    <Box sx={{
                      position: "absolute", left: -20.5, top: 4,
                      width: 11, height: 11, borderRadius: "50%",
                      bgcolor: i === 0 ? ACCENT : "#fff",
                      border: `2px solid ${i === 0 ? ACCENT : BORDER}`,
                    }} />
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: TEXT }}>
                        Qty: {h.quantity}
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: MUTED }}>
                        {formatDate(h.importedAt)}
                      </Typography>
                    </Box>
                    {h.expiryDates?.filter(Boolean).length > 0 && (
                      <Typography sx={{ fontSize: 11.5, color: MUTED, mt: 0.25 }}>
                        Expiry: {h.expiryDates.filter(Boolean).join(", ")}
                      </Typography>
                    )}
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