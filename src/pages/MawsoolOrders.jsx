import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../components/Sidebar";

import {
  Container, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, TextField, Box, IconButton, Tooltip, Chip, Link,
  Dialog, DialogTitle, DialogContent, DialogActions, Skeleton, Snackbar, Avatar, Divider, InputAdornment,
  Select, MenuItem
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import LocalPharmacyIcon from "@mui/icons-material/LocalPharmacy";
import AddCircleOutlinedIcon from "@mui/icons-material/AddCircleOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import KeyboardTabIcon from "@mui/icons-material/KeyboardTab";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FiberNewIcon from "@mui/icons-material/FiberNew";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import { useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { db } from "../firebase";
import {
  collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc
} from "firebase/firestore";
import { ministryMedicines } from "../data/ministryMedicines";

const MEDICINES_COLLECTION = "medicines";
const MAWSOOL_URL = "https://www.nupco.com/service/mawsool/";
const WRITE_DEBOUNCE_MS = 600;
const NUPCO_CODE_LENGTH = 13;

// نفس منطق قاعدة بيانات الوزارة المستخدم بصفحة الانفنتوري — خريطة كود
// نيبكو -> اسم الدواء، وفهرس عكسي للاسم -> كود، مستخدمة هنا للتعبئة
// التلقائية عند إضافة دواء خارج المخزون بموصول
const ministryDatabase = ministryMedicines.reduce((acc, item) => {
  const code = String(item.nupcoCode || item.NUPCO_Code || item.code || "").trim();
  const desc = item.description || item.Description || "";
  if (code) acc[code] = desc;
  return acc;
}, {});

const ministryNameToCode = {};
Object.entries(ministryDatabase).forEach(([code, name]) => {
  const key = String(name || "").trim().toLowerCase();
  if (key && !(key in ministryNameToCode)) {
    ministryNameToCode[key] = { code, name };
  }
});
const ministryCodeEntries = Object.entries(ministryDatabase);

function findCodeSuggestionByPartialCode(partial) {
  if (!partial || partial.length < 4) return null;
  const match = ministryCodeEntries.find(([code]) => code.startsWith(partial));
  return match ? { code: match[0], name: match[1] } : null;
}

function findNameSuggestionByPartialName(partial) {
  const key = String(partial || "").trim().toLowerCase();
  if (!key || key.length < 4) return null;
  const matchKey = Object.keys(ministryNameToCode).find((name) => name.startsWith(key));
  return matchKey ? ministryNameToCode[matchKey] : null;
}

// نفس شريط الترقيم الاحترافي المستخدم بصفحة الانفنتوري بالضبط: أول/سابق/أرقام
// صفحات مع "..." للفجوات/تالي/أخير — يبني قائمة أرقام الصفحات اللي تظهر
// (زي "1 2 3 ... 29")، دايمًا أول وآخر صفحة، وصفحة أو صفحتين حوالين الحالية
function getPaginationPageNumbers(currentPage, totalPages) {
  const delta = 1;
  const range = [];
  const withDots = [];
  let last = null;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
      range.push(i);
    }
  }

  range.forEach((i) => {
    if (last !== null) {
      if (i - last === 2) {
        withDots.push(last + 1);
      } else if (i - last > 1) {
        withDots.push("…");
      }
    }
    withDots.push(i);
    last = i;
  });

  return withDots;
}

