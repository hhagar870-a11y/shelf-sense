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
  Snackbar,
  Alert,
} from "@mui/material";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import PrintIcon from "@mui/icons-material/Print";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import EditIcon from "@mui/icons-material/Edit";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import PaletteIcon from "@mui/icons-material/Palette";
import AspectRatioIcon from "@mui/icons-material/AspectRatio";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
// Reverted to MUI's real, tested icons — the hand-drawn SVG paths I tried
// rendered as an unrecognizable teardrop/blob instead of an ear/eye.

import { AlertCircle as ErrorOutline, Ear, AlertTriangle } from "lucide-react";
import DoNotDisturbAltIcon from "@mui/icons-material/DoNotDisturbAlt";
import GroupsIcon from "@mui/icons-material/Groups";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import OpenWithIcon from "@mui/icons-material/OpenWith";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate } from "react-router-dom";

import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getDrugCategories } from "../data/getDrugCategories";
import { findTallManSuggestion } from "../data/tallManDrugs";

// أيقونة "Look Alike" مرسومة يدوي عشان تطابق نفس شكلها بالانفنتوري بالضبط
// (نفس الـ SVG المستخدم هناك — عين + بؤبؤ فيه "لمعة" بالزاوية)
function LookAlikeEyeIcon({ size = 16, color = "#000", strokeWidth = 2.2, bgColor = "#FFD54F" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2 12S5.5 5 12 5s10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="4.6" fill={color} />
      <circle cx="13.6" cy="10.1" r="1.5" fill={bgColor} />
    </svg>
  );
}

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

// Exact wording/day-math the Inventory page already uses for its status-chip
// hover tooltip, so both pages say the same thing for the same date.
function getCountdownText(expiry) {
  if (!expiry) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(expiry);
  expiryDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round((expiryDate - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    const daysAgo = Math.abs(diffDays);
    return `Expired ${daysAgo} ${daysAgo === 1 ? "day" : "days"} ago`;
  }
  if (diffDays === 0) return "Expires today";
  if (diffDays >= 30) {
    const months = Math.floor(diffDays / 30);
    const remainingDays = diffDays % 30;
    const monthsText = `${months} ${months === 1 ? "month" : "months"}`;
    return remainingDays > 0
      ? `${monthsText} and ${remainingDays} ${remainingDays === 1 ? "day" : "days"} left`
      : `${monthsText} left`;
  }
  return `${diffDays} ${diffDays === 1 ? "day" : "days"} left`;
}

// Same "1 … 4 5 [6] 7 8 … 20" page-number list the Inventory page uses,
// instead of MUI's plain TablePagination, for a consistent pagination bar.
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
      if (i - last === 2) withDots.push(last + 1);
      else if (i - last > 1) withDots.push("…");
    }
    withDots.push(i);
    last = i;
  });
  return withDots;
}

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
  Hazardous: { bg: "#9269F6", text: "#fff", accent: "#fff", chip: { category: "Hazardous", label: "Hazardous" } },
  "High Alert": { bg: "#DA2E20", text: "#fff", accent: "#fff", chip: { category: "High Alert", label: "High Alert" } },
  "Sound Alike": { bg: "#FFFF55", text: "#000", accent: "#000", chip: { category: "Sound Alike", label: "Sound Alike" } },
  "Look Alike": { bg: "#FFFF55", text: "#000", accent: "#000", chip: { category: "Look Alike", label: "Look Alike" } },
  Normal: { bg: "#FFFFFF", text: "#111827", accent: "#1D4ED8", chip: null },
};

// A medicine can carry more than one category tag (e.g. Hazardous AND High
// Alert AND Look Alike all at once). Sound/Look Alike never gets its own
// card — it rides along as a small corner badge on top of whichever card is
// used. But if a medicine has BOTH High Alert AND Hazardous, those are two
// genuinely different colours/meanings, so we offer one full card per
// primary colour and let the user pick — never silently drop one to a tiny
// badge.
const CATEGORY_PRIORITY = ["High Alert", "Hazardous", "Sound Alike", "Look Alike"];
const PRIMARY_CATS = ["High Alert", "Hazardous"];
function resolveCategoryLook(cats) {
  const secondaryBadges = CATEGORY_PRIORITY.filter((c) => c === "Sound Alike" || c === "Look Alike").filter((c) => cats.includes(c));
  const primaryOptions = PRIMARY_CATS.filter((c) => cats.includes(c));
  if (primaryOptions.length > 0) {
    return primaryOptions.map((base) => ({ base, badges: secondaryBadges }));
  }
  if (secondaryBadges.length > 0) {
    // Only "Look Alike" gets a solid yellow sticker of its own (matches the
    // approved solid-yellow sticker). "Sound Alike" alone is a WHITE/Normal
    // sticker with the "Sound Alike" badge on it — never a yellow sticker.
    if (cats.includes("Look Alike")) {
      return [{ base: "Look Alike", badges: secondaryBadges.filter((c) => c !== "Look Alike") }];
    }
    return [{ base: "Normal", badges: secondaryBadges }];
  }
  return [{ base: "Normal", badges: [] }];
}

const SIZE_PRESETS = {
  small: { width: 50, height: 30 },
  medium: { width: 70, height: 45 },
  large: { width: 100, height: 60 },
  shelfSign: { width: 150, height: 150 },
};

