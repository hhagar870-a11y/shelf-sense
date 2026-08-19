import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";

import {
  Container, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, TextField, Box, IconButton, Tooltip, Chip, TablePagination, Link
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import LocalPharmacyIcon from "@mui/icons-material/LocalPharmacy";
import { useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";

const MEDICINES_COLLECTION = "medicines";

function MawsoolOrders() {
  const navigate = useNavigate();
  const [orderedMeds, setOrderedMeds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // نجيب طلبات موصول من نفس مجموعة "medicines" بفايرستور (مو localStorage
  // -- صفحة Inventory صارت تكتب على فايرستور بس، فلازم نقرأ من نفس المصدر)
  useEffect(() => {
    (async () => {
      try {
        const snapshot = await getDocs(collection(db, MEDICINES_COLLECTION));
        const allMeds = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        const mawsoolFiltered = allMeds.filter(m => !m.isSection && m.mawsoolOrder);
        const initialized = mawsoolFiltered.map(m => ({
          ...m,
          orderQty: m.orderQty !== undefined ? m.orderQty : "",
          orderNote: m.orderNote || ""
        }));
        setOrderedMeds(initialized);
      } catch (err) {
        console.error("فشل تحميل طلبات موصول من فايرستور:", err);
      }
    })();
  }, []);

  // يحدّث حقل واحد (orderQty أو orderNote أو mawsoolOrder) بمستند الدواء
  // نفسه بفايرستور، مع تحديث الحالة محليًا فورًا عشان الواجهة تستجيب بسرعة
  const updateMedicineFields = async (id, fields) => {
    setOrderedMeds((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...fields } : m))
    );

    try {
      await updateDoc(doc(db, MEDICINES_COLLECTION, id), fields);
    } catch (err) {
      console.error("فشل تحديث الدواء بفايرستور:", err);
    }
  };

  const handleQtyChange = (id, val) => {
    updateMedicineFields(id, { orderQty: val });
  };

  const handleNoteChange = (id, val) => {
    updateMedicineFields(id, { orderNote: val });
  };

  const handleRemoveFromMawsool = (id) => {
    setOrderedMeds((prev) => prev.filter((m) => m.id !== id));
    updateMedicineFields(id, { mawsoolOrder: false, orderQty: "", orderNote: "" });
  };

  const handleCopyCode = (codeText, id) => {
    navigator.clipboard.writeText(codeText);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 1500);
  };

  const handleExportOrderExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Mawsool Orders");

    worksheet.columns = [
      { header: "Medicine Name", key: "name", width: 35 },
      { header: "Nupco Code", key: "code", width: 20 },
      { header: "Requested Quantity", key: "orderQty", width: 18 },
      { header: "Notes", key: "orderNote", width: 30 },
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2563EB" } };

    orderedMeds.forEach(med => {
      const finalQty = med.orderQty !== "" && med.orderQty !== null ? med.orderQty : (med.quantity || 1);
      worksheet.addRow({
        name: med.name,
        code: med.code || "-",
        orderQty: finalQty,
        orderNote: med.orderNote || "-"
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Mawsool_Order_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const filteredOrders = orderedMeds.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (m.code && m.code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const paginatedOrders = filteredOrders.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      
      {/* تم إضافة الـ Sidebar هنا لتظهر الدائرة والشرطات الثلاث في صفحة موصول */}
      <Sidebar />
      
      {/* البنر العلوي */}
      <Box 
        sx={{ 
          position: "relative", mb: 4, borderRadius: 4, overflow: "hidden", 
          bgcolor: "#f1f5f9", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.08)", border: "1px solid #e2e8f0"
        }}
      >
        <Box 
          component="img" 
src="/موصول.jpg"
          alt="Mawsool Banner" 
          sx={{ width: "100%", height: { xs: "220px", sm: "320px", md: "420px" }, objectFit: "contain", display: "block", mx: "auto" }} 
        />
        
        <Box sx={{ position: "absolute", top: 20, left: 20, display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton 
            onClick={() => navigate("/inventory")} 
            sx={{ bgcolor: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)", color: "#1f2937", "&:hover": { bgcolor: "#fff" }, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
          >
            <ArrowBackRoundedIcon />
          </IconButton>
          <Chip 
            label={`${orderedMeds.length} Items Selected`} 
            sx={{ bgcolor: "rgba(37, 99, 235, 0.9)", backdropFilter: "blur(4px)", color: "#fff", fontWeight: "bold", height: 40, fontSize: "0.95rem", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }} 
          />
        </Box>

        <Box sx={{ position: "absolute", bottom: 20, right: 20 }}>
          <Button 
            variant="contained" 
            color="success" 
            startIcon={<DownloadIcon />}
            onClick={handleExportOrderExcel} 
            sx={{ borderRadius: "12px", textTransform: "none", px: 3.5, py: 1.2, fontWeight: 600, bgcolor: "#10b981", "&:hover": { bgcolor: "#059669" }, boxShadow: "0 4px 12px rgba(16, 185, 129, 0.4)" }}
          >
            Export All Orders Excel ({orderedMeds.length})
          </Button>
        </Box>
      </Box>

      {/* شريط البحث */}
      <Paper 
        elevation={0} 
        sx={{ p: 2, mb: 3, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #e5e7eb", bgcolor: "#fff" }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%" }}>
          <SearchIcon sx={{ color: "primary.main", fontSize: 24 }} />
          <TextField
            fullWidth
            variant="standard"
            placeholder="Search in mawsool orders by medicine name or Nupco code..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            InputProps={{ disableUnderline: true, sx: { fontSize: "0.95rem", fontWeight: 500 } }}
          />
        </Box>
        {searchQuery && (
          <Button size="small" onClick={() => setSearchQuery("")} sx={{ textTransform: "none", color: "text.secondary" }}>
            Clear
          </Button>
        )}
      </Paper>

      {/* الجدول */}
      <TableContainer component={Paper} sx={{ width: "100%", borderRadius: 3, border: "1px solid #e5e7eb", boxShadow: "none" }}>
        <Table sx={{ minWidth: 900 }}>
          <TableHead sx={{ bgcolor: "#f8fafc" }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Medicine Name</TableCell>
              <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Nupco Code</TableCell>
              <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Request Quantity</TableCell>
              <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Optional Notes</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, color: "#475569" }}>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6, color: "text.secondary" }}>
                  <LocalPharmacyIcon sx={{ fontSize: 48, color: "#cbd5e1", mb: 1 }} />
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>No medications found in Mawsool list.</Typography>
                  <Typography variant="caption">Go back to Inventory and check items to include them here.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedOrders.map((med) => (
                <TableRow key={med.id} sx={{ "&:hover": { bgcolor: "#f8fafc" } }}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: "#1f2937" }}>
                      {med.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {med.code ? (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 600, color: "#4b5563" }}>
                          {med.code}
                        </Typography>
                        <Tooltip title={copiedId === med.id ? "Copied!" : "Copy Code"}>
                          <IconButton 
                            size="small" 
                            onClick={() => handleCopyCode(med.code, med.id)} 
                            sx={{ bgcolor: copiedId === med.id ? "#dcfce7" : "#f3f4f6", p: 0.5, transition: "0.2s" }}
                          >
                            {copiedId === med.id ? (
                              <CheckIcon sx={{ fontSize: 14, color: "#16a34a" }} />
                            ) : (
                              <ContentCopyIcon sx={{ fontSize: 13, color: "#374151" }} />
                            )}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ) : (
                      <Typography variant="caption" color="textSecondary">-</Typography>
                    )}
                  </TableCell>

                  <TableCell sx={{ width: "160px" }}>
                    <TextField
                      size="small"
                      type="number"
                      value={med.orderQty}
                      placeholder={med.quantity ? String(med.quantity) : "1"}
                      onChange={(e) => handleQtyChange(med.id, e.target.value === "" ? "" : Number(e.target.value))}
                      inputProps={{ min: 1, style: { textAlign: "center", direction: "ltr" } }}
                      sx={{ bgcolor: "#fff", width: "120px" }}
                    />
                  </TableCell>

                  <TableCell sx={{ width: "320px" }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Add a note (optional)..."
                      value={med.orderNote}
                      onChange={(e) => handleNoteChange(med.id, e.target.value)}
                      sx={{ bgcolor: "#fff" }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Remove from Mawsool">
                      <IconButton 
                        size="small" 
                        color="error" 
                        onClick={() => handleRemoveFromMawsool(med.id)}
                        sx={{ bgcolor: "#fee2e2", "&:hover": { bgcolor: "#fecaca" }, borderRadius: "8px" }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <TablePagination
          component="div"
          count={filteredOrders.length}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50]}
          slotProps={{
            select: {
              native: true,
            },
          }}
          sx={{ borderTop: "1px solid #e5e7eb", bgcolor: "#f8fafc" }}
        />
      </TableContainer>

      {/* GLOBAL FOOTER (تم وضعه هنا بالداخل قبل إغلاق Container) */}
      <Box
        component="footer"
        sx={{
          maxWidth: "1200px",
          margin: "40px auto 0 auto",
          pt: 3,
          pb: 4,
          borderTop: "1px solid #EAECF0",
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Typography
          sx={{
            fontSize: "13px",
            color: "#667085",
          }}
        >
          Notice an issue or have a suggestion?{" "}
          <Link
            component="button"
            onClick={() => navigate("/support")}
            sx={{
              color: "#1976D2",
              fontWeight: 600,
              textDecoration: "none",
              cursor: "pointer",
              "&:hover": {
                textDecoration: "underline",
              },
            }}
          >
            Contact Support
          </Link>
          .
        </Typography>
      
        <Typography
          sx={{
            fontSize: "12px",
            color: "#98A2B3",
          }}
        >
          Version 1.0.0
        </Typography>
      </Box>

    </Container>
  );
}

export default MawsoolOrders;