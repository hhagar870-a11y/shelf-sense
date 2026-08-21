import React, { useState, useMemo, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import Barcode from "react-barcode";
import {
  Container,
  Paper,
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TablePagination,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Checkbox,
  FormControlLabel,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link,
} from "@mui/material";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import PrintIcon from "@mui/icons-material/Print";
import PaletteIcon from "@mui/icons-material/Palette";
import AspectRatioIcon from "@mui/icons-material/AspectRatio";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { AlertCircle as ErrorOutline } from "lucide-react";
import DoNotDisturbAltIcon from "@mui/icons-material/DoNotDisturbAlt";
import GroupsIcon from "@mui/icons-material/Groups";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import OpenWithIcon from "@mui/icons-material/OpenWith";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate } from "react-router-dom";

import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getDrugCategories } from "../data/getDrugCategories";

/* ============================================================
   Smart Labeling — Shelf Sense
   Label Editor (content, appearance, layout, templates) →
   live preview → print, tiled onto A4 → medicine list below
   to jump straight into a label for a specific batch/date.
   Reads the same "medicines" data Inventory.jsx uses.
   ============================================================ */

const BLUE = "#1D4ED8";
const PXPERMM = 3.7795;
const mmToPx = (mm) => mm * PXPERMM;
const PAGE_W = 210;
const PAGE_H = 297;

// Same status thresholds as Inventory.jsx
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

// The four fixed pharmacy-approved label looks, matching the physical
// shelf labels: solid purple for Hazardous, solid red for High Alert,
// yellow (with a small ear/eye badge) for Sound/Look-Alike, plain white
// for medicines with no category.
const CATEGORY_LABEL_STYLES = {
  Hazardous: { bg: "#8B5CF6", text: "#fff", accent: "#fff", chip: null },
  "High Alert": { bg: "#E53935", text: "#fff", accent: "#fff", chip: null },
  "Sound Alike": { bg: "#FFD54F", text: "#000", accent: "#000", chip: { icon: "👂", label: "Sound Alike" } },
  "Look Alike": { bg: "#FFD54F", text: "#000", accent: "#000", chip: { icon: "👁️", label: "Look Alike" } },
  Normal: { bg: "#FFFFFF", text: "#111827", accent: "#1D4ED8", chip: null },
};

const SIZE_PRESETS = {
  small: { width: 50, height: 30 },
  medium: { width: 70, height: 45 },
  large: { width: 100, height: 60 },
  shelfSign: { width: 150, height: 150 },
};

const TEMPLATES = [
  {
    id: "near-expiry",
    name: "Near Expiry Sticker",
    icon: WarningAmberIcon,
    bg: "#FDF6EC", text: "#B3261E", accent: "#ED6C02",
    title: "NEAR EXPIRY",
    dims: { width: 70, height: 45 },
    fields: { name: true, expiry: true, code: false, description: false, action: true, message: false, qr: false, barcode: false, logo: false },
    action: "USE FIRST",
  },
  {
    id: "expired",
    name: "Expired Sticker",
    icon: ErrorOutline,
    bg: "#FDECEA", text: "#7A0C0C", accent: "#D32F2F",
    title: "EXPIRED",
    dims: { width: 70, height: 45 },
    fields: { name: true, expiry: true, code: false, description: false, action: true, message: false, qr: false, barcode: false, logo: false },
    action: "DO NOT USE",
  },
  {
    id: "near-expiry-sign",
    name: "Near Expiry — Shelf Sign",
    icon: WarningAmberIcon,
    bg: "#FDF6EC", text: "#B3261E", accent: "#D32F2F",
    title: "NEAR EXPIRY",
    description: "This item is close to its expiry date. Please use it before then.",
    dims: { width: 110, height: 150 },
    fields: { name: false, expiry: true, code: false, description: true, action: true, message: false, qr: false, barcode: false, logo: false },
    action: "USE FIRST",
  },
  {
    id: "dept-restriction",
    name: "Department Restriction",
    icon: DoNotDisturbAltIcon,
    bg: "#FFF4E5", text: "#7A4100", accent: "#ED6C02",
    title: "DO NOT SHARE\nWITH OTHER DEPARTMENTS",
    description: "This stock is near expiry and reserved for this department only.",
    dims: { width: 110, height: 150 },
    fields: { name: false, expiry: false, code: false, description: true, action: true, message: false, qr: false, barcode: false, logo: false },
    action: "FOR THIS DEPARTMENT ONLY",
  },
  {
    id: "fefo",
    name: "FEFO Reminder",
    icon: AccessTimeIcon,
    bg: "#E9F7EF", text: "#0B4A26", accent: "#2E7D32",
    title: "FIRST EXPIRY, FIRST OUT",
    description: "Check expiry dates regularly and follow the FEFO principle.",
    dims: { width: 170, height: 90 },
    fields: { name: false, expiry: false, code: false, description: true, action: true, message: false, qr: false, barcode: false, logo: false },
    action: "FEFO",
  },
  {
    id: "dept-only",
    name: "Department Only — Big Sign",
    icon: GroupsIcon,
    bg: "#FFF4E5", text: "#7A4100", accent: "#ED6C02",
    title: "FOR THIS\nDEPARTMENT ONLY",
    dims: { width: 150, height: 150 },
    fields: { name: false, expiry: false, code: false, description: false, action: false, message: false, qr: false, barcode: false, logo: false },
    action: "",
  },
  {
    id: "date-check",
    name: "Date Check Reminder",
    icon: CalendarMonthIcon,
    bg: "#EEF2FF", text: "#1E3A8A", accent: "#3B82F6",
    title: "CHECK DATES REGULARLY",
    dims: { width: 180, height: 80 },
    fields: { name: false, expiry: false, code: false, description: false, action: false, message: false, qr: false, barcode: false, logo: false },
    action: "",
  },
];

function buildLabelText(med, expiry, template) {
  const status = expiry ? getStatus(expiry) : "";
  return {
    name: med?.name || "",
    expiry: expiry || "",
    code: med?.code || "",
    action: template.action || "",
    message: "",
    status,
  };
}