const TEMPLATES = [
  {
    id: "near-expiry",
    name: "Near Expiry Label",
    icon: WarningAmberIcon,
    bg: "#FDF6EC", text: "#B3261E", accent: "#ED6C02",
    title: "NEAR EXPIRY",
    dims: { width: 90, height: 58 },
    fields: { name: true, expiry: true, code: false, status: true, action: true, message: false, qr: false, barcode: false, logo: false },
    action: "USE FIRST",
  },
  {
    id: "expired",
    name: "Expired Label",
    icon: ErrorOutline,
    bg: "#FDECEA", text: "#7A0C0C", accent: "#D32F2F",
    title: "EXPIRED",
    dims: { width: 90, height: 58 },
    fields: { name: true, expiry: true, code: false, status: true, action: true, message: false, qr: false, barcode: false, logo: false },
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

// Splits a free-typed medication name like "Epinephrine 1mg/1ml ampoule" into
// [Name, Strength, Dosage form] so the printed label matches the approved
// layout (one line each). Falls back to the original text untouched if no
// strength/form pattern is recognized, so any free text still edits fine.
const DOSAGE_FORMS = [
  "ampoule", "ampule", "vial", "tablet", "tab", "capsule", "cap", "syringe", "syring",
  "injection", "inj", "cream", "gel", "ointment", "solution", "sol", "suspension", "susp",
  "drops", "drop", "patch", "inhaler", "spray", "lotion", "powder", "sachet", "suppository", "bottle",
  "syrup", "elixir", "emulsion", "foam", "aerosol", "gargle", "mouthwash", "shampoo", "paste",
  "granules", "pessary", "enema", "lozenge", "chewable", "liquid",
];
function splitMedicationText(text) {
  if (!text || !text.trim()) return [text || ""];
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return [text];

  let formIdx = -1;
  for (let i = words.length - 1; i >= 0; i--) {
    if (DOSAGE_FORMS.includes(words[i].toLowerCase().replace(/[.,]/g, ""))) { formIdx = i; break; }
  }
  let strengthStart = -1, strengthEnd = -1;
  for (let i = 0; i < words.length; i++) {
    if (/\d/.test(words[i])) { if (strengthStart === -1) strengthStart = i; strengthEnd = i; }
  }
  if (formIdx === -1 && strengthStart === -1) return [text]; // nothing recognized — keep as one line

  const nameEnd = strengthStart !== -1 ? strengthStart : formIdx;
  const name = words.slice(0, nameEnd).join(" ");
  const strengthWordEnd = formIdx !== -1 ? formIdx : strengthEnd + 1;
  const strength = strengthStart !== -1 ? words.slice(strengthStart, strengthWordEnd).join(" ") : "";
  const form = formIdx !== -1 ? words.slice(formIdx).join(" ") : words.slice(strengthEnd + 1).join(" ");
  const lines = [name, strength, form].filter(Boolean);
  return lines.length ? lines : [text];
}

export default function LabelPrinting() {
  const navigate = useNavigate();
  const [medicines, setMedicines] = useState([]);
  const [medicinesLoading, setMedicinesLoading] = useState(true);
  // تنبيه هادئ لو حفظ إعداد (شعار الصيدلية أو رسالة QR) فشل فعليًا بفايرستور
  // — بدونه، الإعداد يضل ظاهر بالشاشة (لأنه انحفظ محليًا فورًا) والمستخدم
  // يفتكر إنه انحفظ بالسيرفر وهو ما انحفظ، ويكتشف بس بعد تحديث الصفحة
  const [settingsSaveError, setSettingsSaveError] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const [selectedMed, setSelectedMed] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [templateIndex, setTemplateIndex] = useState(0);
  const template = TEMPLATES[templateIndex];

  const [fields, setFields] = useState(TEMPLATES[0].fields);
  const [labelText, setLabelText] = useState(buildLabelText(null, "", TEMPLATES[0]));

  // اقتراح Tall Man Lettering لاسم الدواء الحالي — يشتغل تلقائيًا سواء كتبتي
  // الاسم يدويًا أو اخترتي دواء من القائمة تحت، لأن الاثنين يحدّثون
  // labelText.name بنفس الطريقة
  const tallManSuggestion = useMemo(
    () => findTallManSuggestion(labelText.name),
    [labelText.name]
  );

  // يستبدل بداية الاسم بصيغة Tall Man الرسمية، ويسيب الباقي (التركيز/الشكل
  // الصيدلاني) زي ما هو — بما إن الاستبدال بس بحروف كبيرة/صغيرة، طول النص
  // ما يتغير فنقدر نعتمد على نفس عدد الأحرف
  function applyTallManCasing() {
    if (!tallManSuggestion) return;
    const tallManName = tallManSuggestion.tallManName;
    const current = labelText.name;
    const updated = tallManName + current.slice(tallManName.length);
    setLabelText((prev) => ({ ...prev, name: updated }));
  }

  const [appearance, setAppearance] = useState({
    bg: TEMPLATES[0].bg, text: TEMPLATES[0].text, accent: TEMPLATES[0].accent,
    fontSize: 16, bold: true, align: "center",
  });

  const [orientation, setOrientation] = useState("horizontal");
  // True once the person uses "Rotate 90°" / "Paper-saving" in the Arrange
  // dialog — unlike `orientation` (which only swaps width/height), this
  // means the label GRAPHIC itself is spun 90° (via RotatableLabel) so text
  // and badges rotate with it instead of just being squeezed into a
  // differently-shaped box.
  const [rotated, setRotated] = useState(false);
  const [sizePreset, setSizePreset] = useState("custom");
  const [customSize, setCustomSize] = useState(TEMPLATES[0].dims);
  const [copies, setCopies] = useState(12);
  const [arrangement, setArrangement] = useState({ x: 0, y: 0 });
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("content");
  // Which content field's settings panel is open — only one at a time,
  // so checking several boxes in a row doesn't stack every panel at once.
  const [expandedField, setExpandedField] = useState(null);
  const [logoDataUrl, setLogoDataUrl] = useState("");
  // Default corner matches the approved sticker: logo bottom-right, in its own small white strip.
  const [logoPos, setLogoPos] = useState({ x: 82, y: 87 });
  const [logoSize, setLogoSize] = useState(20);
  const [logoBg, setLogoBg] = useState(true); // white backing behind the logo, like the approved sticker
  const [qrCustomUrl, setQrCustomUrl] = useState("");
  const [qrSize, setQrSize] = useState(35);
  // Opposite corner from the logo's default, so they never start out overlapping.
  const [qrPos, setQrPos] = useState({ x: 20, y: 87 });
  // Custom Message used to live inline in the centered content column, so
  // turning it on/off (or it just wrapping to another line) shifted the
  // medicine name up/down. It now has its own free-floating position, same
  // as the logo/QR, so it never disturbs the rest of the layout.
  const [messagePos, setMessagePos] = useState({ x: 50, y: 90 });
  const [namePos, setNamePos] = useState({ x: 50, y: 48 });
  // نسبة تكبير/تصغير خط اسم الدواء بس (100% = الحجم الافتراضي) — مستقلة عن
  // appearance.fontSize العام، بنفس فكرة logoSize
  const [nameSize, setNameSize] = useState(130);
  // Live preview values the on-screen card follows WHILE dragging a slider —
  // the committed logoPos/qrPos (which re-renders the whole editor) only
  // updates once, on release.
  const [liveLogoPos, setLiveLogoPos] = useState(logoPos);
  const [liveLogoSize, setLiveLogoSize] = useState(logoSize);
  const [liveQrPos, setLiveQrPos] = useState(qrPos);
  const [liveQrSize, setLiveQrSize] = useState(qrSize);
  const [liveMessagePos, setLiveMessagePos] = useState(messagePos);
  const [liveNamePos, setLiveNamePos] = useState(namePos);
  const [liveNameSize, setLiveNameSize] = useState(nameSize);
  useEffect(() => setLiveLogoPos(logoPos), [logoPos]);
  useEffect(() => setLiveLogoSize(logoSize), [logoSize]);
  useEffect(() => setLiveQrPos(qrPos), [qrPos]);
  useEffect(() => setLiveQrSize(qrSize), [qrSize]);
  useEffect(() => setLiveMessagePos(messagePos), [messagePos]);
  useEffect(() => setLiveNamePos(namePos), [namePos]);
  useEffect(() => setLiveNameSize(nameSize), [nameSize]);
  const [categoryChips, setCategoryChips] = useState([]);
  const [showCategoryBadge, setShowCategoryBadge] = useState(true);
  // Tracks a manually-picked category (for medicines not tagged in the
  // system yet) and any badges layered on top of it, independent of the
  // auto-detected suggested-label options.
  const [manualCategoryBase, setManualCategoryBase] = useState(null);
  const [manualCategoryBadges, setManualCategoryBadges] = useState([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  // When printing from the review carousel, only the cards the user
  // actually stepped through get sent to the printer — null means "print
  // everything" (used by the plain single-label / non-batch print paths).
  const [printSubsetIds, setPrintSubsetIds] = useState(null);
  // Whether the batch should print with one shared QR link instead of each
  // label's own — off by default so every medicine keeps its own link.
  const [batchUnifyQr, setBatchUnifyQr] = useState(false);
  const [batchUnifiedQrUrl, setBatchUnifiedQrUrl] = useState("");
  // Checklist so the user can track which medicines in the shelf list
  // they've already printed/handled — persisted in localStorage so a mark
  // survives leaving the page and coming back (only cleared when the user
  // unmarks it themselves).
  const DONE_MEDS_STORAGE_KEY = "labelPrinting.doneMeds";
  const [doneMeds, setDoneMeds] = useState(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(DONE_MEDS_STORAGE_KEY) : null;
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });
  function toggleDone(id) {
    setDoneMeds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { window.localStorage.setItem(DONE_MEDS_STORAGE_KEY, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  }
  // The hidden #print-sheet only gets real, heavy content (QR/barcode SVGs for
  // every batch item) right before printing — not on every batch edit — so
  // adding many labels to the batch stays fast.
  const [printReady, setPrintReady] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [batch, setBatch] = useState([]);
  const [qrMessageHtml, setQrMessageHtml] = useState("");
  const [qrMessageId] = useState(() => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const [qrMessageSaved, setQrMessageSaved] = useState(false);
  // The contentEditable box used to call setQrMessageHtml on every single
  // keystroke, which re-rendered the whole heavy editor tree each time and
  // was the real cause of the typing lag. Debounce it like the other text
  // fields; flush immediately on blur so a quick type-then-click never
  // saves stale text.
  const qrMsgTimerRef = useRef(null);
  function handleQrMsgInput(e) {
    const html = e.currentTarget.innerHTML;
    if (qrMsgTimerRef.current) clearTimeout(qrMsgTimerRef.current);
    qrMsgTimerRef.current = setTimeout(() => setQrMessageHtml(html), 400);
  }

  async function saveQrMessage(htmlOverride) {
    if (qrMsgTimerRef.current) { clearTimeout(qrMsgTimerRef.current); qrMsgTimerRef.current = null; }
    const html = htmlOverride !== undefined ? htmlOverride : qrMessageHtml;
    if (htmlOverride !== undefined) setQrMessageHtml(htmlOverride);
    if (!html.trim()) return;
    try {
      await setDoc(doc(db, "qrMessages", qrMessageId), { html, updatedAt: Date.now() });
      setQrMessageSaved(true);
    } catch (err) {
      console.error("Failed to save QR message:", err);
      setSettingsSaveError(true);
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
        setSettingsSaveError(true);
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
    setCategoryChips([]);
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
    setRotated(false);
    setCategoryChips([]);
    document.getElementById("label-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const EXPANDABLE_FIELDS = ["name", "action", "message", "qr"];
  function toggleField(key) {
    setFields((f) => {
      const next = { ...f, [key]: !f[key] };
      // Action and Custom Message occupy the same slot on the label —
      // turning one on should turn the other off instead of silently
      // losing to whichever has leftover text.
      if (key === "message" && next.message) next.action = false;
      if (key === "action" && next.action) next.message = false;
      // QR والباركود الطولي يشتركون بنفس مكان/حجم التحكم بالليبل (نفس
      // qrPos/qrSize) فما ينفع الاثنين يشتغلون بنفس الوقت
      if (key === "qr" && next.qr) next.barcode = false;
      if (key === "barcode" && next.barcode) next.qr = false;
      return next;
    });
    // Checking an expandable field opens its panel (and closes any other,
    // so only one settings panel is ever open at a time); unchecking it
    // closes the panel if it was the one open.
    setExpandedField((cur) => {
      const turningOn = !fields[key];
      if (EXPANDABLE_FIELDS.includes(key)) return turningOn ? key : (cur === key ? null : cur);
      return cur;
    });
  }

  // Apply the medicine's resolved look (solid colour + optional small badge),
  // used both for the "Suggested Labels" row and the batch select-all.
  // Explicitly clears leftover action/message/expiry/status from whatever
  // template was active before, so the bottom message bar doesn't appear
  // uninvited.
  // Applies one specific suggested-label option (a single {base, badges}
  // choice, e.g. "High Alert card" vs "Hazardous card") — used by whichever
  // card in the Suggested Label strip the user clicks, and by the batch
  // auto-add flows (which just take the first/default option).
  function applyCategoryStyle({ base, badges }, withBadge = showCategoryBadge) {
    const style = CATEGORY_LABEL_STYLES[base] || CATEGORY_LABEL_STYLES.Normal;
    setFields((f) => ({ ...f, name: true, logo: true, action: false, message: false, expiry: false, status: false }));
    setAppearance((a) => ({ ...a, bg: style.bg, text: style.text, accent: style.accent }));
    setCategoryChips(withBadge ? badges.map((b) => CATEGORY_LABEL_STYLES[b].chip) : []);
  }

  function addToBatch() {
    setBatch((b) => [...b, {
      id: `b${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      labelText: { ...labelText },
      fields: { ...fields },
      appearance: { ...appearance },
      dims: { ...dims },
      orientation,
      rotated,
      categoryChips,
      badgesAvailable: categoryChips,
      categories: selectedMed ? [...new Set(selectedMed.categories || getDrugCategories(selectedMed.name, selectedMed.code))] : [],
      // Captured at add-time so each queued label keeps its OWN QR link —
      // it doesn't silently pick up whatever link is in the editor later.
      qrUrl: qrCustomUrl,
      qrMessageId: qrMessageHtml.trim() ? qrMessageId : "",
      previewName: labelText.name || template.title,
    }]);
    // Copies only applies to the single-label fallback print — once
    // something's queued in the batch, reset it to 1 so it doesn't sit at
    // a misleadingly high number that has nothing to do with the batch.
    setCopies(1);
  }

  function removeFromBatch(id) {
    setBatch((b) => b.filter((item) => item.id !== id));
  }

  function addAllFilteredToBatch() {
    const items = rows.map(({ med, categories }, idx) => {
      const { base, badges } = resolveCategoryLook(categories)[0];
      const style = CATEGORY_LABEL_STYLES[base] || CATEGORY_LABEL_STYLES.Normal;
      const badgeChipDefs = badges.map((b) => CATEGORY_LABEL_STYLES[b].chip);
      return {
        // idx guarantees uniqueness even when Date.now() is identical across
        // this whole synchronous loop and/or the same med.id repeats (e.g.
        // the same drug listed under more than one expiry date) — duplicate
        // ids caused real React key collisions (misaligned/ghosted cards).
        id: `b${Date.now()}_${idx}_${med.id}`,
        labelText: { name: med.name, expiry: "", code: med.code || "", action: "", message: "", status: "" },
        fields: { name: true, expiry: false, code: false, description: false, status: false, action: false, message: false, qr: fields.qr, barcode: fields.barcode, logo: true },
        appearance: { bg: style.bg, text: style.text, accent: style.accent, fontSize: appearance.fontSize, bold: true, align: "center" },
        dims: { ...dims },
        orientation,
        rotated,
        categoryChips: showCategoryBadge ? badgeChipDefs : [],
        badgesAvailable: badgeChipDefs,
        categories,
        // Left blank on purpose — each label then auto-generates its OWN
        // scan link from its own medicine code/name, so a batch of many
        // different medicines never all points to one shared link.
        qrUrl: "",
        qrMessageId: "",
        previewName: med.name,
      };
    });
    setBatch((b) => [...b, ...items]);
  }

  useEffect(() => {
    if (!fields.logo && !fields.qr && !fields.barcode && !fields.name && activeTab === "branding") setActiveTab("content");
  }, [fields.logo, activeTab]);

  useEffect(() => {
    const reset = () => { setPrintReady(false); setPrintSubsetIds(null); };
    window.addEventListener("afterprint", reset);
    return () => window.removeEventListener("afterprint", reset);
  }, []);

  function handlePrint() {
    setPrintReady(true);
    // Let the print-sheet mount with real content before invoking the browser dialog.
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  function confirmArrangement(newDims, newArrangement, newRotated) {
    setCustomSize(newDims);
    setSizePreset("custom");
    setOrientation("horizontal");
    setArrangement(newArrangement);
    setRotated(!!newRotated);
    setArrangeOpen(false);
  }

  const fieldMeta = [
    { key: "name", label: "Medication Name" },
    { key: "expiry", label: "Expiry Date" },
    { key: "code", label: "NUPCO Code" },
    { key: "status", label: "Status (Expired / Near Expiry)" },
    { key: "action", label: "Action / Instruction" },
    { key: "message", label: "Custom Message" },
    { key: "qr", label: "QR Code (scan for details)" },
    { key: "barcode", label: "Linear Barcode (Code128, for scanner)" },
    { key: "logo", label: "Cluster Logo" },
  ];

  return (
    <Container maxWidth="xl" sx={{ mt: 3, mb: 5 }}>
      <style>{`
        @page { size: A4; margin: 6mm; }
        @media screen { #print-sheet { display: none; } }
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          body * { visibility: hidden; }
          #print-sheet, #print-sheet * { visibility: visible; }
          #print-sheet {
            display: flex !important;
            flex-wrap: wrap;
            align-items: flex-start;
            align-content: flex-start;
            gap: 4mm;
            position: absolute; top: ${arrangement.y}mm; left: ${arrangement.x}mm;
            width: calc(${PAGE_W}mm - ${arrangement.x}mm - 5mm);
          }
          /* Never split a single label across two pages — push it whole
             onto the next page instead of printing half of it. */
          #print-sheet > * {
            page-break-inside: avoid;
            break-inside: avoid;
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
                {labelText.status && (
                  <Tooltip title={getCountdownText(labelText.expiry)} arrow placement="top">
                    <Chip size="small" label={labelText.status} color={STATUS_CHIP[labelText.status]} sx={{ cursor: "pointer" }} />
                  </Tooltip>
                )}
                <Button size="small" onClick={() => {
                  setSelectedMed(null);
                  setSelectedDate("");
                  setLabelText(buildLabelText(null, "", template));
                  setCategoryChips([]);
                  setAppearance((a) => ({ ...a, bg: CATEGORY_LABEL_STYLES.Normal.bg, text: CATEGORY_LABEL_STYLES.Normal.text, accent: CATEGORY_LABEL_STYLES.Normal.accent }));
                }} sx={{ textTransform: "none", ml: "auto" }}>
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
            <Box sx={{ width: { xs: "100%", md: 460 }, flexShrink: 0 }}>
              <Tabs
                value={activeTab} onChange={(e, v) => setActiveTab(v)}
                variant="standard"
                sx={{ borderBottom: "1px solid #e5e7eb", mb: 2, minHeight: 40, "& .MuiTabs-flexContainer": { flexWrap: "wrap" } }}
              >
                <Tab value="content" label="Content" sx={{ textTransform: "none", minHeight: 40, fontWeight: 700 }} />
                {(fields.logo || fields.qr || fields.barcode || fields.name) && (
                  <Tab value="branding" label="✎ Position" sx={{
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
                        <Box key={f.key} sx={{ display: "flex", alignItems: "center" }}>
                          <FormControlLabel sx={{ flex: 1 }}
                            control={<Checkbox size="small" checked={fields[f.key]} onChange={() => toggleField(f.key)} />}
                            label={<Typography variant="body2">{f.label}</Typography>}
                          />
                          {EXPANDABLE_FIELDS.includes(f.key) && fields[f.key] && (
                            <Tooltip title={expandedField === f.key ? "Close" : "Edit"}>
                              <IconButton size="small"
                                onClick={() => setExpandedField((cur) => (cur === f.key ? null : f.key))}
                                sx={{ color: expandedField === f.key ? BLUE : "#9ca3af" }}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      ))}
                    </Box>
                    {fields.qr && (
                      <Typography variant="caption" sx={{ color: "#9ca3af", display: "block", mt: -0.5, mb: 1, ml: 4 }}>
                        Note: if printed very small, some mobile phone cameras may not be able to scan this QR code.
                      </Typography>
                    )}
                    {(fields.logo || fields.qr || fields.barcode || fields.message || fields.name) && (
                      <Typography variant="caption" sx={{ color: "#1D4ED8", display: "block", mt: -0.5, mb: 1, ml: 4, fontWeight: 600 }}>
                        → Edit position & size in the ✎ Position tab above
                      </Typography>
                    )}
                    {fields.name && expandedField === "name" && (
                      <DebouncedTextField fullWidth multiline minRows={2} maxRows={5} label="Medication Name" sx={{ mt: 1 }}
                        helperText="Edit freely — trim the strength/dosage if you don't want it shown, or press Enter to control the line breaks yourself."
                        value={labelText.name} onCommit={(v) => setLabelText({ ...labelText, name: v })} />
                    )}
                    {/* اقتراح Tall Man Lettering: يطلع بس لو الاسم موجود بقائمة
                        Sound-Alike المعتمدة بسياسة المستشفى، ويختفي أول ما
                        الاسم أصلاً مكتوب بنفس الصيغة الصحيحة */}
                    {fields.name && tallManSuggestion && (
                      <Box
                        onClick={applyTallManCasing}
                        sx={{
                          display: "flex", alignItems: "flex-start", gap: 0.7,
                          mt: 1, mb: 0.5, px: 1.2, py: 0.8,
                          bgcolor: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "8px",
                          cursor: "pointer", "&:hover": { bgcolor: "#FEF3C7" },
                        }}
                      >
                        <WarningAmberIcon sx={{ fontSize: 16, color: "#B45309", mt: "1px" }} />
                        <Typography sx={{ fontSize: 12, color: "#78350F", lineHeight: 1.5 }}>
                          Sound-Alike — Tall Man Lettering: <b>{tallManSuggestion.tallManName}</b>
                          {tallManSuggestion.confusedWith.length > 0 && (
                            <> — confused with: <b>{tallManSuggestion.confusedWith.join(", ")}</b></>
                          )}
                          {" — "}<u>click to apply</u>
                        </Typography>
                      </Box>
                    )}
                    {fields.action && expandedField === "action" && (
                      <DebouncedTextField fullWidth size="small" label="Action / Instruction" sx={{ mt: 1.5 }}
                        value={labelText.action} onCommit={(v) => setLabelText({ ...labelText, action: v })} />
                    )}
                    {fields.message && expandedField === "message" && (
                      <DebouncedTextField fullWidth size="small" label="Custom message" sx={{ mt: 1.5 }}
                        placeholder="e.g. CHECK BEFORE DISPENSING"
                        value={labelText.message} onCommit={(v) => setLabelText({ ...labelText, message: v })} />
                    )}
                    {fields.qr && expandedField === "qr" && (
                      <>
                        <DebouncedTextField fullWidth size="small" label="Link for this QR code" sx={{ mt: 1.5 }}
                          placeholder="Attach the link this QR should open — e.g. https://..."
                          helperText={qrCustomUrl.trim()
                            ? "Scanning the QR will open this link."
                            : "Nothing attached yet — this label's QR will auto-link to this medicine's own info page until you add one."}
                          value={qrCustomUrl} onCommit={(v) => setQrCustomUrl(v)} />

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
                              onInput={handleQrMsgInput}
                              onBlur={(e) => saveQrMessage(e.currentTarget.innerHTML)}
                              sx={{
                                minHeight: 70, border: "1px solid #e5e7eb", borderRadius: 1.5, p: 1.5, fontSize: 14,
                                "&:empty:before": { content: '"Type a message pharmacists will see when they scan this label\'s QR..."', color: "#9ca3af" },
                              }}
                            />
                            {qrMessageSaved && <Typography variant="caption" sx={{ color: "#2E7D32" }}>Saved ✓</Typography>}
                          </Box>
                        )}
                      </>
                    )}
                  </Box>
                )}

                {activeTab === "branding" && fields.logo && (
                  <Box sx={{ bgcolor: "#EAF2FF", border: "1px solid #BFDBFE", borderRadius: 2, p: 2, mb: fields.qr ? 2 : 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Logo</Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                      {logoDataUrl && <img src={logoDataUrl} alt="logo" style={{ height: 32, borderRadius: 4 }} />}
                      <Button component="label" size="small" variant="outlined" sx={{ textTransform: "none" }}>
                        {logoDataUrl ? "Change logo" : "Upload logo"}
                        <input type="file" accept="image/*" hidden onChange={handleLogoUpload} />
                      </Button>
                    </Box>
                    {logoDataUrl && (
                      <>
                        <FormControlLabel sx={{ mb: 1 }}
                          control={<Checkbox size="small" checked={logoBg} onChange={(e) => setLogoBg(e.target.checked)} />}
                          label={<Typography variant="body2">White background behind logo</Typography>} />
                        <Typography variant="caption" sx={{ color: "#6b7280" }}>Position — horizontal</Typography>
                        <DebouncedSlider size="small" min={0} max={100} value={logoPos.x}
                          onLiveChange={(v) => setLiveLogoPos({ ...logoPos, x: v })} onCommit={(v) => setLogoPos({ ...logoPos, x: v })} sx={{ mb: 1 }} />
                        <Typography variant="caption" sx={{ color: "#6b7280" }}>Position — vertical</Typography>
                        <DebouncedSlider size="small" min={0} max={100} value={logoPos.y}
                          onLiveChange={(v) => setLiveLogoPos({ ...logoPos, y: v })} onCommit={(v) => setLogoPos({ ...logoPos, y: v })} sx={{ mb: 1 }} />
                        <Typography variant="caption" sx={{ color: "#6b7280" }}>Size</Typography>
                        <DebouncedSlider size="small" min={10} max={60} value={logoSize}
                          onLiveChange={setLiveLogoSize} onCommit={(v) => setLogoSize(v)} />
                      </>
                    )}
                  </Box>
                )}

                {activeTab === "branding" && (fields.qr || fields.barcode) && (
                  <Box sx={{ bgcolor: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 2, p: 2, mb: fields.message ? 2 : 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{fields.qr ? "QR code" : "Linear barcode"}</Typography>
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>Position — horizontal</Typography>
                    <DebouncedSlider size="small" min={0} max={100} value={qrPos.x}
                      onLiveChange={(v) => setLiveQrPos({ ...qrPos, x: v })} onCommit={(v) => setQrPos({ ...qrPos, x: v })} sx={{ mb: 1 }} />
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>Position — vertical</Typography>
                    <DebouncedSlider size="small" min={0} max={100} value={qrPos.y}
                      onLiveChange={(v) => setLiveQrPos({ ...qrPos, y: v })} onCommit={(v) => setQrPos({ ...qrPos, y: v })} sx={{ mb: 1 }} />
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>Size</Typography>
                    <DebouncedSlider size="small" min={20} max={70} value={qrSize}
                      onLiveChange={setLiveQrSize} onCommit={(v) => setQrSize(v)} />
                  </Box>
                )}

                {activeTab === "branding" && fields.name && (
                  <Box sx={{ bgcolor: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 2, p: 2, mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Medication name</Typography>
                    <Typography variant="caption" sx={{ color: "#6b7280", display: "block", mb: 1 }}>
                      Positioned freely too, just like the logo/QR — it never shifts on its own when you turn other fields on or off.
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>Position — horizontal</Typography>
                    <DebouncedSlider size="small" min={0} max={100} value={namePos.x}
                      onLiveChange={(v) => setLiveNamePos({ ...namePos, x: v })} onCommit={(v) => setNamePos({ ...namePos, x: v })} sx={{ mb: 1 }} />
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>Position — vertical</Typography>
                    <DebouncedSlider size="small" min={0} max={100} value={namePos.y}
                      onLiveChange={(v) => setLiveNamePos({ ...namePos, y: v })} onCommit={(v) => setNamePos({ ...namePos, y: v })} sx={{ mb: 1 }} />
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>Size</Typography>
                    <DebouncedSlider size="small" min={50} max={200} value={nameSize}
                      onLiveChange={(v) => setLiveNameSize(v)} onCommit={(v) => setNameSize(v)} />
                  </Box>
                )}

                {activeTab === "branding" && fields.message && (
                  <Box sx={{ bgcolor: "#FEF9C3", border: "1px solid #FDE68A", borderRadius: 2, p: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Custom message</Typography>
                    <Typography variant="caption" sx={{ color: "#6b7280", display: "block", mb: 1 }}>
                      Placed freely — it no longer pushes the medication name when you turn it on or edit the text.
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>Position — horizontal</Typography>
                    <DebouncedSlider size="small" min={0} max={100} value={messagePos.x}
                      onLiveChange={(v) => setLiveMessagePos({ ...messagePos, x: v })} onCommit={(v) => setMessagePos({ ...messagePos, x: v })} sx={{ mb: 1 }} />
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>Position — vertical</Typography>
                    <DebouncedSlider size="small" min={0} max={100} value={messagePos.y}
                      onLiveChange={(v) => setLiveMessagePos({ ...messagePos, y: v })} onCommit={(v) => setMessagePos({ ...messagePos, y: v })} />
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
                  <RotatableLabel rotated={rotated} template={template} labelText={labelText} fields={fields} appearance={appearance} dims={dims} orientation={orientation} logoDataUrl={logoDataUrl} logoPos={liveLogoPos} logoSize={liveLogoSize} logoBg={logoBg} qrUrl={qrCustomUrl} qrSize={liveQrSize} qrPos={liveQrPos} messagePos={liveMessagePos} namePos={liveNamePos} nameSize={liveNameSize} categoryChips={categoryChips} qrMessageId={qrMessageHtml.trim() ? qrMessageId : ""} />
                </ScaledPreview>
                <IconButton onClick={() => goTemplate(1)}><ChevronRightIcon /></IconButton>
              </Box>
              <Typography variant="caption" sx={{ color: "#9ca3af" }}>
                {template.name} · {dims.width}×{dims.height}mm
              </Typography>
              <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", justifyContent: "center" }}>
                <Button variant="outlined" startIcon={<OpenWithIcon />} onClick={() => setArrangeOpen(true)}
                  sx={{ textTransform: "none", fontWeight: 600, borderRadius: "8px", borderColor: BLUE, color: BLUE }}>
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

            {/* ---------- Suggested Label strip — lives beside the editor, not buried below it ---------- */}
            {selectedMed && (
              <Box sx={{
                width: { xs: "100%", md: 200 }, flexShrink: 0,
                bgcolor: "#FAFAFA", border: "1px solid #e5e7eb", borderRadius: 3, p: 2,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
              }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, textAlign: "center" }}>Suggested Label</Typography>
                <Typography variant="caption" sx={{ color: "#6b7280", textAlign: "center", display: "block" }}>
                  Based on {selectedMed.name}'s category
                </Typography>
                {(() => {
                  const cats = [...new Set(selectedMed.categories || getDrugCategories(selectedMed.name, selectedMed.code))];
                  const options = resolveCategoryLook(cats);
                  const anyBadges = options.some((o) => o.badges.length > 0);
                  return (
                    <>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, alignItems: "center" }}>
                        {options.map((opt) => {
                          const style = CATEGORY_LABEL_STYLES[opt.base] || CATEGORY_LABEL_STYLES.Normal;
                          const badgeChips = opt.badges.map((b) => CATEGORY_LABEL_STYLES[b].chip);
                          const isActive = appearance.bg === style.bg;
                          return (
                            <Paper key={opt.base} onClick={() => applyCategoryStyle(opt)} elevation={0}
                              sx={{ p: 1.5, borderRadius: 3, cursor: "pointer", textAlign: "center", border: isActive ? `2px solid ${BLUE}` : "1px solid #e5e7eb", "&:hover": { borderColor: BLUE } }}>
                              <Box sx={{
                                width: 140, height: 80, bgcolor: style.bg, color: style.text,
                                display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13,
                                border: "2px solid #000", position: "relative",
                              }}>
                                {selectedMed.name}
                                {badgeChips.length > 0 && showCategoryBadge && (
                                  <Box sx={{ position: "absolute", top: 4, left: 4, right: 4, display: "flex", flexDirection: "row", flexWrap: "wrap", gap: "4px", alignItems: "flex-start" }}>
                                    {badgeChips.map((c) => <CategoryBadge key={c.category} category={c.category} label={c.label} fontSize={9} />)}
                                  </Box>
                                )}
                              </Box>
                              <Typography variant="caption" sx={{ display: "block", mt: 1, fontWeight: 600 }}>
                                {[opt.base, ...opt.badges].join(" + ")}
                              </Typography>
                            </Paper>
                          );
                        })}
                      </Box>
                      {anyBadges && (
                        <FormControlLabel sx={{ mt: 0.5, mx: 0 }}
                          control={<Checkbox size="small" checked={showCategoryBadge}
                            onChange={(e) => {
                              setShowCategoryBadge(e.target.checked);
                              const active = options.find((o) => (CATEGORY_LABEL_STYLES[o.base] || CATEGORY_LABEL_STYLES.Normal).bg === appearance.bg) || options[0];
                              applyCategoryStyle(active, e.target.checked);
                            }} />}
                          label={<Typography variant="caption">Show secondary badges</Typography>} />
                      )}

                      {/* Manual override — always available for all 4 approved looks,
                          in case a medicine hasn't been categorized in the system yet. */}
                      <Divider flexItem sx={{ my: 0.5 }} />
                      <Typography variant="caption" sx={{ color: "#6b7280", textAlign: "center" }}>
                        Not categorized yet, or want a different one? Pick manually:
                      </Typography>
                      <Box sx={{ display: "flex", gap: 0.8, flexWrap: "wrap", justifyContent: "center" }}>
                        {["High Alert", "Hazardous", "Look Alike", "Sound Alike"].map((cat) => {
                          const style = CATEGORY_LABEL_STYLES[cat];
                          const isSelected = manualCategoryBase === cat;
                          return (
                            <Tooltip key={cat} title={cat}>
                              <Box onClick={() => {
                                setManualCategoryBase(cat);
                                const initialBadges = cat === "Sound Alike" ? ["Sound Alike"] : [];
                                setManualCategoryBadges(initialBadges);
                                applyCategoryStyle({ base: cat === "Sound Alike" ? "Normal" : cat, badges: initialBadges }, true);
                              }}
                                sx={{
                                  width: 30, height: 22, bgcolor: style.bg, border: isSelected ? `2px solid ${BLUE}` : "1.5px solid #000",
                                  borderRadius: "3px", cursor: "pointer",
                                }} />
                            </Tooltip>
                          );
                        })}
                      </Box>
                      {manualCategoryBase && (
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", width: "100%" }}>
                          {["Sound Alike", "Look Alike"].filter((b) => b !== manualCategoryBase || b === "Sound Alike").map((b) => (
                            <FormControlLabel key={b} sx={{ mx: 0 }}
                              control={<Checkbox size="small" checked={manualCategoryBadges.includes(b)}
                                onChange={(e) => {
                                  const next = e.target.checked ? [...manualCategoryBadges, b] : manualCategoryBadges.filter((x) => x !== b);
                                  setManualCategoryBadges(next);
                                  applyCategoryStyle({ base: manualCategoryBase === "Sound Alike" ? "Normal" : manualCategoryBase, badges: next }, true);
                                }} />}
                              label={<Typography variant="caption">+ "{b}" badge</Typography>} />
                          ))}
                        </Box>
                      )}

                      {/* Link out to the category-checker tool on the Support page,
                          for whenever the auto-detected category is unclear. */}
                      <Button size="small" variant="outlined" onClick={() => window.open("/support", "_blank")}
                        sx={{ mt: 1, textTransform: "none", fontWeight: 600, borderRadius: "8px", borderColor: BLUE, color: BLUE, width: "100%" }}>
                        Not sure of the category? Check it →
                      </Button>
                    </>
                  );
                })()}
              </Box>
            )}
          </Box>

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
          <FormControl size="small" sx={{
            minWidth: 180,
            "& .MuiOutlinedInput-root": {
              bgcolor: categoryFilter !== "All" ? "#eff6ff" : "#fff",
              "& fieldset": {
                borderColor: categoryFilter !== "All" ? BLUE : "rgba(0,0,0,0.23)",
                borderWidth: categoryFilter !== "All" ? "2px" : "1px",
              },
            },
          }}>
            <InputLabel sx={{ fontWeight: categoryFilter !== "All" ? 700 : 400, color: categoryFilter !== "All" ? BLUE : "inherit" }}>
              Category {categoryFilter !== "All" && "●"}
            </InputLabel>
            <Select value={categoryFilter} label="Category" onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}>
              <MenuItem value="All">All</MenuItem>
              <MenuItem value="High Alert">High Alert</MenuItem>
              <MenuItem value="Hazardous">Hazardous</MenuItem>
              <MenuItem value="Sound Alike">Sound Alike</MenuItem>
              <MenuItem value="Look Alike">Look Alike</MenuItem>
              <MenuItem value="None">No category</MenuItem>
            </Select>
          </FormControl>
          {(categoryFilter !== "All" || statusFilter !== "All" || search.trim() !== "") && (
            <Tooltip title="Reset filters & search">
              <IconButton onClick={() => { setSearch(""); setCategoryFilter("All"); setStatusFilter("All"); setPage(0); }}
                sx={{
                  bgcolor: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: "50%", width: 40, height: 40, color: "#374151",
                  transition: "all 0.2s ease",
                  "&:hover": { bgcolor: "#e5e7eb", color: BLUE, transform: "rotate(180deg)" },
                }}>
                <RestartAltRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Button variant="outlined" onClick={addAllFilteredToBatch} disabled={rows.length === 0}
            sx={{ textTransform: "none", fontWeight: 600, borderColor: BLUE, color: BLUE }}>
            + Add all {rows.length} to Batch
          </Button>
          {doneMeds.size > 0 && (
            <Typography variant="caption" sx={{ color: "#16A34A", fontWeight: 600 }}>
              ✓ {doneMeds.size} of {rows.length} done
            </Typography>
          )}
        </Box>

        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: "1px solid #e5e7eb" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "#F5F9FF" }}>
                <TableCell sx={{ fontWeight: 700, width: 40 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Medicine</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Qty</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Expiry</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Done</TableCell>
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
                <TableRow key={med.id} hover selected={selectedMed?.id === med.id} sx={{ opacity: doneMeds.has(med.id) ? 0.5 : 1 }}>
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
                          const style = CATEGORY_STYLE[cat] || { bg: "#ccc", text: "#fff" };
                          const badgeColor = cat === "Look Alike" || cat === "Sound Alike" ? "#000" : "#fff";
                          return (
                            <Box key={`c${i}`} sx={{
                              display: "inline-flex", alignItems: "center", gap: "4px",
                              padding: "4px 10px", whiteSpace: "nowrap", borderRadius: "6px",
                              fontSize: "12px", fontWeight: "bold",
                              backgroundColor: style.bg, color: badgeColor,
                            }}>
                              {cat}
                              {cat === "High Alert" && <AlertTriangle size={14} color={badgeColor} strokeWidth={2.2} />}
                              {cat === "Sound Alike" && <Ear size={14} color={badgeColor} strokeWidth={2.2} />}
                              {cat === "Look Alike" && <LookAlikeEyeIcon size={17} color={badgeColor} strokeWidth={2.2} bgColor={style.bg} />}
                            </Box>
                          );
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
                          {date && (
                            <Tooltip title={getCountdownText(date)} arrow placement="top" enterTouchDelay={0} leaveTouchDelay={3000}>
                              <Chip label={statuses[i]} color={STATUS_CHIP[statuses[i]]} size="small" sx={{ mt: 0.3, cursor: "pointer" }} />
                            </Tooltip>
                          )}
                        </Box>
                        <Tooltip title="Generate Label for this date">
                          <IconButton size="small" onClick={() => generateForDate(med, date, statuses[i])}
                            sx={{ bgcolor: "#EEF4FF", "&:hover": { bgcolor: "#DCE9FF" }, borderRadius: "8px" }}>
                            <LocalOfferIcon fontSize="small" sx={{ color: BLUE }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Add to batch (suggested category style)">
                          <IconButton size="small" onClick={() => {
                            const { base, badges } = resolveCategoryLook(categories)[0];
                            const style = CATEGORY_LABEL_STYLES[base] || CATEGORY_LABEL_STYLES.Normal;
                            const badgeChipDefs = badges.map((b) => CATEGORY_LABEL_STYLES[b].chip);
                            setBatch((b) => [...b, {
                              id: `b${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${med.id}`,
                              labelText: { name: med.name, expiry: "", code: med.code || "", action: "", message: "", status: "" },
                              fields: { name: true, expiry: false, code: false, description: false, status: false, action: false, message: false, qr: fields.qr, barcode: fields.barcode, logo: true },
                              appearance: { bg: style.bg, text: style.text, accent: style.accent, fontSize: appearance.fontSize, bold: true, align: "center" },
                              dims: { ...dims }, orientation, rotated, categoryChips: showCategoryBadge ? badgeChipDefs : [], badgesAvailable: badgeChipDefs, categories,
                              qrUrl: "", qrMessageId: "", previewName: med.name,
                            }]);
                          }} sx={{ bgcolor: "#F0FDF4", "&:hover": { bgcolor: "#DCFCE7" }, borderRadius: "8px" }}>
                            <Typography sx={{ fontWeight: 800, color: "#16A34A", fontSize: 14, lineHeight: 1 }}>+</Typography>
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ))}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={doneMeds.has(med.id) ? "Marked done — click to unmark" : "Mark as done once printed / handled"}>
                      <IconButton size="small" onClick={() => toggleDone(med.id)}>
                        {doneMeds.has(med.id)
                          ? <CheckCircleIcon fontSize="small" sx={{ color: "#16A34A" }} />
                          : <RadioButtonUncheckedIcon fontSize="small" sx={{ color: "#d1d5db" }} />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Same pagination bar style as the Inventory page — first/prev/page
              numbers with "…" for gaps/next/last — instead of the plain
              MUI TablePagination default. */}
          {(() => {
            const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
            const currentPage = page + 1;
            const from = rows.length === 0 ? 0 : page * rowsPerPage + 1;
            const to = Math.min(rows.length, (page + 1) * rowsPerPage);
            const pageNumbers = getPaginationPageNumbers(currentPage, totalPages);

            const pageButtonSx = (active) => ({
              minWidth: 34, height: 34, borderRadius: "8px", fontSize: 13, fontWeight: 700, p: 0,
              color: active ? "#fff" : "#374151",
              bgcolor: active ? BLUE : "transparent",
              "&:hover": { bgcolor: active ? "#1E3A8A" : "#f3f4f6" },
            });

            return (
              <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1.5, borderTop: "1px solid #EAECF0", px: 2, py: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Typography sx={{ fontSize: 13, color: "#667085" }}>
                    Showing {from} to {to} of {rows.length} items
                  </Typography>
                  <Select size="small" value={rowsPerPage}
                    onChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                    sx={{ fontSize: 13, height: 32, borderRadius: "8px", "& .MuiSelect-select": { py: 0.5, pl: 1.2 } }}>
                    {[10, 25, 50].map((n) => (
                      <MenuItem key={n} value={n} sx={{ fontSize: 13 }}>{n} per page</MenuItem>
                    ))}
                  </Select>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                  <Tooltip title="First page">
                    <span>
                      <IconButton size="small" disabled={page === 0} onClick={() => setPage(0)} sx={pageButtonSx(false)}>
                        <KeyboardDoubleArrowLeftIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Previous page">
                    <span>
                      <IconButton size="small" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} sx={pageButtonSx(false)}>
                        <ChevronLeftIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  {pageNumbers.map((p, i) =>
                    p === "…" ? (
                      <Typography key={`dots-${i}`} sx={{ px: 0.5, color: "#98A2B3", fontSize: 13 }}>…</Typography>
                    ) : (
                      <Button key={p} onClick={() => setPage(p - 1)} sx={pageButtonSx(p === currentPage)}>{p}</Button>
                    )
                  )}
                  <Tooltip title="Next page">
                    <span>
                      <IconButton size="small" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} sx={pageButtonSx(false)}>
                        <ChevronRightIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Last page">
                    <span>
                      <IconButton size="small" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)} sx={pageButtonSx(false)}>
                        <KeyboardDoubleArrowRightIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </Box>
            );
          })()}
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
              onClick={() => window.open("/support", "_blank")}
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
          px: 3, py: 1.5, display: "flex", alignItems: "center", gap: 2,
          maxHeight: 96, overflow: "hidden",
        }}>
          <Typography sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{batch.length} queued</Typography>
          {/* Single scrollable row — never wraps to multiple lines, so a big batch
              can't push this bar to grow and cover the screen. */}
          <Box sx={{ display: "flex", gap: 1, flexWrap: "nowrap", flex: 1, overflowX: "auto", overflowY: "hidden", py: 0.5 }}>
            {batch.map((item) => (
              <Chip key={item.id} label={item.previewName} onDelete={() => removeFromBatch(item.id)}
                sx={{ bgcolor: item.appearance.bg, color: item.appearance.text, fontWeight: 700, border: "1px solid #e5e7eb", flexShrink: 0 }} />
            ))}
          </Box>
          <Button size="small" onClick={() => setBatch([])} sx={{ textTransform: "none", flexShrink: 0 }}>Clear</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => setReviewOpen(true)}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: "8px", bgcolor: BLUE, "&:hover": { bgcolor: "#1E3A8A" }, flexShrink: 0 }}>
            Finish & Print ({batch.length})
          </Button>
        </Box>
      )}

      {/* ---------- Review & Print dialog ---------- */}
      <ReviewPrintDialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        batch={batch}
        setBatch={setBatch}
        removeFromBatch={removeFromBatch}
        onConfirmPrint={(visitedIds) => { setPrintSubsetIds(visitedIds); setReviewOpen(false); handlePrint(); }}
        batchUnifyQr={batchUnifyQr}
        setBatchUnifyQr={setBatchUnifyQr}
        batchUnifiedQrUrl={batchUnifiedQrUrl}
        setBatchUnifiedQrUrl={setBatchUnifiedQrUrl}
        logoDataUrl={logoDataUrl} logoPos={logoPos} logoSize={logoSize} logoBg={logoBg}
        setLogoPos={setLogoPos} setLogoSize={setLogoSize} setLogoBg={setLogoBg}
        qrSize={qrSize} qrPos={qrPos} setQrSize={setQrSize} setQrPos={setQrPos}
        messagePos={messagePos} setMessagePos={setMessagePos}
        namePos={namePos} setNamePos={setNamePos}
        nameSize={nameSize} setNameSize={setNameSize}
      />

      {/* ---------- Arrange on A4 dialog ---------- */}
      <ArrangeDialog
        open={arrangeOpen}
        onClose={() => setArrangeOpen(false)}
        onConfirm={confirmArrangement}
        dims={dims}
        rotated={rotated}
        orientation={orientation}
        arrangement={arrangement}
        template={template}
        labelText={labelText}
        fields={fields}
        appearance={appearance}
        logoDataUrl={logoDataUrl}
        logoPos={logoPos}
        logoSize={logoSize}
        logoBg={logoBg}
        qrUrl={qrCustomUrl}
        qrSize={qrSize}
        qrPos={qrPos}
        messagePos={messagePos}
        namePos={namePos}
        nameSize={nameSize}
        categoryChips={categoryChips}
        qrMessageId={qrMessageHtml.trim() ? qrMessageId : ""}
      />

      {/* ---------- Hidden A4 print sheet (visible only when printing) ---------- */}
      <Box id="print-sheet">
        {!printReady ? null : batch.length > 0
          ? (printSubsetIds ? batch.filter((it) => printSubsetIds.includes(it.id)) : batch).map((item) => (
              <RotatableLabel key={item.id} rotated={item.rotated} template={template} labelText={item.labelText} fields={item.fields} appearance={item.appearance}
                dims={item.dims} orientation={item.orientation} printMode logoDataUrl={logoDataUrl} logoPos={logoPos} logoSize={logoSize} logoBg={logoBg}
                qrUrl={batchUnifyQr ? batchUnifiedQrUrl : item.qrUrl} qrSize={qrSize} qrPos={qrPos} messagePos={messagePos} namePos={namePos} nameSize={nameSize} categoryChips={item.categoryChips}
                qrMessageId={batchUnifyQr ? "" : item.qrMessageId} />
            ))
          : Array.from({ length: copies }).map((_, i) => (
              <RotatableLabel key={i} rotated={rotated} template={template} labelText={labelText} fields={fields} appearance={appearance} dims={dims} orientation={orientation}
                printMode logoDataUrl={logoDataUrl} logoPos={logoPos} logoSize={logoSize} logoBg={logoBg} qrUrl={qrCustomUrl} qrSize={qrSize} qrPos={qrPos} messagePos={messagePos} namePos={namePos} nameSize={nameSize}
                categoryChips={categoryChips} qrMessageId={qrMessageHtml.trim() ? qrMessageId : ""} />
            ))}
      </Box>

      {/* إشعار هادئ لو حفظ إعداد (شعار/رسالة QR) فشل فعليًا بالخلفية - نفس
          شكل وموقع إشعار مشابه بالانفنتوري، بدون أي لون تحذيري مزعج */}
      <Snackbar
        open={settingsSaveError}
        autoHideDuration={5000}
        onClose={() => setSettingsSaveError(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSettingsSaveError(false)}
          severity="info"
          variant="filled"
          sx={{ bgcolor: "#334155" }}
        >
          Change wasn't saved — weak internet connection, please try again
        </Alert>
      </Snackbar>
    </Container>
  );
}

function ReviewPrintDialog({ open, onClose, batch, setBatch, removeFromBatch, onConfirmPrint, batchUnifyQr, setBatchUnifyQr, batchUnifiedQrUrl, setBatchUnifiedQrUrl, logoDataUrl, logoPos, logoSize, logoBg, setLogoPos, setLogoSize, setLogoBg, qrSize, qrPos, setQrSize, setQrPos, messagePos, setMessagePos, namePos, setNamePos, nameSize, setNameSize }) {
  const [index, setIndex] = useState(0);
  const [visited, setVisited] = useState(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showPosition, setShowPosition] = useState(false);
  // Live preview values shown on the card WHILE dragging — the committed
  // logoPos/qrPos (which re-renders the whole editor) only updates once, on
  // release, but the on-screen card should still visibly follow the drag.
  const [liveLogoPos, setLiveLogoPos] = useState(logoPos);
  const [liveLogoSize, setLiveLogoSize] = useState(logoSize);
  const [liveQrPos, setLiveQrPos] = useState(qrPos);
  const [liveQrSize, setLiveQrSize] = useState(qrSize);
  const [liveMessagePos, setLiveMessagePos] = useState(messagePos);
  const [liveNamePos, setLiveNamePos] = useState(namePos);
  const [liveNameSize, setLiveNameSize] = useState(nameSize);
  useEffect(() => setLiveLogoPos(logoPos), [logoPos]);
  useEffect(() => setLiveLogoSize(logoSize), [logoSize]);
  useEffect(() => setLiveQrPos(qrPos), [qrPos]);
  useEffect(() => setLiveQrSize(qrSize), [qrSize]);
  useEffect(() => setLiveMessagePos(messagePos), [messagePos]);
  useEffect(() => setLiveNamePos(namePos), [namePos]);
  useEffect(() => setLiveNameSize(nameSize), [nameSize]);
  // Once the person turns QR on for one card, keep it on as they move
  // forward through the rest — each card still gets its own blank link.
  const [qrStickyOn, setQrStickyOn] = useState(false);
  useEffect(() => {
    if (open) {
      setIndex(0);
      setConfirmOpen(false);
      // Set (not reset-then-rely-on-the-other-effect) so the first card is
      // marked reviewed immediately — if index was already 0 from a prior
      // session, that setIndex(0) above is a no-op and the effect below
      // (keyed on index) would never re-fire to add it back in.
      setVisited(batch[0] ? new Set([batch[0].id]) : new Set());
      setQrStickyOn(false);
    }
  }, [open]);
  // Keep the current card in range if items get deleted out from under it.
  useEffect(() => { if (index > batch.length - 1) setIndex(Math.max(0, batch.length - 1)); }, [batch.length, index]);
  // Whatever card is on screen counts as "reviewed".
  useEffect(() => { if (open && batch[index]) setVisited((v) => new Set(v).add(batch[index].id)); }, [index, batch, open]);
  // Carry the "QR enabled" preference forward as the person navigates —
  // each card still keeps/gets its own blank link, only the checkbox state
  // itself is sticky.
  useEffect(() => {
    if (!open) return;
    const item = batch[index];
    if (item && qrStickyOn && !item.fields.qr) {
      setBatch((b) => b.map((it) => it.id === item.id ? { ...it, fields: { ...it.fields, qr: true } } : it));
    }
  }, [index, open]);

  function toggleBadge(id) {
    setBatch((b) => b.map((it) => it.id === id ? { ...it, categoryChips: (it.categoryChips && it.categoryChips.length) ? [] : it.badgesAvailable || [] } : it));
  }
  function toggleQr(id) {
    setBatch((b) => b.map((it) => {
      if (it.id !== id) return it;
      const next = !it.fields.qr;
      setQrStickyOn(next); // remember the choice so it carries forward as you navigate
      return { ...it, fields: { ...it.fields, qr: next } };
    }));
  }
  function setItemQrUrl(id, url) {
    setBatch((b) => b.map((it) => it.id === id ? { ...it, qrUrl: url } : it));
  }
  function applyOptionToItem(id, opt) {
    const style = CATEGORY_LABEL_STYLES[opt.base] || CATEGORY_LABEL_STYLES.Normal;
    const badgeChipDefs = opt.badges.map((b) => CATEGORY_LABEL_STYLES[b].chip);
    setBatch((b) => b.map((it) => it.id === id ? {
      ...it,
      appearance: { ...it.appearance, bg: style.bg, text: style.text, accent: style.accent },
      categoryChips: badgeChipDefs,
      badgesAvailable: badgeChipDefs,
    } : it));
  }
  function deleteCurrent() {
    if (!current) return;
    removeFromBatch(current.id);
  }

  const current = batch[index];
  const currentOptions = current && current.categories && current.categories.length ? resolveCategoryLook(current.categories) : [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Review & Print — {batch.length} label{batch.length !== 1 ? "s" : ""}
      </DialogTitle>
      <DialogContent dividers>
        {batch.length === 0 ? (
          <Typography sx={{ color: "#9ca3af", textAlign: "center", py: 4 }}>Nothing queued to print.</Typography>
        ) : (
          <>
            <Typography variant="body2" sx={{ color: "#6b7280", mb: 2, textAlign: "center" }}>
              One label at a time — exactly what will come out of the printer. Adjust it, then move to the next.
            </Typography>

            {/* Sticky so the card stays in view while scrolling down to the
                position/size controls below — no more losing track of it. */}
            <Box sx={{ position: "sticky", top: 0, zIndex: 2, bgcolor: "#fff", pb: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, mb: 2 }}>
                <IconButton disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}><ChevronLeftIcon /></IconButton>

                {current && (
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, width: 280, flexShrink: 0 }}>
                    <ScaledPreview maxBox={200} dims={current.dims} orientation={current.orientation}>
                      <RotatableLabel rotated={current.rotated} template={{ icon: LocalOfferIcon, title: current.previewName, action: "" }}
                        labelText={current.labelText} fields={current.fields} appearance={current.appearance}
                        dims={current.dims} orientation={current.orientation}
                        logoDataUrl={logoDataUrl} logoPos={liveLogoPos} logoSize={liveLogoSize} logoBg={logoBg}
                        qrUrl={batchUnifyQr ? batchUnifiedQrUrl : current.qrUrl} qrSize={liveQrSize} qrPos={liveQrPos} messagePos={liveMessagePos} namePos={liveNamePos} nameSize={liveNameSize}
                        categoryChips={current.categoryChips} qrMessageId={batchUnifyQr ? "" : current.qrMessageId} />
                    </ScaledPreview>
                    <Typography sx={{ fontWeight: 700, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{current.previewName}</Typography>
                    {current.labelText?.code && (
                      <Typography variant="caption" sx={{ color: "#6b7280", fontFamily: "monospace" }}>{current.labelText.code}</Typography>
                    )}
                    <Typography variant="caption" sx={{ color: "#9ca3af" }}>{index + 1} of {batch.length} · {visited.size} reviewed</Typography>
                  </Box>
                )}

                <IconButton disabled={index >= batch.length - 1} onClick={() => setIndex((i) => Math.min(batch.length - 1, i + 1))}><ChevronRightIcon /></IconButton>
              </Box>
            </Box>

            {/* Other suggested looks for this same medicine, so a different
                card can be picked without leaving the review flow. */}
            {current && currentOptions.length > 0 && (
              <Box sx={{ display: "flex", gap: 1, justifyContent: "center", mb: 2, flexWrap: "wrap" }}>
                {currentOptions.map((opt) => {
                  const style = CATEGORY_LABEL_STYLES[opt.base] || CATEGORY_LABEL_STYLES.Normal;
                  const isActive = current.appearance.bg === style.bg;
                  return (
                    <Tooltip key={opt.base} title={[opt.base, ...opt.badges].join(" + ")}>
                      <Box onClick={() => applyOptionToItem(current.id, opt)}
                        sx={{
                          width: 34, height: 24, bgcolor: style.bg, cursor: "pointer",
                          border: isActive ? `2px solid ${BLUE}` : "1.5px solid #000", borderRadius: "3px",
                        }} />
                    </Tooltip>
                  );
                })}
              </Box>
            )}

            {current && (
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, mb: 1 }}>
                <Box sx={{ display: "flex", justifyContent: "center", gap: 3, flexWrap: "wrap" }}>
                  <FormControlLabel
                    control={<Checkbox checked={!!current.fields.qr} onChange={() => toggleQr(current.id)} />}
                    label="QR code" />
                  <FormControlLabel
                    control={<Checkbox disabled={!current.badgesAvailable?.length} checked={!!current.categoryChips?.length} onChange={() => toggleBadge(current.id)} />}
                    label="Badge" />
                  <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={deleteCurrent} sx={{ textTransform: "none" }}>
                    Remove this label
                  </Button>
                </Box>
                {current.fields.qr && !batchUnifyQr && (
                  <TextField size="small" fullWidth placeholder="Attach the link this QR should open — e.g. https://..."
                    helperText={current.qrUrl?.trim() ? "" : "Nothing attached yet — shows faded on the label until you add one."}
                    value={current.qrUrl || ""} onChange={(e) => setItemQrUrl(current.id, e.target.value)} />
                )}
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Same logo/QR position & size controls as the main editor's
                Position tab — available here too, applies to every label. */}
            <Button size="small" onClick={() => setShowPosition((s) => !s)} sx={{ textTransform: "none", mb: showPosition ? 1 : 0 }}>
              {showPosition ? "Hide" : "✎ Adjust name / logo / QR position & size"}
            </Button>
            {showPosition && (
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
                {current && current.fields.name && (
                  <Box sx={{ bgcolor: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 2, p: 1.5, flex: 1, minWidth: 180 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>Medication name</Typography>
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>Horizontal</Typography>
                    <DebouncedSlider size="small" min={0} max={100} value={namePos.x}
                      onLiveChange={(v) => setLiveNamePos({ ...namePos, x: v })} onCommit={(v) => setNamePos({ ...namePos, x: v })} />
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>Vertical</Typography>
                    <DebouncedSlider size="small" min={0} max={100} value={namePos.y}
                      onLiveChange={(v) => setLiveNamePos({ ...namePos, y: v })} onCommit={(v) => setNamePos({ ...namePos, y: v })} sx={{ mb: 1 }} />
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>Size</Typography>
                    <DebouncedSlider size="small" min={50} max={200} value={nameSize}
                      onLiveChange={(v) => setLiveNameSize(v)} onCommit={(v) => setNameSize(v)} />
                  </Box>
                )}
                {logoDataUrl && (
                  <Box sx={{ bgcolor: "#EAF2FF", border: "1px solid #BFDBFE", borderRadius: 2, p: 1.5, flex: 1, minWidth: 180 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>Logo</Typography>
                    <FormControlLabel sx={{ mb: 0.5 }}
                      control={<Checkbox size="small" checked={logoBg} onChange={(e) => setLogoBg(e.target.checked)} />}
                      label={<Typography variant="caption">White background</Typography>} />
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>Horizontal</Typography>
                    <DebouncedSlider size="small" min={0} max={100} value={logoPos.x}
                      onLiveChange={(v) => setLiveLogoPos({ ...logoPos, x: v })} onCommit={(v) => setLogoPos({ ...logoPos, x: v })} />
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>Vertical</Typography>
                    <DebouncedSlider size="small" min={0} max={100} value={logoPos.y}
                      onLiveChange={(v) => setLiveLogoPos({ ...logoPos, y: v })} onCommit={(v) => setLogoPos({ ...logoPos, y: v })} />
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>Size</Typography>
                    <DebouncedSlider size="small" min={10} max={60} value={logoSize}
                      onLiveChange={setLiveLogoSize} onCommit={(v) => setLogoSize(v)} />
                  </Box>
                )}
                {batch.some((it) => it.fields.qr) && (
                  <Box sx={{ bgcolor: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 2, p: 1.5, flex: 1, minWidth: 180 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>QR code</Typography>
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>Horizontal</Typography>
                    <DebouncedSlider size="small" min={0} max={100} value={qrPos.x}
                      onLiveChange={(v) => setLiveQrPos({ ...qrPos, x: v })} onCommit={(v) => setQrPos({ ...qrPos, x: v })} />
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>Vertical</Typography>
                    <DebouncedSlider size="small" min={0} max={100} value={qrPos.y}
                      onLiveChange={(v) => setLiveQrPos({ ...qrPos, y: v })} onCommit={(v) => setQrPos({ ...qrPos, y: v })} />
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>Size</Typography>
                    <DebouncedSlider size="small" min={20} max={70} value={qrSize}
                      onLiveChange={setLiveQrSize} onCommit={(v) => setQrSize(v)} />
                  </Box>
                )}
              </Box>
            )}

            {batch.some((it) => it.fields.qr) && (
              <Box sx={{ bgcolor: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 2, p: 1.5 }}>
                <FormControlLabel
                  control={<Checkbox size="small" checked={batchUnifyQr} onChange={(e) => setBatchUnifyQr(e.target.checked)} />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Use one QR link for every label in this batch</Typography>} />
                <Typography variant="caption" sx={{ color: "#6b7280", display: "block", ml: 4, mb: batchUnifyQr ? 1 : 0 }}>
                  Off by default — each medicine keeps the link it was added with (or its own auto-generated one).
                </Typography>
                {batchUnifyQr && (
                  <TextField size="small" fullWidth placeholder="https://... (applies to every QR code in this batch)"
                    sx={{ ml: 4, width: "calc(100% - 32px)" }}
                    value={batchUnifiedQrUrl} onChange={(e) => setBatchUnifiedQrUrl(e.target.value)} />
                )}
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Back to editing</Button>
        <Button variant="contained" startIcon={<PrintIcon />} disabled={batch.length === 0} onClick={() => setConfirmOpen(true)}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "8px", bgcolor: BLUE, "&:hover": { bgcolor: "#1E3A8A" } }}>
          Print reviewed ({visited.size})
        </Button>
      </DialogActions>

      {/* Confirm before actually sending to the printer — easy to bump this
          button by accident, and nothing here is undoable once printed. */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Print {visited.size} label{visited.size !== 1 ? "s" : ""}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#6b7280" }}>
            {visited.size < batch.length
              ? `Only the ${visited.size} label${visited.size !== 1 ? "s" : ""} you reviewed will print — the other ${batch.length - visited.size} stay queued for later.`
              : "This will send all queued labels to your printer."}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" startIcon={<PrintIcon />}
            onClick={() => { setConfirmOpen(false); onConfirmPrint(Array.from(visited)); }}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: "8px", bgcolor: BLUE, "&:hover": { bgcolor: "#1E3A8A" } }}>
            Yes, print
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}

// Small corner badge for Sound Alike / Look Alike — matches the Inventory
// badge exactly: sharp corners, real icon (not emoji), not a pill.
function CategoryBadge({ category, label, fontSize = 10 }) {
  // Colours/shape come from CATEGORY_STYLE — the exact same object used for
  // the medicine-list badges below — so this corner badge always looks
  // identical to "the badge in the table", per the approved reference.
  const style = CATEGORY_STYLE[category] || { bg: "#ccc", text: "#000" };
  return (
    <Box sx={{
      bgcolor: style.bg, color: style.text, fontWeight: 700, fontSize: `${fontSize}px`,
      borderRadius: "2px", px: 1, py: 0.35, display: "inline-flex", alignItems: "center", gap: 0.4,
      whiteSpace: "nowrap",
      WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
    }}>
      {label}
      {(category === "High Alert" || category === "Hazardous") && <AlertTriangle size={fontSize + 3} color={style.text} strokeWidth={2.2} />}
      {category === "Sound Alike" && <Ear size={fontSize + 3} color={style.text} strokeWidth={2.2} />}
      {category === "Look Alike" && <LookAlikeEyeIcon size={fontSize + 6} color={style.text} strokeWidth={2.2} bgColor={style.bg} />}
    </Box>
  );
}

// Smooth local dragging without the lag of updating the whole app on every
// pixel: onChange only touches this component's own state (cheap, instant)
// AND reports the live value up via onLiveChange so the preview card can
// follow the drag in real time; the expensive shared state (which
// re-renders the whole editor) only updates once, on release.
function DebouncedSlider({ value, onCommit, onLiveChange, ...props }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <Slider {...props} value={local}
      onChange={(e, v) => { setLocal(v); onLiveChange && onLiveChange(v); }}
      onChangeCommitted={(e, v) => onCommit(v)} />
  );
}

// Same idea as DebouncedSlider but for text inputs: the field itself is
// controlled by fast local state (so every keystroke feels instant, no
// matter how heavy the rest of the page is), and only pushes the value up
// to the parent — which re-renders the live QR code / barcode / medicine
// table — ~250ms after the person stops typing. A manual blur/Enter also
// commits immediately so nothing is lost if they click away right after
// typing.
function DebouncedTextField({ value, onCommit, delay = 250, ...props }) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef(null);
  useEffect(() => { setLocal(value); }, [value]);
  function flush(v) {
    if (timerRef.current) clearTimeout(timerRef.current);
    onCommit(v);
  }
  return (
    <TextField
      {...props}
      value={local}
      onChange={(e) => {
        const v = e.target.value;
        setLocal(v);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => onCommit(v), delay);
      }}
      onBlur={(e) => { flush(e.target.value); props.onBlur && props.onBlur(e); }}
    />
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

function ArrangeDialog({ open, onClose, onConfirm, dims, orientation, rotated, arrangement, template, labelText, fields, appearance, logoDataUrl, logoPos, logoSize, logoBg, qrUrl, qrSize, qrPos, messagePos, namePos, nameSize, categoryChips, qrMessageId }) {
  const initW = orientation === "horizontal" ? dims.width : dims.height;
  const initH = orientation === "horizontal" ? dims.height : dims.width;

  const [box, setBox] = useState({ x: arrangement.x, y: arrangement.y, w: initW, h: initH, rotated: !!rotated });
  const dragInfo = useRef(null);

  useEffect(() => {
    if (open) setBox({ x: arrangement.x, y: arrangement.y, w: initW, h: initH, rotated: !!rotated });
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
    onConfirm({ width: Math.round(box.w), height: Math.round(box.h) }, { x: Math.round(box.x), y: Math.round(box.y) }, box.rotated);
  }

  // How many copies fit on the page at the current size/position vs. if
  // rotated 90° from the top-left corner — lets the person pick whichever
  // orientation wastes less paper instead of guessing.
  function estimateCount(w, h, x, y) {
    const cols = Math.max(1, Math.floor((PAGE_W - x) / w));
    const rows = Math.max(1, Math.floor((PAGE_H - y) / h));
    return cols * rows;
  }
  const currentCount = estimateCount(box.w, box.h, box.x, box.y);
  const rotatedCount = estimateCount(box.h, box.w, 0, 0);
  function applyPaperSaving() {
    setBox(rotatedCount > currentCount
      ? { x: 0, y: 0, w: box.h, h: box.w, rotated: !box.rotated }
      : { ...box, x: 0, y: 0 });
  }
  // Plain manual rotate — independent of the paper-saving suggestion, always
  // available, keeps the current top-left position. Swaps the footprint
  // AND flips `rotated` so the label graphic itself spins 90° to match —
  // otherwise the same unrotated content just gets squeezed into a
  // differently-shaped box (wrong proportions, text never turns).
  function rotate90() {
    setBox((b) => ({ ...b, w: b.h, h: b.w, rotated: !b.rotated }));
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
        <Box sx={{ textAlign: "center", mb: 2 }}>
          <Button size="small" variant="outlined" onClick={applyPaperSaving}
            disabled={rotatedCount <= currentCount}
            sx={{ textTransform: "none", borderColor: "#16A34A", color: "#16A34A" }}>
            🌱 Paper-saving: rotate to fill the page {rotatedCount > currentCount ? `(~${rotatedCount} per page instead of ~${currentCount})` : "— current layout is already the best fit"}
          </Button>
        </Box>
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
              <RotatableLabel rotated={box.rotated} template={template} labelText={labelText} fields={fields} appearance={appearance}
                dims={{ width: box.w, height: box.h }} orientation="horizontal" logoDataUrl={logoDataUrl} logoPos={logoPos} logoSize={logoSize} logoBg={logoBg} qrUrl={qrUrl} qrSize={qrSize} qrPos={qrPos} messagePos={messagePos} namePos={namePos} nameSize={nameSize} categoryChips={categoryChips} qrMessageId={qrMessageId} />
            </Box>
            <Box
              onMouseDown={startResize}
              sx={{
                position: "absolute", right: -6, bottom: -6, width: 14, height: 14,
                bgcolor: BLUE, borderRadius: "3px", border: "2px solid #fff", cursor: "nwse-resize",
              }}
            />
            <Tooltip title="Rotate 90°">
              <IconButton size="small" onClick={rotate90} onMouseDown={(e) => e.stopPropagation()}
                sx={{ position: "absolute", left: -18, top: -18, bgcolor: "#fff", border: `1px solid ${BLUE}`, "&:hover": { bgcolor: "#EAF2FF" } }}>
                <RestartAltRoundedIcon fontSize="small" sx={{ color: BLUE }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <Typography variant="caption" sx={{ color: "#9ca3af", display: "block", textAlign: "center", mt: 1.5 }}>
          {Math.round(box.w)}×{Math.round(box.h)}mm at ({Math.round(box.x)}, {Math.round(box.y)})mm from the top-left corner — fits ~{currentCount} per page this way
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

// Wraps LabelCard to physically rotate the WHOLE label graphic 90° (title,
// badges, icons — everything spins together, unlike just swapping
// width/height which only stretches the same unrotated layout into a
// differently-shaped box). `dims` here is always the already-oriented
// "footprint" size (same thing normally passed straight to LabelCard) —
// when `rotated` is true we render LabelCard at its natural (un-rotated)
// size and spin that inside a footprint box of the given dims, so the
// footprint used for drag/resize/print-grid layout stays correct while the
// content itself visibly rotates.
function RotatableLabel({ rotated, dims, orientation, ...rest }) {
  if (!rotated) return <LabelCard dims={dims} orientation={orientation} {...rest} />;
  const outerW = orientation === "horizontal" ? dims.width : dims.height;
  const outerH = orientation === "horizontal" ? dims.height : dims.width;
  const innerDims = { width: outerH, height: outerW };
  return (
    <Box sx={{ width: `${outerW}mm`, height: `${outerH}mm`, position: "relative", flexShrink: 0 }}>
      <Box sx={{
        position: "absolute", left: "50%", top: "50%",
        width: `${innerDims.width}mm`, height: `${innerDims.height}mm`,
        transform: "translate(-50%, -50%) rotate(90deg)",
      }}>
        <LabelCard dims={innerDims} orientation="horizontal" {...rest} />
      </Box>
    </Box>
  );
}

function LabelCard({ template, labelText, fields, appearance, dims, orientation, printMode, logoDataUrl, logoPos, logoSize, logoBg, qrUrl, qrSize, qrPos, messagePos, namePos, nameSize, categoryChips, qrMessageId }) {
  const Icon = template.icon;
  const width = orientation === "horizontal" ? dims.width : dims.height;
  const height = orientation === "horizontal" ? dims.height : dims.width;
  // When the Medication Name field is on but empty (e.g. right after
  // "Clear"), show a muted hint instead of silently falling back to the
  // template's fixed title (which looked like a stale "EXPIRED" leftover).
  const showNamePlaceholder = fields.name && !labelText.name.trim();
  const mainTitle = showNamePlaceholder ? "" : (fields.name && labelText.name ? labelText.name : template.title);

  return (
    <Box
      sx={{
        width: `${width}mm`,
        height: `${height}mm`,
        bgcolor: appearance.bg,
        color: appearance.text,
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
        border: "2px solid #000",
        outline: printMode ? "1px dashed #cbd5e1" : "none",
        outlineOffset: printMode ? "2px" : 0,
        borderRadius: 0,
        boxShadow: printMode ? "none" : "0 1px 4px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        alignItems: appearance.align === "left" ? "flex-start" : appearance.align === "right" ? "flex-end" : "center",
        justifyContent: "center",
        textAlign: appearance.align,
        px: 2, py: 1.2, gap: 0.5,
        // Extra top padding when badges are present, so a row of corner
        // badges never overlaps the medicine name text underneath them.
        pt: categoryChips && categoryChips.length > 0 ? 2.2 : 1.2,
        overflow: "hidden",
        position: "relative",
        fontFamily: "Georgia, 'Times New Roman', Times, serif",
        boxSizing: "border-box",
      }}
    >
      {fields.logo && logoDataUrl && (
        <Box sx={{
          position: "absolute",
          left: `${(logoPos?.x ?? 82)}%`, top: `${(logoPos?.y ?? 87)}%`,
          transform: "translate(-50%, -50%)",
          bgcolor: logoBg ? "#fff" : "transparent",
          px: logoBg ? 0.35 : 0, py: logoBg ? 0.15 : 0, lineHeight: 0,
          display: "flex", alignItems: "center",
        }}>
          <img src={logoDataUrl} alt="logo" style={{ height: mmToPx(Math.min(width, height)) * ((logoSize ?? 20) / 100), maxWidth: mmToPx(width) * 0.5, objectFit: "contain" }} />
        </Box>
      )}
      {categoryChips && categoryChips.length > 0 && (
        <Box sx={{ position: "absolute", top: 4, left: 4, right: 4, display: "flex", flexDirection: "row", flexWrap: "wrap", gap: "4px", alignItems: "flex-start" }}>
          {categoryChips.map((c) => <CategoryBadge key={c.category} category={c.category} label={c.label} />)}
        </Box>
      )}
      {fields.qr && (qrUrl?.trim() || labelText.code || labelText.name) && (
        <Box sx={{
          position: "absolute",
          left: `${(qrPos?.x ?? 20)}%`, top: `${(qrPos?.y ?? 87)}%`,
          transform: "translate(-50%, -50%)",
          bgcolor: "#fff", p: "3px", borderRadius: "3px", lineHeight: 0,
          // Faded until real content is attached (a link or a message), so
          // it visually reads as a placeholder rather than a finished QR
          opacity: (qrUrl?.trim() || qrMessageId) ? 1 : 0.32,
        }}>
          <MemoQRCode
            value={qrUrl?.trim()
              ? qrUrl.trim()
              : `${typeof window !== "undefined" ? window.location.origin : ""}/scan-result?code=${encodeURIComponent(labelText.code || labelText.name)}${qrMessageId ? `&msg=${qrMessageId}` : ""}`}
            size={Math.max(40, mmToPx(Math.min(width, height)) * ((qrSize ?? 40) / 100))}
          />
        </Box>
      )}
      {!fields.name && <Icon sx={{ color: appearance.accent, fontSize: `${appearance.fontSize + 14}px` }} />}
      {fields.name && showNamePlaceholder && (
        <Box sx={{
          bgcolor: BLUE, color: "#fff", fontWeight: 700, fontSize: `${Math.max(appearance.fontSize - 1, 11)}px`,
          borderRadius: "10px", px: 2, py: 1, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}>
          Select a medicine below ↓
        </Box>
      )}
      {!fields.name && (
        <Box sx={{
          fontWeight: appearance.bold ? 800 : 600,
          fontSize: `${appearance.fontSize + 4}px`,
          lineHeight: 1.25,
        }}>
          {mainTitle.split("\n").map((line, i) => (
            <Box key={i}>{line}</Box>
          ))}
        </Box>
      )}
      {fields.name && !showNamePlaceholder && labelText.name && (
        // Positioned freely, like the logo/QR/message — never shifts on its
        // own just because some other field got turned on or off.
        <Box sx={{
          position: "absolute",
          left: `${namePos?.x ?? 50}%`, top: `${namePos?.y ?? 48}%`,
          transform: "translate(-50%, -50%)",
          width: "88%",
          fontWeight: appearance.bold ? 800 : 600,
          fontSize: `${(appearance.fontSize + 2) * ((nameSize ?? 130) / 100)}px`,
          lineHeight: 1.25,
          textAlign: appearance.align === "left" ? "left" : appearance.align === "right" ? "right" : "center",
        }}>
          {(labelText.name.includes("\n") ? labelText.name.split("\n").filter((l) => l.trim()) : splitMedicationText(labelText.name)).map((line, i) => (
            <Box key={i}>{line}</Box>
          ))}
        </Box>
      )}
      {!showNamePlaceholder && fields.status && labelText.status && (
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
        <Box sx={{
          position: "absolute",
          left: `${(qrPos?.x ?? 20)}%`, top: `${(qrPos?.y ?? 87)}%`,
          transform: "translate(-50%, -50%)",
          bgcolor: "#fff", p: "3px", borderRadius: "3px", lineHeight: 0,
        }}>
          <MemoBarcode
            value={labelText.code || labelText.name}
            width={Math.max(0.6, 1.3 * ((qrSize ?? 40) / 40))}
            height={Math.max(20, mmToPx(height) * 0.18 * ((qrSize ?? 40) / 40))}
            fontSize={Math.max(8, (appearance.fontSize - 5) * ((qrSize ?? 40) / 40))}
            lineColor={appearance.text}
          />
        </Box>
      )}
      {fields.action && labelText.action ? (
        <Box sx={{
          mt: "auto", width: "100%", bgcolor: appearance.accent, color: "#fff",
          WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
          fontWeight: 800, fontSize: `${appearance.fontSize + 1}px`,
          textAlign: "center", borderRadius: "3px", py: 0.5, letterSpacing: 0.5,
        }}>
          {labelText.action}
        </Box>
      ) : null}
      {fields.message && labelText.message && (
        <Box sx={{
          position: "absolute",
          left: `${(messagePos?.x ?? 50)}%`, top: `${(messagePos?.y ?? 90)}%`,
          transform: "translate(-50%, -50%)",
          width: "88%",
          bgcolor: appearance.accent, color: "#fff",
          WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
          fontWeight: 800, fontSize: `${appearance.fontSize + 1}px`,
          textAlign: "center", borderRadius: "3px", py: 0.5, letterSpacing: 0.5,
        }}>
          {labelText.message}
        </Box>
      )}
    </Box>
  );
}

// Memoized so dragging an unrelated slider (logo/message position, etc.) or
// typing in an unrelated field doesn't regenerate this SVG — it only
// recomputes when the actual QR value/size change.
const MemoQRCode = React.memo(function MemoQRCode({ value, size }) {
  return <QRCodeSVG value={value} size={size} level="H" />;
});

// Same reasoning as MemoQRCode, for the linear barcode.
const MemoBarcode = React.memo(function MemoBarcode({ value, width, height, fontSize, lineColor }) {
  return (
    <Barcode value={value} format="CODE128" width={width} height={height} fontSize={fontSize}
      margin={0} background="transparent" lineColor={lineColor} />
  );
});