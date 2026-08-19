import React from "react";
import { Container, Paper, Box, Typography, Button, Divider, Link } from "@mui/material";
import { Mail, MessageCircle, ExternalLink, GraduationCap, Code2, Sparkles, FolderDown, FileText } from "lucide-react";

export default function Support() {
  const handleEmailClick = () => {
    window.location.href = "mailto:hajarralhmaidi@gmail.com";
  };

  const handleWhatsappClick = () => {
    window.open("https://wa.me/966553994025", "_blank");
  };

  return (
    <Container maxWidth="md" sx={{ mt: 6, mb: 6 }}>
      {/* Top Header Section */}
      <Box sx={{ mb: 4, display: "flex", alignItems: "center", gap: 2.5 }}>
        <Box 
          sx={{ 
            p: 2, 
            bgcolor: "#0284c7", 
            color: "#ffffff", 
            borderRadius: 3.5, 
            display: "flex",
            boxShadow: "0 10px 15px -3px rgba(2, 132, 199, 0.25)"
          }}
        >
          <Sparkles size={30} />
        </Box>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>
            Support & Documentation
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 500, mt: 0.5 }}>
            Technical support, system guidance, and system resources.
          </Typography>
        </Box>
      </Box>

      {/* Main Grid Layout */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.2fr 1.3fr" }, gap: 3, mb: 4 }}>
        
        {/* Left Card: Developer & Technical Support */}
        <Paper 
          elevation={0} 
          sx={{ 
            p: 4, 
            borderRadius: 4, 
            bgcolor: "#ffffff",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between"
          }}
        >
          <Box>
            {/* Small Badge */}
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, px: 2, py: 0.6, bgcolor: "#f0f9ff", color: "#0369a1", borderRadius: 2, mb: 2.5, fontSize: "12px", fontWeight: 700, border: "1px solid #bae6fd" }}>
              <Code2 size={14} color="#0284c7" /> System Development & Technical Support
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a", mb: 1 }}>
              Hajar Alhmaidi Alanzi
            </Typography>
            
            {/* Academic Information */}
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, color: "#475569", mb: 2.5 }}>
              <GraduationCap size={20} color="#0284c7" style={{ marginTop: 2, flexShrink: 0 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.5 }}>
                Pharm-D Student — University of Hail
              </Typography>
            </Box>

            {/* Simple & Professional Description */}
            <Typography variant="body2" sx={{ color: "#64748b", mb: 3.5, lineHeight: 1.6 }}>
              For system feedback, technical issues, improvement requests, or future updates.
            </Typography>
          </Box>

          {/* Contact Information Buttons */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Button 
              variant="contained" 
              startIcon={<Mail size={18} />} 
              onClick={handleEmailClick}
              sx={{ 
                bgcolor: "#0284c7", 
                color: "#ffffff",
                textTransform: "none", 
                borderRadius: 2.5, 
                py: 1.2,
                fontWeight: 600,
                boxShadow: "none",
                justifyContent: "flex-start",
                px: 3,
                "&:hover": { bgcolor: "#0369a1", boxShadow: "none" }
              }}
            >
              hajarralhmaidi@gmail.com
            </Button>

            <Button 
              variant="outlined" 
              startIcon={<MessageCircle size={18} color="#16a34a" />} 
              onClick={handleWhatsappClick}
              sx={{ 
                borderColor: "#cbd5e1", 
                color: "#334155", 
                textTransform: "none", 
                borderRadius: 2.5, 
                py: 1.2,
                fontWeight: 600,
                justifyContent: "flex-start",
                px: 3,
                "&:hover": { borderColor: "#0284c7", bgcolor: "#f8fafc" }
              }}
            >
              Contact via WhatsApp
            </Button>
          </Box>
        </Paper>

        {/* Right Card: System Resources */}
        <Paper 
          elevation={0} 
          sx={{ 
            p: 4, 
            borderRadius: 4, 
            bgcolor: "#ffffff",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between"
          }}
        >
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
              <FolderDown size={22} color="#0284c7" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#0f172a" }}>
                System Resources
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: "#64748b", mb: 3, lineHeight: 1.6 }}>
              Access the documents and references related to the system.
            </Typography>

            {/* Resource Cards Stack */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              
              {/* Resource 1: System Presentation */}
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2, 
                  borderRadius: 3, 
                  bgcolor: "#f8fafc", 
                  border: "1px solid #e2e8f0",
                  transition: "all 0.2s ease",
                  "&:hover": { borderColor: "#0284c7", bgcolor: "#f0f9ff" }
                }}
              >
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                  <FileText size={18} color="#0284c7" style={{ marginTop: 2 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#0f172a", mb: 0.5 }}>
                      System Presentation
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#64748b", display: "block", lineHeight: 1.4 }}>
                      System overview, features, and workflow.
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Resource 2: Medication Classification Reference */}
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2, 
                  borderRadius: 3, 
                  bgcolor: "#f8fafc", 
                  border: "1px solid #e2e8f0",
                  transition: "all 0.2s ease",
                  "&:hover": { borderColor: "#0284c7", bgcolor: "#f0f9ff" }
                }}
              >
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                  <FileText size={18} color="#0284c7" style={{ marginTop: 2 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#0f172a", mb: 0.5 }}>
                      Medication Classification Reference
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#64748b", display: "block", lineHeight: 1.4 }}>
                      Reference used for medication classification within the system.
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Resource 3: Medication Database & Codes */}
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2, 
                  borderRadius: 3, 
                  bgcolor: "#f8fafc", 
                  border: "1px solid #e2e8f0",
                  transition: "all 0.2s ease",
                  "&:hover": { borderColor: "#0284c7", bgcolor: "#f0f9ff" }
                }}
              >
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                  <FileText size={18} color="#0284c7" style={{ marginTop: 2 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#0f172a", mb: 0.5 }}>
                      Medication Database & Codes
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#64748b", display: "block", lineHeight: 1.4 }}>
                      Medication list and corresponding system codes.
                    </Typography>
                  </Box>
                </Box>
              </Paper>

            </Box>
          </Box>
        </Paper>

      </Box>

      {/* Subtle Footer */}
      <Divider sx={{ my: 3, borderColor: "#e2e8f0" }} />
      <Box sx={{ textAlign: "center", color: "#64748b" }}>
        <Typography variant="caption" sx={{ display: "block", fontWeight: 500 }}>
          System Development & Technical Support · Hajar Alhmaidi Alanzi
        </Typography>
        <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>
          University of Hail ·{" "}
          <Link 
            href="https://www.linkedin.com/in/هاجر-العنزي-hajar-alanzi-88b757305" 
            target="_blank" 
            rel="noopener noreferrer"
            sx={{ color: "#0284c7", textDecoration: "none", fontWeight: 600, "&:hover": { textDecoration: "underline" } }}
          >
            LinkedIn ↗
          </Link>
        </Typography>
      </Box>
    </Container>
  );
}