export default function LabelPrinting() {
  const navigate = useNavigate();
  const [medicines, setMedicines] = useState([]);
  const [medicinesLoading, setMedicinesLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [selectedMed, setSelectedMed] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [templateIndex, setTemplateIndex] = useState(0);
  const template = TEMPLATES[templateIndex];

  const [fields, setFields] = useState(TEMPLATES[0].fields);
  const [labelText, setLabelText] = useState(buildLabelText(null, "", TEMPLATES[0]));

  const [appearance, setAppearance] = useState({
    bg: TEMPLATES[0].bg, text: TEMPLATES[0].text, accent: TEMPLATES[0].accent,
    fontSize: 16, bold: true, align: "center",
  });

  const [orientation, setOrientation] = useState("horizontal");
  const [sizePreset, setSizePreset] = useState("custom");
  const [customSize, setCustomSize] = useState(TEMPLATES[0].dims);
  const [copies, setCopies] = useState(12);
  const [arrangement, setArrangement] = useState({ x: 10, y: 10 });
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("content");
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [logoPos, setLogoPos] = useState({ x: 15, y: 85 });
  const [logoSize, setLogoSize] = useState(28);
  const [qrCustomUrl, setQrCustomUrl] = useState("");
  const [qrSize, setQrSize] = useState(40);
  const [categoryChip, setCategoryChip] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [batch, setBatch] = useState([]);
  const [qrMessageHtml, setQrMessageHtml] = useState("");
  const [qrMessageId] = useState(() => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const [qrMessageSaved, setQrMessageSaved] = useState(false);

  async function saveQrMessage() {
    if (!qrMessageHtml.trim()) return;
    try {
      await setDoc(doc(db, "qrMessages", qrMessageId), { html: qrMessageHtml, updatedAt: Date.now() });
      setQrMessageSaved(true);
    } catch (err) {
      console.error("Failed to save QR message:", err);
    }
  }

  useEffect(() => {
    async function fetchMedicines() {
      try {
        const snap = await getDocs(collection(db, "medicines"));
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((m) => !m.isSection);
        setMedicines(list);
      } catch (err) {
        console.error("Failed to load medicines from Firestore:", err);
      } finally {
        setMedicinesLoading(false);
      }
    }
    fetchMedicines();
  }, []);

  useEffect(() => {
    async function fetchLogo() {
      try {
        const snap = await getDoc(doc(db, "settings", "labelBranding"));
        if (snap.exists() && snap.data().logoDataUrl) {
          setLogoDataUrl(snap.data().logoDataUrl);
        }
      } catch (err) {
        console.error("Failed to load logo from Firestore:", err);
      }
    }
    fetchLogo();
  }, []);

  function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      setLogoDataUrl(reader.result);
      try {
        await setDoc(doc(db, "settings", "labelBranding"), { logoDataUrl: reader.result }, { merge: true });
      } catch (err) {
        console.error("Failed to save logo to Firestore:", err);
      }
    };
    reader.readAsDataURL(file);
  }

  const dims = sizePreset === "custom" ? customSize : SIZE_PRESETS[sizePreset];

  useEffect(() => {
    const targetCode = sessionStorage.getItem("labelTarget");
    if (!targetCode) return;
    sessionStorage.removeItem("labelTarget");
    const med = medicines.find((m) => String(m.code) === String(targetCode));
    if (!med) return;
    const dates = med.expiryDates?.length ? med.expiryDates : [med.expiry];
    const statuses = dates.map((d) => getStatus(d));
    const worstIdx = statuses.findIndex((s) => s === "Expired");
    const idx = worstIdx >= 0 ? worstIdx : statuses.findIndex((s) => s === "Near Expiry");
    const useIdx = idx >= 0 ? idx : 0;
    generateForDate(med, dates[useIdx], statuses[useIdx]);
  }, [medicines]);

  const rows = useMemo(() => {
    const priority = { Expired: 0, "Near Expiry": 1, Safe: 2, "": 3 };
    return medicines
      .map((med) => {
        const dates = med.expiryDates?.length ? med.expiryDates : [med.expiry];
        const statuses = dates.map((d) => getStatus(d));
        const worst = statuses.includes("Expired") ? "Expired" : statuses.includes("Near Expiry") ? "Near Expiry" : "Safe";
        const categories = [...new Set(med.categories || getDrugCategories(med.name, med.code))];
        return { med, dates, statuses, worst, categories };
      })
      .filter(({ med, worst, categories }) => {
        const term = search.trim().toLowerCase();
        const matchSearch = !term
          || med.name?.toLowerCase().includes(term)
          || String(med.code || "").toLowerCase().includes(term)
          || (med.otherNames || []).some((n) => n?.toLowerCase().includes(term));
        const matchStatus = statusFilter === "All" || worst === statusFilter;
        const matchCategory = categoryFilter === "All"
          || (categoryFilter === "None" ? categories.length === 0 : categories.includes(categoryFilter));
        return matchSearch && matchStatus && matchCategory;
      })
      .sort((a, b) => (priority[a.worst] ?? 9) - (priority[b.worst] ?? 9));
  }, [medicines, search, statusFilter, categoryFilter]);

  const pagedRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  function applyTemplate(idx) {
    const tpl = TEMPLATES[idx];
    setTemplateIndex(idx);
    setFields(tpl.fields);
    setLabelText((prev) => ({ ...prev, action: tpl.action || prev.action }));
    setAppearance((a) => ({ ...a, bg: tpl.bg, text: tpl.text, accent: tpl.accent }));
    setSizePreset("custom");
    setCustomSize(tpl.dims);
    setCategoryChip(null);
  }

  function goTemplate(dir) {
    const next = (templateIndex + dir + TEMPLATES.length) % TEMPLATES.length;
    applyTemplate(next);
  }

  function generateForDate(med, expiry, status) {
    setSelectedMed(med);
    setSelectedDate(expiry);
    const idx = status === "Expired" ? 1 : 0;
    const tpl = TEMPLATES[idx];
    setTemplateIndex(idx);
    setFields(tpl.fields);
    setLabelText(buildLabelText(med, expiry, tpl));
    setAppearance((a) => ({ ...a, bg: tpl.bg, text: tpl.text, accent: tpl.accent }));
    setSizePreset("custom");
    setCustomSize(tpl.dims);
    setOrientation("horizontal");
    setCategoryChip(null);
    document.getElementById("label-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleField(key) {
    setFields((f) => {
      const next = { ...f, [key]: !f[key] };
      // Action and Custom Message occupy the same slot on the label —
      // turning one on should turn the other off instead of silently
      // losing to whichever has leftover text.
      if (key === "message" && next.message) next.action = false;
      if (key === "action" && next.action) next.message = false;
      return next;
    });
  }

  // Apply one of the four fixed category looks (purple/red/yellow/white),
  // used both for the "Suggested Labels" row and the batch select-all.
  function applyCategoryStyle(cat) {
    const style = CATEGORY_LABEL_STYLES[cat] || CATEGORY_LABEL_STYLES.Normal;
    setFields((f) => ({ ...f, name: true, logo: true }));
    setAppearance((a) => ({ ...a, bg: style.bg, text: style.text, accent: style.accent }));
    setCategoryChip(style.chip);
  }

  function addToBatch() {
    setBatch((b) => [...b, {
      id: `b${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      labelText: { ...labelText },
      fields: { ...fields },
      appearance: { ...appearance },
      dims: { ...dims },
      orientation,
      categoryChip,
      previewName: labelText.name || template.title,
    }]);
  }

  function removeFromBatch(id) {
    setBatch((b) => b.filter((item) => item.id !== id));
  }

  function addAllFilteredToBatch() {
    const items = rows.map(({ med, categories }) => {
      const cat = categories[0] || "Normal";
      const style = CATEGORY_LABEL_STYLES[cat] || CATEGORY_LABEL_STYLES.Normal;
      return {
        id: `b${Date.now()}_${med.id}`,
        labelText: { name: med.name, expiry: "", code: med.code || "", action: "", message: "", status: "" },
        fields: { name: true, expiry: false, code: false, description: false, action: false, message: false, qr: fields.qr, barcode: fields.barcode, logo: true },
        appearance: { bg: style.bg, text: style.text, accent: style.accent, fontSize: appearance.fontSize, bold: true, align: "center" },
        dims: { ...dims },
        orientation,
        categoryChip: style.chip,
        previewName: med.name,
      };
    });
    setBatch((b) => [...b, ...items]);
  }

  useEffect(() => {
    if (!fields.logo && activeTab === "branding") setActiveTab("content");
  }, [fields.logo, activeTab]);

  function handlePrint() {
    window.print();
  }

  function confirmArrangement(newDims, newArrangement) {
    setCustomSize(newDims);
    setSizePreset("custom");
    setOrientation("horizontal");
    setArrangement(newArrangement);
    setArrangeOpen(false);
  }

  const fieldMeta = [
    { key: "name", label: "Medication Name" },
    { key: "expiry", label: "Expiry Date" },
    { key: "code", label: "NUPCO Code" },
    { key: "description", label: "Description text" },
    { key: "action", label: "Action / Instruction" },
    { key: "message", label: "Custom Message" },
    { key: "qr", label: "QR Code (scan for details)" },
    { key: "barcode", label: "Linear Barcode (Code128, for scanner)" },
    { key: "logo", label: "Cluster Logo" },
  ];

  return (
    <Container maxWidth="xl" sx={{ mt: 3, mb: 5 }}>
      <style>{`
        @page { size: A4; margin: 0; }
        @media screen { #print-sheet { display: none; } }
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          body * { visibility: hidden; }
          #print-sheet, #print-sheet * { visibility: visible; }
          #print-sheet {
            display: flex !important;
            flex-wrap: wrap;
            gap: 4mm;
            position: absolute; top: ${arrangement.y}mm; left: ${arrangement.x}mm;
            width: calc(${PAGE_W}mm - ${arrangement.x}mm - 5mm);
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <Box className="no-print">
        {/* البانر العلوي: تم ضبطه ليأخذ حجم الصورة الطبيعي تماماً وبدون أي تمدد أو قص */}
        <Box
          component="img"
          src="/label-banner.jpg"
          alt=""
          onError={(e) => { e.currentTarget.style.display = "none"; }}
sx={{ width: { xs: "100%", md: "85%" }, height: "auto", mx: "auto", borderRadius: 4, mb: 3, display: "block" }}        />

        {/* ---------- Label Editor ---------- */}
        <Paper id="label-editor" elevation={0} sx={{ borderRadius: 4, border: "1px solid #e5e7eb", p: 3, mb: 4 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Label Editor</Typography>
            <Tooltip title="Customize the content, colors and size, then print — labels repeat automatically to fill the A4 page.">
              <IconButton size="small"><InfoOutlinedIcon fontSize="small" sx={{ color: "#9ca3af" }} /></IconButton>
            </Tooltip>
          </Box>

          <Box sx={{ mb: 3 }}>
            {selectedMed ? (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", bgcolor: "#F5F9FF", border: "1px solid #DCE6FA", borderRadius: 2, px: 1.5, py: 1 }}>
                <Typography variant="body2" sx={{ color: "#6b7280" }}>Editing:</Typography>
                <Chip size="small" label={selectedMed.name} sx={{ fontWeight: 700, bgcolor: BLUE, color: "#fff" }} />
                {selectedDate && <Chip size="small" label={selectedDate} variant="outlined" />}
                {labelText.status && <Chip size="small" label={labelText.status} color={STATUS_CHIP[labelText.status]} />}
                <Button size="small" onClick={() => { setSelectedMed(null); setSelectedDate(""); }} sx={{ textTransform: "none", ml: "auto" }}>
                  Clear
                </Button>
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: "#6b7280" }}>
                Pick a template below, or generate one from a medicine's expiry date further down.
              </Typography>
            )}
          </Box>

          <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 4 }}>
            <Box sx={{ width: { xs: "100%", md: 340 }, flexShrink: 0 }}>
              <Tabs
                value={activeTab} onChange={(e, v) => setActiveTab(v)}
                variant="scrollable" scrollButtons="auto"
                sx={{ borderBottom: "1px solid #e5e7eb", mb: 2, minHeight: 40 }}
              >
                <Tab value="content" label="Content" sx={{ textTransform: "none", minHeight: 40, fontWeight: 700 }} />
                {fields.logo && (
                  <Tab value="branding" label="✎ Branding" sx={{
                    textTransform: "none", minHeight: 40, fontWeight: 700,
                    color: activeTab === "branding" ? "#fff" : "#1D4ED8",
                    bgcolor: activeTab === "branding" ? "#1D4ED8" : "#EAF2FF",
                    borderRadius: "8px 8px 0 0", mx: 0.5,
                  }} />
                )}
                <Tab value="appearance" label="Appearance" sx={{ textTransform: "none", minHeight: 40, fontWeight: 700 }} />
                <Tab value="layout" label="Layout & Size" sx={{ textTransform: "none", minHeight: 40, fontWeight: 700 }} />
              </Tabs>

              <Box sx={{ maxHeight: { md: 520 }, overflowY: { md: "auto" }, pr: { md: 1 } }}>
                {activeTab === "content" && (
                  <Box>
                    <Box sx={{ display: "flex", flexDirection: "column" }}>
                      {fieldMeta.map((f) => (
                        <FormControlLabel
                          key={f.key}
                          control={<Checkbox size="small" checked={fields[f.key]} onChange={() => toggleField(f.key)} />}
                          label={<Typography variant="body2">{f.label}</Typography>}
                        />
                      ))}
                    </Box>
                    {fields.logo && (
                      <Typography variant="caption" sx={{ color: "#1D4ED8", display: "block", mt: -0.5, mb: 1, ml: 4, fontWeight: 600 }}>
                        → Edit position & size in the ✎ Branding tab above
                      </Typography>
                    )}
                    {fields.name && (
                      <TextField fullWidth size="small" label="Medication Name" sx={{ mt: 1 }}
                        helperText="Edit freely — e.g. trim off the strength/dosage if you don't want it shown."
                        value={labelText.name} onChange={(e) => setLabelText({ ...labelText, name: e.target.value })} />
                    )}
                    {fields.action && (
                      <TextField fullWidth size="small" label="Action / Instruction" sx={{ mt: 1.5 }}
                        value={labelText.action} onChange={(e) => setLabelText({ ...labelText, action: e.target.value })} />
                    )}
                    {fields.message && (
                      <TextField fullWidth size="small" label="Custom message" sx={{ mt: 1.5 }}
                        placeholder="e.g. CHECK BEFORE DISPENSING"
                        value={labelText.message} onChange={(e) => setLabelText({ ...labelText, message: e.target.value })} />
                    )}
                    {fields.qr && (
                      <>
                        <TextField fullWidth size="small" label="Custom link for QR (optional)" sx={{ mt: 1.5 }}
                          placeholder="Leave blank to link to this medicine automatically"
                          helperText="Paste any URL and the QR code will open that instead — overrides the message below."
                          value={qrCustomUrl} onChange={(e) => setQrCustomUrl(e.target.value)} />

                        {!qrCustomUrl.trim() && (
                          <Box sx={{ mt: 1.5 }}>
                            <Typography variant="caption" sx={{ color: "#6b7280", display: "block", mb: 0.5 }}>
                              Custom message shown when the QR is scanned (optional, alongside the medicine info)
                            </Typography>
                            <Box sx={{ display: "flex", gap: 0.5, mb: 0.5 }}>
                              <Button size="small" onClick={() => document.execCommand("bold")} sx={{ minWidth: 32, fontWeight: 800 }}>B</Button>
                              {["#000000", "#D32F2F", "#1D4ED8", "#2E7D32"].map((c) => (
                                <Box key={c} onClick={() => document.execCommand("foreColor", false, c)}
                                  sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: c, cursor: "pointer", border: "1px solid #e5e7eb" }} />
                              ))}
                            </Box>
                            <Box
                              contentEditable
                              suppressContentEditableWarning
                              onInput={(e) => setQrMessageHtml(e.currentTarget.innerHTML)}
                              onBlur={saveQrMessage}
                              sx={{
                                minHeight: 70, border: "1px solid #e5e7eb", borderRadius: 1.5, p: 1.5, fontSize: 14,
                                "&:empty:before": { content: '"Type a message pharmacists will see when they scan this label\'s QR..."', color: "#9ca3af" },
                              }}
                            />
                            {qrMessageSaved && <Typography variant="caption" sx={{ color: "#2E7D32" }}>Saved ✓</Typography>}
                          </Box>
                        )}

                        <Typography variant="caption" sx={{ color: "#6b7280", display: "block", mt: 1.5 }}>QR code size</Typography>
                        <Slider size="small" min={20} max={70} value={qrSize}
                          onChange={(e, v) => setQrSize(v)} />
                      </>
                    )}
                  </Box>
                )}

                {activeTab === "branding" && fields.logo && (
                  <Box sx={{ bgcolor: "#EAF2FF", border: "1px solid #BFDBFE", borderRadius: 2, p: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                      {logoDataUrl && <img src={logoDataUrl} alt="logo" style={{ height: 32, borderRadius: 4 }} />}
                      <Button component="label" size="small" variant="outlined" sx={{ textTransform: "none" }}>
                        {logoDataUrl ? "Change logo" : "Upload logo"}
                        <input type="file" accept="image/*" hidden onChange={handleLogoUpload} />
                      </Button>
                    </Box>
                    {logoDataUrl && (
                      <>
                        <Typography variant="caption" sx={{ color: "#6b7280" }}>Position — horizontal</Typography>
                        <Slider size="small" min={0} max={100} value={logoPos.x}
                          onChange={(e, v) => setLogoPos({ ...logoPos, x: v })} sx={{ mb: 1 }} />
                        <Typography variant="caption" sx={{ color: "#6b7280" }}>Position — vertical</Typography>
                        <Slider size="small" min={0} max={100} value={logoPos.y}
                          onChange={(e, v) => setLogoPos({ ...logoPos, y: v })} sx={{ mb: 1 }} />
                        <Typography variant="caption" sx={{ color: "#6b7280" }}>Size</Typography>
                        <Slider size="small" min={10} max={60} value={logoSize}
                          onChange={(e, v) => setLogoSize(v)} />
                      </>
                    )}
                  </Box>
                )}

                {activeTab === "appearance" && (
                  <Box>
                    <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                      <ColorField label="Background" value={appearance.bg} onChange={(v) => setAppearance({ ...appearance, bg: v })} />
                      <ColorField label="Text" value={appearance.text} onChange={(v) => setAppearance({ ...appearance, text: v })} />
                      <ColorField label="Status/Action" value={appearance.accent} onChange={(v) => setAppearance({ ...appearance, accent: v })} />
                    </Box>
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>Font size ({appearance.fontSize}px)</Typography>
                    <Slider size="small" min={10} max={40} value={appearance.fontSize}
                      onChange={(e, v) => setAppearance({ ...appearance, fontSize: v })} sx={{ mb: 1 }} />
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <ToggleButton size="small" value="bold" selected={appearance.bold}
                        onChange={() => setAppearance({ ...appearance, bold: !appearance.bold })}>
                        <FormatBoldIcon fontSize="small" />
                      </ToggleButton>
                      <ToggleButtonGroup size="small" exclusive value={appearance.align}
                        onChange={(e, v) => v && setAppearance({ ...appearance, align: v })}>
                        <ToggleButton value="left"><FormatAlignLeftIcon fontSize="small" /></ToggleButton>
                        <ToggleButton value="center"><FormatAlignCenterIcon fontSize="small" /></ToggleButton>
                        <ToggleButton value="right"><FormatAlignRightIcon fontSize="small" /></ToggleButton>
                      </ToggleButtonGroup>
                    </Box>
                  </Box>
                )}

                {activeTab === "layout" && (
                  <Box>
                    <ToggleButtonGroup size="small" exclusive value={orientation} fullWidth
                      onChange={(e, v) => v && setOrientation(v)} sx={{ mb: 1.5 }}>
                      <ToggleButton value="horizontal">Horizontal</ToggleButton>
                      <ToggleButton value="vertical">Vertical</ToggleButton>
                    </ToggleButtonGroup>
                    <ToggleButtonGroup size="small" exclusive value={sizePreset}
                      onChange={(e, v) => v && setSizePreset(v)} sx={{ mb: 1.5, flexWrap: "wrap" }}>
                      <ToggleButton value="small">Small</ToggleButton>
                      <ToggleButton value="medium">Medium</ToggleButton>
                      <ToggleButton value="large">Large</ToggleButton>
                      <ToggleButton value="shelfSign">Shelf Sign</ToggleButton>
                      <ToggleButton value="custom">Custom</ToggleButton>
                    </ToggleButtonGroup>
                    <Box sx={{ display: "flex", gap: 1, mb: 1.5 }}>
                      <TextField size="small" type="number" label="Width (mm)" value={customSize.width}
                        onChange={(e) => { setCustomSize({ ...customSize, width: Number(e.target.value) }); setSizePreset("custom"); }} />
                      <TextField size="small" type="number" label="Height (mm)" value={customSize.height}
                        onChange={(e) => { setCustomSize({ ...customSize, height: Number(e.target.value) }); setSizePreset("custom"); }} />
                    </Box>
                    <TextField
                      size="small" type="number" label="Copies on this A4 sheet" fullWidth
                      value={copies} inputProps={{ min: 1, max: 60 }}
                      onChange={(e) => setCopies(Math.max(1, Number(e.target.value)))}
                      helperText="Tiled automatically — spills over to extra pages if it doesn't all fit."
                    />
                  </Box>
                )}
              </Box>
            </Box>

            {/* Preview */}
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", bgcolor: "#F8FAFC", borderRadius: 3, p: 4, gap: 2.5, minHeight: 420 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <IconButton onClick={() => goTemplate(-1)}><ChevronLeftIcon /></IconButton>
                <ScaledPreview maxBox={340} dims={dims} orientation={orientation}>
                  <LabelCard template={template} labelText={labelText} fields={fields} appearance={appearance} dims={dims} orientation={orientation} logoDataUrl={logoDataUrl} logoPos={logoPos} logoSize={logoSize} qrUrl={qrCustomUrl} qrSize={qrSize} categoryChip={categoryChip} qrMessageId={qrMessageHtml.trim() ? qrMessageId : ""} />
                </ScaledPreview>
                <IconButton onClick={() => goTemplate(1)}><ChevronRightIcon /></IconButton>
              </Box>
              <Typography variant="caption" sx={{ color: "#9ca3af" }}>
                {template.name} · {dims.width}×{dims.height}mm
              </Typography>
              <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", justifyContent: "center" }}>
                <Button variant="outlined" startIcon={<OpenWithIcon />} onClick={() => setArrangeOpen(true)}
                  sx={{ textTransform: "none", fontWeight: 600, borderRadius: "8px" }}>
                  Arrange on A4
                </Button>
                <Button variant="outlined" onClick={addToBatch}
                  sx={{ textTransform: "none", fontWeight: 600, borderRadius: "8px", borderColor: BLUE, color: BLUE }}>
                  + Add to Batch
                </Button>
                <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}
                  sx={{ textTransform: "none", fontWeight: 600, borderRadius: "8px", px: 3, bgcolor: BLUE, "&:hover": { bgcolor: "#1E3A8A" } }}>
                  Print Label
                </Button>
              </Box>
            </Box>
          </Box>

          {/* ---------- Suggested Labels (based on this medicine's categories) ---------- */}
          {selectedMed && (
            <>
              <Divider sx={{ my: 4 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>Suggested Labels for {selectedMed.name}</Typography>
              <Typography variant="caption" sx={{ color: "#6b7280", display: "block", mb: 2 }}>
                Based on this medicine's category — click one to apply it, pre-filled and ready.
              </Typography>
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                {(() => {
                  const cats = [...new Set(selectedMed.categories || getDrugCategories(selectedMed.name, selectedMed.code))];
                  const list = cats.length ? cats : ["Normal"];
                  return list.map((cat) => {
                    const style = CATEGORY_LABEL_STYLES[cat] || CATEGORY_LABEL_STYLES.Normal;
                    return (
                      <Paper key={cat} onClick={() => applyCategoryStyle(cat)} elevation={0}
                        sx={{ p: 1.5, borderRadius: 3, cursor: "pointer", textAlign: "center", border: "1px solid #e5e7eb", "&:hover": { borderColor: BLUE } }}>
                        <Box sx={{
                          width: 120, height: 70, borderRadius: 1.5, bgcolor: style.bg, color: style.text,
                          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, border: "1px solid #e5e7eb",
                        }}>
                          {selectedMed.name}
                        </Box>
                        <Typography variant="caption" sx={{ display: "block", mt: 1, fontWeight: 600 }}>{cat}</Typography>
                      </Paper>
                    );
                  });
                })()}
              </Box>
            </>
          )}

          {/* ---------- Label Examples gallery ---------- */}
          <Divider sx={{ my: 4 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Label Examples</Typography>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-end" }}>
            {TEMPLATES.map((tpl, idx) => (
              <Paper
                key={tpl.id} onClick={() => applyTemplate(idx)} elevation={0}
                sx={{
                  p: 1.5, borderRadius: 3, cursor: "pointer", textAlign: "center",
                  border: templateIndex === idx ? `2px solid ${BLUE}` : "1px solid #e5e7eb",
                  transition: "transform .15s", "&:hover": { transform: "translateY(-2px)" },
                }}
              >
                <ScaledPreview maxBox={140} dims={tpl.dims} orientation="horizontal">
                  <LabelCard template={tpl} labelText={buildLabelText(null, "", tpl)} fields={tpl.fields}
                    appearance={{ bg: tpl.bg, text: tpl.text, accent: tpl.accent, fontSize: 14, bold: true, align: "center" }}
                    dims={tpl.dims} orientation="horizontal" />
                </ScaledPreview>
                <Typography variant="caption" sx={{ color: "#6b7280", display: "block", mt: 1, maxWidth: 140 }}>{tpl.name}</Typography>
              </Paper>
            ))}
          </Box>
        </Paper>

        {/* ---------- Medicine list ---------- */}
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Medicines</Typography>
        <Box sx={{ display: "flex", gap: 2, mb: 1.5, flexWrap: "wrap" }}>
          <TextField
            size="small" placeholder="Search medicines..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            sx={{ minWidth: 260, bgcolor: "#fff" }}
          />
          <FormControl size="small" sx={{ minWidth: 180, bgcolor: "#fff" }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
              <MenuItem value="All">All</MenuItem>
              <MenuItem value="Safe">Safe</MenuItem>
              <MenuItem value="Near Expiry">Near Expiry</MenuItem>
              <MenuItem value="Expired">Expired</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180, bgcolor: "#fff" }}>
            <InputLabel>Category</InputLabel>
            <Select value={categoryFilter} label="Category" onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}>
              <MenuItem value="All">All</MenuItem>
              <MenuItem value="High Alert">High Alert</MenuItem>
              <MenuItem value="Hazardous">Hazardous</MenuItem>
              <MenuItem value="Sound Alike">Sound Alike</MenuItem>
              <MenuItem value="Look Alike">Look Alike</MenuItem>
              <MenuItem value="None">No category</MenuItem>
            </Select>
          </FormControl>
          <Button variant="outlined" onClick={addAllFilteredToBatch} disabled={rows.length === 0}
            sx={{ textTransform: "none", fontWeight: 600, borderColor: BLUE, color: BLUE }}>
            + Add all {rows.length} to Batch
          </Button>
        </Box>

        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: "1px solid #e5e7eb" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "#F5F9FF" }}>
                <TableCell sx={{ fontWeight: 700, width: 40 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Medicine</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Qty</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Expiry</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Label</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {medicinesLoading && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: "#9ca3af" }}>Loading medicines…</TableCell></TableRow>
              )}
              {!medicinesLoading && pagedRows.length === 0 && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: "#9ca3af" }}>No medicines match this filter.</TableCell></TableRow>
              )}
              {pagedRows.map(({ med, dates, statuses, categories }, idx) => (
                <TableRow key={med.id} hover selected={selectedMed?.id === med.id}>
                  <TableCell sx={{ color: "#9ca3af" }}>{page * rowsPerPage + idx + 1}</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{med.name}</Typography>
                      {med.otherNames && med.otherNames.length > 1 && (
                        <Tooltip
                          title={
                            <div>
                              <strong style={{ display: "block", marginBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: 3, color: "#60a5fa" }}>
                                Official Ministry Name & Alternatives:
                              </strong>
                              <div style={{ fontSize: "0.85rem", lineHeight: 1.5, fontWeight: "bold", color: "#f8fafc" }}>
                                {med.name} <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>(Official Ministry Name)</span>
                              </div>
                              {med.otherNames.filter((n) => n !== med.name).map((name, i) => (
                                <div key={i} style={{ fontSize: "0.8rem", lineHeight: 1.4, opacity: 0.9, marginTop: 2 }}>• {name}</div>
                              ))}
                            </div>
                          }
                          arrow
                        >
                          <IconButton size="small" color="primary"><InfoOutlinedIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      )}
                    </Box>
                    {med.code && <Typography variant="caption" sx={{ color: "#9ca3af", fontFamily: "monospace", display: "block" }}>{med.code}</Typography>}
                    {(med.labels?.length > 0 || categories.length > 0) && (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                        {med.labels?.map((label, i) => (
                          <Chip key={`l${i}`} size="small" label={`${label.icon || ""} ${label.name}`} sx={{ bgcolor: label.color, color: "#fff", fontWeight: 700 }} />
                        ))}
                        {categories.map((cat, i) => {
                          const style = CATEGORY_STYLE[cat] || { bg: "#ccc", text: "#fff", emoji: "" };
                          return <Chip key={`c${i}`} size="small" label={`${style.emoji}${cat}`} sx={{ bgcolor: style.bg, color: style.text, fontWeight: 700 }} />;
                        })}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell><Typography variant="body2">{med.quantity ?? "—"}</Typography></TableCell>
                  <TableCell>
                    {dates.map((date, i) => (
                      <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1, mb: i < dates.length - 1 ? 1 : 0 }}>
                        <Box>
                          <Typography variant="body2">{date || "—"}</Typography>
                          {date && <Chip label={statuses[i]} color={STATUS_CHIP[statuses[i]]} size="small" sx={{ mt: 0.3 }} />}
                        </Box>
                        <Tooltip title="Generate Label for this date">
                          <IconButton size="small" onClick={() => generateForDate(med, date, statuses[i])}
                            sx={{ bgcolor: "#EEF4FF", "&:hover": { bgcolor: "#DCE9FF" }, borderRadius: "8px" }}>
                            <LocalOfferIcon fontSize="small" sx={{ color: BLUE }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Add to batch (suggested category style)">
                          <IconButton size="small" onClick={() => {
                            const cat = categories[0] || "Normal";
                            const style = CATEGORY_LABEL_STYLES[cat] || CATEGORY_LABEL_STYLES.Normal;
                            setBatch((b) => [...b, {
                              id: `b${Date.now()}_${med.id}`,
                              labelText: { name: med.name, expiry: "", code: med.code || "", action: "", message: "", status: "" },
                              fields: { name: true, expiry: false, code: false, description: false, action: false, message: false, qr: fields.qr, barcode: fields.barcode, logo: true },
                              appearance: { bg: style.bg, text: style.text, accent: style.accent, fontSize: appearance.fontSize, bold: true, align: "center" },
                              dims: { ...dims }, orientation, categoryChip: style.chip, previewName: med.name,
                            }]);
                          }} sx={{ bgcolor: "#F0FDF4", "&:hover": { bgcolor: "#DCFCE7" }, borderRadius: "8px" }}>
                            <Typography sx={{ fontWeight: 800, color: "#16A34A", fontSize: 14, lineHeight: 1 }}>+</Typography>
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ))}
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="caption" sx={{ color: "#9ca3af" }}>↑ per date</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={rows.length}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </TableContainer>

        {/* ---------- GLOBAL FOOTER (تمت إضافته هنا بشكل احترافي ومتناسق) ---------- */}
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
      </Box>


      {/* ---------- Batch tray: queue multiple different labels for one A4 print ---------- */}
      {batch.length > 0 && (
        <Box className="no-print" sx={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20,
          bgcolor: "#fff", borderTop: `2px solid ${BLUE}`, boxShadow: "0 -4px 16px rgba(0,0,0,0.1)",
          px: 3, py: 1.5, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap",
        }}>
          <Typography sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{batch.length} queued</Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", flex: 1, overflowX: "auto", py: 0.5 }}>
            {batch.map((item) => (
              <Chip key={item.id} label={item.previewName} onDelete={() => removeFromBatch(item.id)}
                sx={{ bgcolor: item.appearance.bg, color: item.appearance.text, fontWeight: 700, border: "1px solid #e5e7eb" }} />
            ))}
          </Box>
          <Button size="small" onClick={() => setBatch([])} sx={{ textTransform: "none" }}>Clear</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: "8px", bgcolor: BLUE, "&:hover": { bgcolor: "#1E3A8A" } }}>
            Finish & Print ({batch.length})
          </Button>
        </Box>
      )}

      {/* ---------- Arrange on A4 dialog ---------- */}
      <ArrangeDialog
        open={arrangeOpen}
        onClose={() => setArrangeOpen(false)}
        onConfirm={confirmArrangement}
        dims={dims}
        orientation={orientation}
        arrangement={arrangement}
        template={template}
        labelText={labelText}
        fields={fields}
        appearance={appearance}
        logoDataUrl={logoDataUrl}
        logoPos={logoPos}
        logoSize={logoSize}
        qrUrl={qrCustomUrl}
        qrSize={qrSize}
        categoryChip={categoryChip}
        qrMessageId={qrMessageHtml.trim() ? qrMessageId : ""}
      />

      {/* ---------- Hidden A4 print sheet (visible only when printing) ---------- */}
      <Box id="print-sheet">
        {batch.length > 0
          ? batch.map((item) => (
              <LabelCard key={item.id} template={template} labelText={item.labelText} fields={item.fields} appearance={item.appearance}
                dims={item.dims} orientation={item.orientation} printMode logoDataUrl={logoDataUrl} logoPos={logoPos} logoSize={logoSize}
                qrUrl={qrCustomUrl} qrSize={qrSize} categoryChip={item.categoryChip} qrMessageId={qrMessageHtml.trim() ? qrMessageId : ""} />
            ))
          : Array.from({ length: copies }).map((_, i) => (
              <LabelCard key={i} template={template} labelText={labelText} fields={fields} appearance={appearance} dims={dims} orientation={orientation}
                printMode logoDataUrl={logoDataUrl} logoPos={logoPos} logoSize={logoSize} qrUrl={qrCustomUrl} qrSize={qrSize}
                categoryChip={categoryChip} qrMessageId={qrMessageHtml.trim() ? qrMessageId : ""} />
            ))}
      </Box>
    </Container>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: "#6b7280", display: "block", mb: 0.5 }}>{label}</Typography>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: 40, height: 32, border: "1px solid #e5e7eb", borderRadius: 6, padding: 2, cursor: "pointer" }} />
    </Box>
  );
}