function MawsoolOrders() {
  const navigate = useNavigate();
  const [orderedMeds, setOrderedMeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Add-external-medicine dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newMed, setNewMed] = useState({ name: "", code: "", orderQty: "", orderNote: "" });
  const [newMedErrors, setNewMedErrors] = useState({});
  const [savingNewMed, setSavingNewMed] = useState(false);
  // حالة التعرف على كود نيبكو بنفس أسلوب صفحة الانفنتوري: مطابق تمامًا،
  // غير معروف بقاعدة الوزارة، أو تجاوز عدد الأرقام الطبيعي
  const [codeMatched, setCodeMatched] = useState(false);
  const [codeNotRecognized, setCodeNotRecognized] = useState(false);
  const [codeTooLong, setCodeTooLong] = useState(false);
  const [codeSuggestion, setCodeSuggestion] = useState(null);
  const [nameSuggestion, setNameSuggestion] = useState(null);

  // Debounce timers for per-row Firestore writes
  const debounceTimers = useRef({});

  // Undo-delete: only one pending removal at a time; committed to Firestore after UNDO_DELAY_MS
  // unless the user hits Undo, or removes another item first (which commits this one immediately).
  const UNDO_DELAY_MS = 5000;
  const [pendingRemoval, setPendingRemoval] = useState(null); // { id, name, isExternal, timerId }
  const [undoSnackbarOpen, setUndoSnackbarOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, MEDICINES_COLLECTION),
      (snapshot) => {
        const allMeds = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        const mawsoolFiltered = allMeds.filter((m) => !m.isSection && m.mawsoolOrder);
        const initialized = mawsoolFiltered.map((m) => ({
          ...m,
          orderQty: m.orderQty !== undefined ? m.orderQty : "",
          orderNote: m.orderNote || ""
        }));
        setOrderedMeds(initialized);
        setLoading(false);
      },
      (err) => {
        console.error("فشل تحميل طلبات موصول من فايرستور:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Immediate local update + debounced Firestore write (avoids a write per keystroke)
  const updateMedicineFields = (id, fields, { immediate = false } = {}) => {
    setOrderedMeds((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...fields } : m))
    );

    const writeToFirestore = async () => {
      try {
        await updateDoc(doc(db, MEDICINES_COLLECTION, id), fields);
      } catch (err) {
        console.error("فشل تحديث الدواء بفايرستور:", err);
      }
    };

    const timerKey = `${id}:${Object.keys(fields).join(",")}`;
    if (debounceTimers.current[timerKey]) {
      clearTimeout(debounceTimers.current[timerKey]);
    }

    if (immediate) {
      writeToFirestore();
    } else {
      debounceTimers.current[timerKey] = setTimeout(writeToFirestore, WRITE_DEBOUNCE_MS);
    }
  };

  const handleQtyChange = (id, val) => {
    updateMedicineFields(id, { orderQty: val });
  };

  const handleNoteChange = (id, val) => {
    updateMedicineFields(id, { orderNote: val });
  };

  const commitRemoval = async (removal) => {
    if (!removal) return;
    if (removal.isExternal) {
      // External items only exist for Mawsool ordering purposes, so delete them entirely
      try {
        await deleteDoc(doc(db, MEDICINES_COLLECTION, removal.id));
      } catch (err) {
        console.error("فشل حذف الدواء الخارجي بفايرستور:", err);
      }
    } else {
      updateMedicineFields(removal.id, { mawsoolOrder: false, orderQty: "", orderNote: "" }, { immediate: true });
    }
  };

  const handleRemoveFromMawsool = (id, isExternal, name) => {
    // Only one undo-able removal at a time: if another is already pending, finalize it now
    if (pendingRemoval) {
      clearTimeout(pendingRemoval.timerId);
      commitRemoval(pendingRemoval);
    }

    const timerId = setTimeout(() => {
      commitRemoval({ id, isExternal });
      setPendingRemoval((curr) => (curr && curr.id === id ? null : curr));
      setUndoSnackbarOpen(false);
    }, UNDO_DELAY_MS);

    setPendingRemoval({ id, name, isExternal, timerId });
    setUndoSnackbarOpen(true);
  };

  const handleUndoRemove = () => {
    if (pendingRemoval) {
      clearTimeout(pendingRemoval.timerId);
    }
    setPendingRemoval(null);
    setUndoSnackbarOpen(false);
  };

  // Keep a ref in sync so the unmount-only cleanup below always sees the latest pending removal
  const pendingRemovalRef = useRef(null);
  useEffect(() => {
    pendingRemovalRef.current = pendingRemoval;
  }, [pendingRemoval]);

  // Commit any still-pending removal if the component unmounts before the timer fires
  useEffect(() => {
    return () => {
      if (pendingRemovalRef.current) {
        clearTimeout(pendingRemovalRef.current.timerId);
        commitRemoval(pendingRemovalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      { header: "Source", key: "source", width: 18 },
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2563EB" } };

    visibleMeds.forEach(med => {
      const finalQty = med.orderQty !== "" && med.orderQty !== null ? med.orderQty : (med.quantity || 1);
      worksheet.addRow({
        name: med.name,
        code: med.code || "-",
        orderQty: finalQty,
        orderNote: med.orderNote || "-",
        source: med.isExternal ? "Not in Inventory" : "Inventory"
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Mawsool_Order_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // --- Add external medicine dialog ---
  const openAddDialog = () => {
    setNewMed({ name: "", code: "", orderQty: "", orderNote: "" });
    setNewMedErrors({});
    setCodeMatched(false);
    setCodeNotRecognized(false);
    setCodeTooLong(false);
    setCodeSuggestion(null);
    setNameSuggestion(null);
    setAddDialogOpen(true);
  };

  // نفس منطق handleCodeChange بصفحة الانفنتوري: مطابقة تامة تعبي الاسم فورًا،
  // اقتراح شفاف وإحنا لسا بمنتصف الكتابة، وتحذير لو الكود تجاوز الطول
  // الطبيعي أو ما انطابق مع قاعدة بيانات الوزارة (يعني دواء جديد فعلاً)
  const handleNewMedCodeChange = (e) => {
    const enteredCode = e.target.value.trim();
    setNewMed((prev) => ({ ...prev, code: enteredCode }));
    setCodeSuggestion(null);

    if (!enteredCode) {
      setCodeNotRecognized(false);
      setCodeTooLong(false);
      setCodeMatched(false);
      return;
    }

    if (enteredCode.length > NUPCO_CODE_LENGTH) {
      setCodeTooLong(true);
      setCodeNotRecognized(false);
      setCodeMatched(false);
      return;
    }
    setCodeTooLong(false);

    if (ministryDatabase[enteredCode]) {
      setNewMed((prev) => ({ ...prev, code: enteredCode, name: ministryDatabase[enteredCode] }));
      setCodeNotRecognized(false);
      setCodeMatched(true);
      return;
    }
    setCodeMatched(false);

    if (enteredCode.length < NUPCO_CODE_LENGTH) {
      setCodeNotRecognized(false);
      setCodeSuggestion(findCodeSuggestionByPartialCode(enteredCode));
      return;
    }

    const cleanEntered = enteredCode.split(".")[0];
    const matchedKey = Object.keys(ministryDatabase).find((key) => key.split(".")[0] === cleanEntered);
    if (matchedKey) {
      setNewMed((prev) => ({ ...prev, code: enteredCode, name: ministryDatabase[matchedKey] }));
      setCodeNotRecognized(false);
      setCodeMatched(true);
    } else {
      setNewMed((prev) => ({ ...prev, code: enteredCode, name: "" }));
      setCodeNotRecognized(true);
    }
  };

  const handleNewMedCodeKeyDown = (e) => {
    if ((e.key === "Tab" || e.key === "Enter") && codeSuggestion && newMed.code !== codeSuggestion.code) {
      e.preventDefault();
      setNewMed((prev) => ({ ...prev, code: codeSuggestion.code, name: codeSuggestion.name }));
      setCodeSuggestion(null);
      setCodeNotRecognized(false);
      setCodeTooLong(false);
      setCodeMatched(true);
    }
  };

  const handleNewMedNameChange = (e) => {
    const value = e.target.value;
    setNewMed((prev) => ({ ...prev, name: value }));
    if (!newMed.code) {
      setNameSuggestion(findNameSuggestionByPartialName(value));
    } else {
      setNameSuggestion(null);
    }
  };

  const handleNewMedNameKeyDown = (e) => {
    if ((e.key === "Tab" || e.key === "Enter") && nameSuggestion && !newMed.code) {
      e.preventDefault();
      setNewMed((prev) => ({ ...prev, code: nameSuggestion.code, name: nameSuggestion.name }));
      setNameSuggestion(null);
      setCodeMatched(true);
    }
  };

  const closeAddDialog = () => {
    if (savingNewMed) return;
    setAddDialogOpen(false);
  };

  const validateNewMed = () => {
    const errors = {};
    if (!newMed.name.trim()) errors.name = "اسم الدواء مطلوب";
    if (!newMed.code.trim()) errors.code = "كود نوبكو مطلوب";
    // Quantity and notes are optional
    setNewMedErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveNewMed = async () => {
    if (!validateNewMed()) return;
    setSavingNewMed(true);
    try {
      await addDoc(collection(db, MEDICINES_COLLECTION), {
        name: newMed.name.trim(),
        code: newMed.code.trim(),
        orderQty: newMed.orderQty === "" ? "" : Number(newMed.orderQty),
        orderNote: newMed.orderNote.trim(),
        isSection: false,
        mawsoolOrder: true,
        isExternal: true,
        isVerified: codeMatched
      });
      setAddDialogOpen(false);
    } catch (err) {
      console.error("فشل إضافة الدواء الخارجي بفايرستور:", err);
    } finally {
      setSavingNewMed(false);
    }
  };

  // Exclude the item currently pending an undoable removal from counts/exports/table
  const visibleMeds = orderedMeds.filter(m => !pendingRemoval || m.id !== pendingRemoval.id);

  const filteredOrders = visibleMeds.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (m.code && m.code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const paginatedOrders = filteredOrders.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // نفس أمان صفحة الانفنتوري: لو البحث/الفلترة قلّلت النتائج ورقم الصفحة
  // الحالي صار خارج النطاق، نرجعه لآخر صفحة صحيحة بدل ما يطلع جدول فاضي
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredOrders.length / rowsPerPage));
    if (page > totalPages - 1) {
      setPage(totalPages - 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredOrders.length, rowsPerPage]);

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      
      <Sidebar />
      
      {/* البنر العلوي */}
      <Box 
        sx={{ 
          position: "relative", mb: 4, borderRadius: 4, overflow: "hidden", 
          bgcolor: "#f1f5f9", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.08)", border: "1px solid #e2e8f0",
          cursor: "pointer"
        }}
        onClick={() => window.open(MAWSOOL_URL, "_blank", "noopener,noreferrer")}
        role="button"
        aria-label="Open Mawsool website"
      >
        <Box 
          component="img" 
          src="/mawsool-banner.jpg" 
          alt="Mawsool Banner" 
          sx={{ width: "100%", height: { xs: "220px", sm: "320px", md: "420px" }, objectFit: "contain", display: "block", mx: "auto" }} 
        />

        <Tooltip title="Open Mawsool website">
          <Box sx={{ position: "absolute", top: 20, right: 20, bgcolor: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)", borderRadius: "10px", p: 1, display: "flex", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
            <OpenInNewIcon sx={{ color: "#1f2937", fontSize: 20 }} />
          </Box>
        </Tooltip>
        
        <Box sx={{ position: "absolute", top: 20, left: 20, display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton 
            onClick={(e) => { e.stopPropagation(); navigate("/inventory"); }} 
            sx={{ bgcolor: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)", color: "#1f2937", "&:hover": { bgcolor: "#fff" }, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
          >
            <ArrowBackRoundedIcon />
          </IconButton>
          <Chip 
            label={`${visibleMeds.length} Items Selected`} 
            sx={{ bgcolor: "rgba(37, 99, 235, 0.9)", backdropFilter: "blur(4px)", color: "#fff", fontWeight: "bold", height: 40, fontSize: "0.95rem", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }} 
          />
        </Box>

        <Box sx={{ position: "absolute", bottom: 20, right: 20, display: "flex", gap: 1.5 }}>
          <Button 
  variant="contained" 
  startIcon={<AddCircleOutlinedIcon />}
            onClick={(e) => { e.stopPropagation(); openAddDialog(); }}
            sx={{ borderRadius: "12px", textTransform: "none", px: 3, py: 1.2, fontWeight: 600, bgcolor: "#f59e0b", "&:hover": { bgcolor: "#d97706" }, boxShadow: "0 4px 12px rgba(245, 158, 11, 0.4)" }}
          >
            Add Medicine Not in Inventory
          </Button>
          <Button 
            variant="contained" 
            color="success" 
            startIcon={<DownloadIcon />}
            onClick={(e) => { e.stopPropagation(); handleExportOrderExcel(); }} 
            sx={{ borderRadius: "12px", textTransform: "none", px: 3.5, py: 1.2, fontWeight: 600, bgcolor: "#10b981", "&:hover": { bgcolor: "#059669" }, boxShadow: "0 4px 12px rgba(16, 185, 129, 0.4)" }}
          >
            Export All Orders Excel ({visibleMeds.length})
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
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell><Skeleton variant="text" width="80%" /></TableCell>
                  <TableCell><Skeleton variant="text" width="60%" /></TableCell>
                  <TableCell><Skeleton variant="text" width="60%" /></TableCell>
                  <TableCell><Skeleton variant="text" width="90%" /></TableCell>
                  <TableCell><Skeleton variant="circular" width={28} height={28} sx={{ mx: "auto" }} /></TableCell>
                </TableRow>
              ))
            ) : paginatedOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6, color: "text.secondary" }}>
                  <LocalPharmacyIcon sx={{ fontSize: 48, color: "#cbd5e1", mb: 1 }} />
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>No medications found in Mawsool list.</Typography>
                  <Typography variant="caption">Go back to Inventory and check items to include them here.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedOrders.map((med) => (
                <TableRow
                  key={med.id}
                  sx={{
                    bgcolor: med.isExternal ? "#fffbeb" : "inherit",
                    "&:hover": { bgcolor: med.isExternal ? "#fef3c7" : "#f8fafc" }
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: "#1f2937" }}>
                        {med.name}
                      </Typography>
                      {med.isExternal && (
                        <Chip
                          label="Not in Inventory"
                          size="small"
                          sx={{ bgcolor: "#f59e0b", color: "#fff", fontWeight: 600, height: 20, fontSize: "0.7rem" }}
                        />
                      )}
                      {med.isExternal && med.isVerified === false && (
                        <Tooltip title="This Nupco code wasn't found in the ministry database when added">
                          <Chip
                            icon={<FiberNewIcon sx={{ fontSize: 14, color: "#92400e !important" }} />}
                            label="New"
                            size="small"
                            sx={{ bgcolor: "#fef3c7", color: "#92400e", fontWeight: 600, height: 20, fontSize: "0.7rem" }}
                          />
                        </Tooltip>
                      )}
                    </Box>
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
                        onClick={() => handleRemoveFromMawsool(med.id, med.isExternal, med.name)}
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

        {/* شريط ترقيم صفحات احترافي — نفس شكل صفحة الانفنتوري بالضبط */}
        {(() => {
          const totalItems = filteredOrders.length;
          const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
          const currentPage = page + 1;
          const from = totalItems === 0 ? 0 : page * rowsPerPage + 1;
          const to = Math.min(totalItems, (page + 1) * rowsPerPage);
          const pageNumbers = getPaginationPageNumbers(currentPage, totalPages);

          const pageButtonSx = (active) => ({
            minWidth: 34,
            height: 34,
            borderRadius: "8px",
            fontSize: 13,
            fontWeight: 700,
            p: 0,
            color: active ? "#fff" : "#374151",
            bgcolor: active ? "#2563eb" : "transparent",
            "&:hover": { bgcolor: active ? "#1d4ed8" : "#f3f4f6" },
          });

          return (
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1.5,
                borderTop: "1px solid #e5e7eb",
                bgcolor: "#f8fafc",
                px: 2,
                py: 1.5,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Typography sx={{ fontSize: 13, color: "#667085" }}>
                  Showing {from} to {to} of {totalItems} items
                </Typography>

                <Select
                  size="small"
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                  }}
                  sx={{
                    fontSize: 13,
                    height: 32,
                    borderRadius: "8px",
                    bgcolor: "#fff",
                    "& .MuiSelect-select": { py: 0.5, pl: 1.2 },
                  }}
                >
                  {[10, 25, 50].map((n) => (
                    <MenuItem key={n} value={n} sx={{ fontSize: 13 }}>
                      {n} per page
                    </MenuItem>
                  ))}
                </Select>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                <Tooltip title="First page">
                  <span>
                    <IconButton
                      size="small"
                      disabled={page === 0}
                      onClick={() => setPage(0)}
                      sx={pageButtonSx(false)}
                    >
                      <KeyboardDoubleArrowLeftIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Previous page">
                  <span>
                    <IconButton
                      size="small"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      sx={pageButtonSx(false)}
                    >
                      <ChevronLeftIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>

                {pageNumbers.map((p, i) =>
                  p === "…" ? (
                    <Typography key={`dots-${i}`} sx={{ px: 0.5, color: "#98A2B3", fontSize: 13 }}>
                      …
                    </Typography>
                  ) : (
                    <Button
                      key={p}
                      onClick={() => setPage(p - 1)}
                      sx={pageButtonSx(p === currentPage)}
                    >
                      {p}
                    </Button>
                  )
                )}

                <Tooltip title="Next page">
                  <span>
                    <IconButton
                      size="small"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      sx={pageButtonSx(false)}
                    >
                      <ChevronRightIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Last page">
                  <span>
                    <IconButton
                      size="small"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage(totalPages - 1)}
                      sx={pageButtonSx(false)}
                    >
                      <KeyboardDoubleArrowRightIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            </Box>
          );
        })()}
      </TableContainer>

      {/* Dialog: Add medicine not in inventory */}
      <Dialog open={addDialogOpen} onClose={closeAddDialog} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: "16px" } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1.5 }}>
          <Avatar sx={{ bgcolor: "#fef3c7", color: "#d97706", width: 42, height: 42 }}>
            <AddCircleOutlinedIcon />
          </Avatar>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: "1.05rem", lineHeight: 1.3 }}>
              Add Medicine Not in Inventory
            </Typography>
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
              For items you want in this Mawsool order that aren't tracked in stock
            </Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.75, pt: 2.5 }}>

          <Box>
            <TextField
              label="Nupco Code"
              required
              value={newMed.code}
              onChange={handleNewMedCodeChange}
              onKeyDown={handleNewMedCodeKeyDown}
              error={!!newMedErrors.code}
              helperText={newMedErrors.code || "Type the code to auto-fill the name"}
              placeholder="Enter Nupco Code..."
              fullWidth
              InputProps={{
                endAdornment: (codeMatched || codeTooLong || codeNotRecognized) ? (
                  <InputAdornment position="end">
                    {codeMatched && (
                      <Tooltip title="Matched with ministry database">
                        <CheckCircleIcon sx={{ color: "#16a34a", fontSize: 20 }} />
                      </Tooltip>
                    )}
                    {codeTooLong && (
                      <Tooltip title={`Exceeds the usual code length (${NUPCO_CODE_LENGTH} digits)`}>
                        <WarningAmberIcon sx={{ color: "#d97706", fontSize: 20 }} />
                      </Tooltip>
                    )}
                    {codeNotRecognized && !codeTooLong && (
                      <Tooltip title="New medicine — not in ministry database">
                        <FiberNewIcon sx={{ color: "#d97706", fontSize: 22 }} />
                      </Tooltip>
                    )}
                  </InputAdornment>
                ) : null
              }}
            />

            {codeSuggestion && !codeTooLong && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.75, px: 0.5, opacity: 0.75 }}>
                <KeyboardTabIcon sx={{ fontSize: 13, color: "#94a3b8" }} />
                <Typography sx={{ fontSize: 11.5, color: "#64748b", fontStyle: "italic" }}>
                  {codeSuggestion.name} ({codeSuggestion.code}) — press Tab to autofill
                </Typography>
              </Box>
            )}

            {codeTooLong && (
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, bgcolor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", p: 1.25, mt: 1 }}>
                <WarningAmberIcon sx={{ fontSize: 18, color: "#d97706", mt: 0.15 }} />
                <Typography sx={{ fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
                  This exceeds the usual Nupco code digit count ({NUPCO_CODE_LENGTH} digits) — double-check it before saving.
                </Typography>
              </Box>
            )}

            {codeNotRecognized && !codeTooLong && (
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, bgcolor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", p: 1.25, mt: 1 }}>
                <FiberNewIcon sx={{ fontSize: 18, color: "#d97706", mt: 0.15 }} />
                <Typography sx={{ fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
                  <b>New medicine</b> — this code isn't in the ministry database yet. You can still add it manually.
                </Typography>
              </Box>
            )}
          </Box>

          <Box>
            <TextField
              label="Medicine Name"
              required
              value={newMed.name}
              onChange={handleNewMedNameChange}
              onKeyDown={handleNewMedNameKeyDown}
              error={!!newMedErrors.name}
              helperText={newMedErrors.name}
              fullWidth
            />

            {nameSuggestion && !newMed.code && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.75, px: 0.5, opacity: 0.75 }}>
                <KeyboardTabIcon sx={{ fontSize: 13, color: "#94a3b8" }} />
                <Typography sx={{ fontSize: 11.5, color: "#64748b", fontStyle: "italic" }}>
                  Nupco code: {nameSuggestion.code} — press Tab to autofill
                </Typography>
              </Box>
            )}
          </Box>

          <Divider sx={{ my: 0.25 }} />

          <TextField
            label="Requested Quantity (optional)"
            type="number"
            value={newMed.orderQty}
            onChange={(e) => setNewMed((p) => ({ ...p, orderQty: e.target.value === "" ? "" : Number(e.target.value) }))}
            inputProps={{ min: 1 }}
            fullWidth
          />
          <TextField
            label="Notes (optional)"
            value={newMed.orderNote}
            onChange={(e) => setNewMed((p) => ({ ...p, orderNote: e.target.value }))}
            multiline
            minRows={2}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button onClick={closeAddDialog} disabled={savingNewMed} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveNewMed}
            variant="contained"
            disabled={savingNewMed}
            startIcon={<AddCircleOutlinedIcon />}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px", px: 2.5, bgcolor: "#f59e0b", "&:hover": { bgcolor: "#d97706" } }}
          >
            {savingNewMed ? "Adding..." : "Add to Mawsool List"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* GLOBAL FOOTER */}
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

      {/* Undo delete */}
      <Snackbar
        open={undoSnackbarOpen}
        autoHideDuration={UNDO_DELAY_MS}
        onClose={(e, reason) => { if (reason !== "clickaway") setUndoSnackbarOpen(false); }}
        message={pendingRemoval ? `Removed "${pendingRemoval.name}" from Mawsool` : ""}
        action={
          <Button color="warning" size="small" onClick={handleUndoRemove} sx={{ textTransform: "none", fontWeight: 700 }}>
            Undo
          </Button>
        }
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />

    </Container>
  );
}

export default MawsoolOrders;