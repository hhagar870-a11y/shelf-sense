import React, { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import ScannedMedicineCard from "./ScannedMedicineCard";

/* ============================================================
   QRLanding — this is what a printed label's QR code opens.
   Add a route for it in App.jsx:

     import QRLanding from "./pages/QRLanding";
     ...
     <Route path="/scan-result" element={<QRLanding />} />

   No Sidebar on purpose — someone scanning a label with their
   phone should land straight on the medicine info, no app chrome.

   Theme matches Hail Health Cluster's own public sites (deep blue
   header band, the cluster's flower mark, clean white cards on a
   soft gray page) so the page reads as an official hospital tool
   rather than a generic app screen — this is what gets shown to
   someone who just scanned a label, sometimes on their own phone.

   If the label's QR had a custom message attached (written in the
   Label Editor's Content tab), it's stored in Firestore under
   qrMessages/{msg} and shown here above the medicine card.
   ============================================================ */

// نفس ألوان هوية "تجمع حائل الصحي" (الأزرق الغامق للشريط العلوي، خلفية
// رمادية فاتحة جدًا للصفحة، بطاقات بيضاء بحواف مدورة) — بدل الشكل العام
// اللي كان يشبه أي صفحة تطبيق عادية
const THEME = {
  headerFrom: "#0B4A7A",
  headerTo: "#0F6CBD",
  page: "#F3F6FA",
  card: "#FFFFFF",
  border: "#E3E9F0",
  text: "#0F2A43",
  muted: "#64748B",
};

export default function QRLanding() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code") || "";
  const msgId = searchParams.get("msg") || "";
  const [messageHtml, setMessageHtml] = useState("");

  useEffect(() => {
    if (!msgId) return;
    async function fetchMessage() {
      try {
        const snap = await getDoc(doc(db, "qrMessages", msgId));
        if (snap.exists()) setMessageHtml(snap.data().html || "");
      } catch (err) {
        console.error("Failed to load QR message:", err);
      }
    }
    fetchMessage();
  }, [msgId]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: THEME.page }}>
      {/* الشريط العلوي — نفس تدرج اللون اللي تستخدمه مواقع التجمع الصحي
          العامة، عشان الصفحة توحي إنها أداة رسمية من المستشفى مو تطبيق عام */}
      <Box sx={{
        background: `linear-gradient(135deg, ${THEME.headerFrom}, ${THEME.headerTo})`,
        px: { xs: 2.5, sm: 4 }, py: { xs: 3, sm: 3.5 },
        display: "flex", alignItems: "center", gap: 2,
        boxShadow: "0 4px 14px rgba(15,74,122,0.25)",
      }}>
        <Box component="img" src="/logo.png" alt="Hail Health Cluster"
          sx={{ width: { xs: 44, sm: 56 }, height: { xs: 44, sm: 56 }, objectFit: "contain", bgcolor: "#fff", borderRadius: "12px", p: 0.75 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: { xs: 20, sm: 24 }, lineHeight: 1.15 }}>
            Shelf Sense
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.85)", fontSize: { xs: 12.5, sm: 13.5 } }}>
            Hail Health Cluster · Scanned label details
          </Typography>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 560, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 3.5 } }}>
        {messageHtml && (
          <Box sx={{
            p: 2, mb: 2.5, borderRadius: "14px",
            bgcolor: "#FFFBEB", border: "1px solid #FDE68A",
          }}>
            <Typography variant="caption" sx={{ color: "#92730B", fontWeight: 800, letterSpacing: 0.3, display: "block", mb: 0.5, textTransform: "uppercase" }}>
              Message
            </Typography>
            <Box sx={{ fontSize: 14, color: "#4B3B0A" }} dangerouslySetInnerHTML={{ __html: messageHtml }} />
          </Box>
        )}

        <ScannedMedicineCard scannedCode={code} theme={THEME} />

        <Typography sx={{ textAlign: "center", color: THEME.muted, fontSize: 11.5, mt: 3, pb: 2 }}>
          تجمع حائل الصحي · Hail Health Cluster — Shelf Sense Inventory System
        </Typography>
      </Box>
    </Box>
  );
}