function ScaledPreview({ dims, orientation, maxBox = 320, children }) {
  const width = orientation === "horizontal" ? dims.width : dims.height;
  const height = orientation === "horizontal" ? dims.height : dims.width;
  const pxW = mmToPx(width);
  const pxH = mmToPx(height);
  const scale = Math.min(1, maxBox / Math.max(pxW, pxH));
  return (
    <Box sx={{ width: pxW * scale, height: pxH * scale, position: "relative" }}>
      <Box sx={{ transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}>
        {children}
      </Box>
    </Box>
  );
}

function ArrangeDialog({ open, onClose, onConfirm, dims, orientation, arrangement, template, labelText, fields, appearance, logoDataUrl, logoPos, logoSize, qrUrl, qrSize, categoryChip, qrMessageId }) {
  const initW = orientation === "horizontal" ? dims.width : dims.height;
  const initH = orientation === "horizontal" ? dims.height : dims.width;

  const [box, setBox] = useState({ x: arrangement.x, y: arrangement.y, w: initW, h: initH });
  const dragInfo = useRef(null);

  useEffect(() => {
    if (open) setBox({ x: arrangement.x, y: arrangement.y, w: initW, h: initH });
  }, [open]);

  const canvasPxW = Math.min(560, typeof window !== "undefined" ? window.innerWidth * 0.75 : 560);
  const scale = canvasPxW / mmToPx(PAGE_W);
  const canvasPxH = mmToPx(PAGE_H) * scale;

  function pxToMm(px) {
    return px / (PXPERMM * scale);
  }

  function startDrag(e) {
    e.preventDefault();
    dragInfo.current = { mode: "move", startX: e.clientX, startY: e.clientY, orig: { ...box } };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function startResize(e) {
    e.preventDefault();
    e.stopPropagation();
    dragInfo.current = { mode: "resize", startX: e.clientX, startY: e.clientY, orig: { ...box } };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(e) {
    const info = dragInfo.current;
    if (!info) return;
    const dxMm = pxToMm(e.clientX - info.startX);
    const dyMm = pxToMm(e.clientY - info.startY);
    if (info.mode === "move") {
      const nx = Math.min(Math.max(0, info.orig.x + dxMm), PAGE_W - info.orig.w);
      const ny = Math.min(Math.max(0, info.orig.y + dyMm), PAGE_H - info.orig.h);
      setBox((b) => ({ ...b, x: nx, y: ny }));
    } else {
      const nw = Math.max(20, Math.min(info.orig.w + dxMm, PAGE_W - info.orig.x));
      const nh = Math.max(20, Math.min(info.orig.h + dyMm, PAGE_H - info.orig.y));
      setBox((b) => ({ ...b, w: nw, h: nh }));
    }
  }

  function onMouseUp() {
    dragInfo.current = null;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }

  function handleConfirm() {
    onConfirm({ width: Math.round(box.w), height: Math.round(box.h) }, { x: Math.round(box.x), y: Math.round(box.y) });
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        Arrange on A4
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: "#6b7280", mb: 2 }}>
          Drag the label to move it, drag the bottom-right corner to resize it. Copies fill the rest of the page starting from here.
        </Typography>
        <Box sx={{
          width: canvasPxW, height: canvasPxH, mx: "auto", position: "relative",
          bgcolor: "#fff", border: "1px solid #cbd5e1", boxShadow: "0 1px 6px rgba(0,0,0,0.1)",
        }}>
          <Box
            onMouseDown={startDrag}
            sx={{
              position: "absolute",
              left: box.x * PXPERMM * scale, top: box.y * PXPERMM * scale,
              width: box.w * PXPERMM * scale, height: box.h * PXPERMM * scale,
              cursor: "move",
            }}
          >
            <Box sx={{ width: box.w * PXPERMM, height: box.h * PXPERMM, pointerEvents: "none", transform: `scale(${scale})`, transformOrigin: "top left" }}>
              <LabelCard template={template} labelText={labelText} fields={fields} appearance={appearance}
                dims={{ width: box.w, height: box.h }} orientation="horizontal" logoDataUrl={logoDataUrl} logoPos={logoPos} logoSize={logoSize} qrUrl={qrUrl} qrSize={qrSize} categoryChip={categoryChip} qrMessageId={qrMessageId} />
            </Box>
            <Box
              onMouseDown={startResize}
              sx={{
                position: "absolute", right: -6, bottom: -6, width: 14, height: 14,
                bgcolor: BLUE, borderRadius: "3px", border: "2px solid #fff", cursor: "nwse-resize",
              }}
            />
          </Box>
        </Box>
        <Typography variant="caption" sx={{ color: "#9ca3af", display: "block", textAlign: "center", mt: 1.5 }}>
          {Math.round(box.w)}×{Math.round(box.h)}mm at ({Math.round(box.x)}, {Math.round(box.y)})mm from the top-left corner
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" onClick={handleConfirm}
          sx={{ textTransform: "none", fontWeight: 600, bgcolor: BLUE, "&:hover": { bgcolor: "#1E3A8A" } }}>
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function LabelCard({ template, labelText, fields, appearance, dims, orientation, printMode, logoDataUrl, logoPos, logoSize, qrUrl, qrSize, categoryChip, qrMessageId }) {
  const Icon = template.icon;
  const width = orientation === "horizontal" ? dims.width : dims.height;
  const height = orientation === "horizontal" ? dims.height : dims.width;
  const mainTitle = fields.name && labelText.name ? labelText.name : template.title;

  return (
    <Box
      sx={{
        width: `${width}mm`,
        height: `${height}mm`,
        bgcolor: appearance.bg,
        color: appearance.text,
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
        border: printMode ? "1px dashed #cbd5e1" : "1px solid #e5e7eb",
        borderRadius: "6px",
        boxShadow: printMode ? "none" : "0 1px 4px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        alignItems: appearance.align === "left" ? "flex-start" : appearance.align === "right" ? "flex-end" : "center",
        justifyContent: "center",
        textAlign: appearance.align,
        px: 2, py: 1.2, gap: 0.5,
        overflow: "hidden",
        position: "relative",
        fontFamily: "Roboto, Arial, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {fields.logo && logoDataUrl && (
        <Box sx={{
          position: "absolute",
          left: `${(logoPos?.x ?? 15)}%`, top: `${(logoPos?.y ?? 85)}%`,
          transform: "translate(-50%, -50%)",
        }}>
          <img src={logoDataUrl} alt="logo" style={{ height: mmToPx(Math.min(width, height)) * ((logoSize ?? 28) / 100), maxWidth: mmToPx(width) * 0.5, objectFit: "contain" }} />
        </Box>
      )}
      {categoryChip && (
        <Box sx={{
          position: "absolute", bottom: 4,
          left: (logoPos?.x ?? 15) > 50 ? 4 : "auto",
          right: (logoPos?.x ?? 15) > 50 ? "auto" : 4,
        }}>
          <Box sx={{
            bgcolor: "#FFD54F", color: "#000", fontWeight: 700, fontSize: "10px",
            borderRadius: "10px", px: 1, py: 0.3, display: "flex", alignItems: "center", gap: 0.4,
            WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
          }}>
            <span>{categoryChip.icon}</span> {categoryChip.label}
          </Box>
        </Box>
      )}
      {fields.qr && (qrUrl?.trim() || labelText.code || labelText.name) && (
        <Box sx={{ position: "absolute", bottom: 4, right: 4, bgcolor: "#fff", p: "3px", borderRadius: "3px", lineHeight: 0 }}>
          <QRCodeSVG
            value={qrUrl?.trim()
              ? qrUrl.trim()
              : `${typeof window !== "undefined" ? window.location.origin : ""}/scan-result?code=${encodeURIComponent(labelText.code || labelText.name)}${qrMessageId ? `&msg=${qrMessageId}` : ""}`}
            size={Math.max(40, mmToPx(Math.min(width, height)) * ((qrSize ?? 40) / 100))}
            level="H"
          />
        </Box>
      )}
      {!fields.name && <Icon sx={{ color: appearance.accent, fontSize: `${appearance.fontSize + 14}px` }} />}
      <Box sx={{
        fontWeight: appearance.bold ? 800 : 600,
        fontSize: `${appearance.fontSize + (fields.name ? 2 : 4)}px`,
        whiteSpace: "pre-line", lineHeight: 1.25,
      }}>
        {mainTitle}
      </Box>
      {fields.name && labelText.status && (
        <Box sx={{ color: appearance.accent, fontWeight: 700, fontSize: `${appearance.fontSize}px` }}>
          {labelText.status.toUpperCase()}
        </Box>
      )}
      {fields.description && template.description && (
        <Box sx={{ fontSize: `${appearance.fontSize - 2}px`, opacity: 0.85, maxWidth: "90%" }}>
          {template.description}
        </Box>
      )}
      {fields.expiry && (
        <Box sx={{
          display: "flex", alignItems: "center", gap: 0.5, mt: 0.3,
          border: `1px solid ${appearance.accent}55`, borderRadius: "4px", px: 1, py: 0.3,
          fontSize: `${appearance.fontSize - 1}px`,
        }}>
          <CalendarMonthIcon sx={{ fontSize: `${appearance.fontSize}px`, color: appearance.accent }} />
          EXP: {labelText.expiry || "____/____/______"}
        </Box>
      )}
      {fields.code && labelText.code && (
        <Box sx={{ fontSize: `${appearance.fontSize - 4}px`, fontFamily: "monospace", color: "#6b7280" }}>
          {labelText.code}
        </Box>
      )}
      {fields.barcode && (labelText.code || labelText.name) && (
        <Box sx={{ width: "100%", display: "flex", justifyContent: "center", lineHeight: 0, my: 0.3 }}>
          <Barcode
            value={labelText.code || labelText.name}
            format="CODE128"
            width={1.3}
            height={Math.max(20, mmToPx(height) * 0.18)}
            fontSize={Math.max(8, appearance.fontSize - 5)}
            margin={0}
            background="transparent"
            lineColor={appearance.text}
          />
        </Box>
      )}
      {(fields.action && labelText.action) || (fields.message && labelText.message) ? (
        <Box sx={{
          mt: "auto", width: "100%", bgcolor: appearance.accent, color: "#fff",
          WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
          fontWeight: 800, fontSize: `${appearance.fontSize + 1}px`,
          textAlign: "center", borderRadius: "3px", py: 0.5, letterSpacing: 0.5,
        }}>
          {fields.action && labelText.action ? labelText.action : labelText.message}
        </Box>
      ) : null}
    </Box>
  );
}