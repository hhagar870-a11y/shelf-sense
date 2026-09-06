import React, { useEffect, useState } from "react";
import { Container, Box, Typography, Link as MuiLink } from "@mui/material";
import { useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ScannedMedicineCard from "./ScannedMedicineCard";

/* ============================================================
   QRLanding — this is what a printed label's QR code opens.
   Add a route for it in App.jsx:

     import QRLanding from "./pages/QRLanding";
     ...
     <Route path="/scan-result" element={<QRLanding />} />

   No Sidebar on purpose — someone scanning a label with their
   phone should land straight on the medicine info, no app chrome.

   Plain white page, logo only (no page title text), no colored
   header band, no nested boxes — per direct feedback.

   If the label's QR had a custom message and/or links attached
   (written in the Label Editor's Content tab, or from the "Manage
   QR Content" screen), they're stored in Firestore under
   qrMessages/{msg} as { html, links } and shown here.
   ============================================================ */

// الرسالة تتخزن كـHTML بسيط (فقرات + <br>)، فلازم نشيل الوسوم قبل ما
// نتأكد إذا فيه محتوى فعلي، وإلا "<br>" لحاله يعتبر (خطأ) محتوى موجود
// ويطلع صندوق فاضي بدل عبارة "لا يوجد ملاحظات"
function hasVisibleText(html) {
  return !!html && html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
}

export default function QRLanding() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code") || "";
  const msgId = searchParams.get("msg") || "";
  const [messageHtml, setMessageHtml] = useState("");
  const [links, setLinks] = useState([]);

  useEffect(() => {
    if (!msgId) return;
    async function fetchMessage() {
      try {
        const snap = await getDoc(doc(db, "qrMessages", msgId));
        if (snap.exists()) {
          setMessageHtml(snap.data().html || "");
          setLinks(Array.isArray(snap.data().links) ? snap.data().links : []);
        }
      } catch (err) {
        console.error("Failed to load QR message:", err);
      }
    }
    fetchMessage();
  }, [msgId]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#fff" }}>
      <Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 2.5 }}>
          <Box component="img" src="/logo.png" alt="Hail Health Cluster" sx={{ width: 190, height: "auto" }} />
        </Box>

        {msgId && (
          <Box sx={{ mb: 3, pb: 2.5, borderBottom: "1px solid #E7EAEE" }}>
            <Typography variant="caption" sx={{ color: "#9ca3af", fontWeight: 700, display: "block", mb: 0.5 }}>
              Message
            </Typography>
            {hasVisibleText(messageHtml) ? (
              <Box sx={{ fontSize: 14, color: "#0F2A43" }} dangerouslySetInnerHTML={{ __html: messageHtml }} />
            ) : (
              <Typography sx={{ fontSize: 14, color: "#9ca3af" }}>
                لا يوجد أي ملاحظات أو تعليقات
              </Typography>
            )}

            {links.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="caption" sx={{ color: "#9ca3af", fontWeight: 700, display: "block", mb: 0.75 }}>
                  Links
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {links.map((link, i) => (
                    <MuiLink key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                      sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: 14, fontWeight: 600, color: "#1D4ED8" }}>
                      <OpenInNewIcon sx={{ fontSize: 15 }} />
                      {link.label || link.url}
                    </MuiLink>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}

        <ScannedMedicineCard scannedCode={code} />
      </Container>
    </Box>
  );
}