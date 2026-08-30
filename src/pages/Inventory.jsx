import { getDrugCategories } from "../data/getDrugCategories";
import { Mail, MessageCircle, User, Lock, Eye, EyeOff, Upload, Download, Ear, AlertTriangle } from "lucide-react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";

// كاش بمستوى الملف (مو داخل الكومبوننت) يفضل موجود بالذاكرة حتى لو انتقلت
// لصفحة ثانية ورجعت لنفس التبويب — يمنع ظهور شاشة "Loading" من جديد في كل
// مرة تدخلين فيها الصفحة، وبنفس الوقت نحدّث البيانات بالخلفية بهدوء
let medicinesCache = null;
let sectionsCache = null;

const MEDICINES_COLLECTION = "medicines";
const SETTINGS_DOC_REF = () => doc(db, "settings", "sections");

// البيانات الافتراضية اللي تظهر أول مرة بس لو قاعدة البيانات فاضية تمامًا
// (نفس البيانات اللي كانت مكتوبة كـ fallback مع localStorage)
const DEFAULT_MEDICINES = [
  {
    id: "1",
    name: "Panadol",
    quantity: 20,
    expiry: "2026-12-01",
    barcode: "628100000001",
    shelf: "A1",
    code: "",
    otherNames: [],
  },
  {
    id: "2",
    name: "Augmentin",
    quantity: 10,
    expiry: "2026-09-15",
    barcode: "628100000002",
    shelf: "B3",
    code: "",
    otherNames: [],
  },
  {
    id: "3",
    name: "Vitamin C",
    quantity: 30,
    expiry: "2027-01-20",
    barcode: "628100000003",
    shelf: "C2",
    code: "",
    otherNames: [],
  },
];

// يجيب كل الأدوية من مجموعة "medicines" بفايرستور (مستند مستقل لكل دواء)
// ونرتبها حسب حقل "order" (فايرستور ما يحفظ ترتيب الإدراج تلقائيًا، فلازم
// نخزن رقم الترتيب بأنفسنا ونرتب بيه وقت الجلب، وإلا يطلع ترتيب عشوائي)
async function fetchMedicinesFromFirestore() {
  const snapshot = await getDocs(collection(db, MEDICINES_COLLECTION));
  const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return list;
}

// يبني نسخة موحّدة (id ثابت + ترتيب حسب الموقع الحالي) من قائمة الأدوية،
// وبنفس الوقت خارطة "id -> نص JSON" لمحتوى كل دواء — نستخدمها كمرجع
// لمقارنة أي تغيير فعلي قبل الكتابة، ولتأسيس lastSyncedContentRef فور
// التحميل من الكاش/فايرستور عشان أول تعديل بسيط ما يعيد كتابة كل شي
function buildMedicineSyncSnapshot(list) {
  const withIds = list.map((m, index) => ({
    ...m,
    id: m.id !== undefined && m.id !== null ? String(m.id) : crypto.randomUUID(),
    order: index,
  }));
  const contentMap = new Map();
  withIds.forEach((m) => contentMap.set(m.id, JSON.stringify(m)));
  return { withIds, contentMap };
}

// يحفظ/يحدّث كل دواء بمستند خاص فيه (بنفس الـ id المستخدم بالتطبيق أصلاً)،
// ويحذف أي مستند قديم ما عاد موجود بالمصفوفة الجديدة (يعني انحذف أو اندمج
// بدواء ثاني). نستخدم هذي الدالة الموحّدة بدل كل استدعاء localStorage.setItem
// عشان سلوك الحفظ يبقى مطابق تمامًا للي كان قبل، بدون ما نلمس أي منطق ثاني
//
// تحسين أداء: قبل كانت هذي الدالة تعيد كتابة (setDoc) كل دواء موجود بالقائمة
// في كل مرة يتغير فيها أي شيء بسيط — حتى لو دواء واحد بس انحذف أو انعدّل،
// كانت تكتب مئات المستندات الثابتة من جديد فوق بعض. هذا هو السبب الحقيقي
// وراء بطء الحذف/التراجع/تفريغ السلة: كل عملية كانت تنتظر Promise.all ضخم
// لمئات الكتابات المتزامنة، وأحيانًا لو صار تنقل بين الصفحات قبل ما تخلص،
// كان يرجع يجيب نسخة فايرستور القديمة (لأن الحذف الفعلي بعده يعالج بالطابور).
// الحل: نقارن محتوى كل دواء بآخر نسخة كتبناها فعليًا (lastSyncedContent)،
// ونكتب فقط اللي تغيّر محتواه أو جديد — الباقي ما نلمسه أبدًا
async function syncMedicinesToFirestore(newMedicines, previousIds, lastSyncedContent) {
  const { withIds, contentMap } = buildMedicineSyncSnapshot(newMedicines);

  const newIds = new Set(withIds.map((m) => m.id));
  const idsToDelete = [...(previousIds || [])].filter((id) => !newIds.has(id));

  // نفس إصلاح "حذف الكل" و"تفريغ السلة" - دفعات (batch) بدل مئات الطلبات
  // المتوازية بنفس اللحظة. هذي الدالة بالذات هي العمود الفقري لأي حفظ عادي
  // بالتطبيق (إضافة/تعديل/استيراد إكسل كبير)، فأثرها أوسع من أي مكان ثاني
  const ops = [];
  withIds.forEach((m) => {
    const serialized = contentMap.get(m.id);
    if (!lastSyncedContent || lastSyncedContent.get(m.id) !== serialized) {
      ops.push((batch) => batch.set(doc(db, MEDICINES_COLLECTION, m.id), m));
    }
  });
  idsToDelete.forEach((id) => {
    ops.push((batch) => batch.delete(doc(db, MEDICINES_COLLECTION, id)));
  });

  const CHUNK_SIZE = 450;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    ops.slice(i, i + CHUNK_SIZE).forEach((apply) => apply(batch));
    await batch.commit();
  }

  return { ids: newIds, medicines: withIds, contentMap };
}

// يحذف مستند دواء واحد فورًا من فايرستور — نستخدمها مباشرة وقت الحذف بدل
// ما ننتظر المزامنة العامة (اللي صارت الآن مؤجّلة/debounced، فممكن تتأخر
// نص ثانية أو أكثر). هذا يضمن إن الدواء المحذوف يختفي فعليًا من السيرفر
// فورًا، حتى لو المستخدم بسرعة سكّر الصفحة أو رجعها قبل ما تخلص المزامنة
// العامة — نفس السبب اللي كان يخلي أدوية محذوفة "ترجع" بعد شوي
async function deleteMedicineDocImmediately(id) {
  await deleteDoc(doc(db, MEDICINES_COLLECTION, String(id)));
}

// يمسح كل الأدوية من فايرستور (يستخدم بدل localStorage.removeItem)
async function clearAllMedicinesInFirestore(previousIds) {
  await Promise.all(
    [...(previousIds || [])].map((id) => deleteDoc(doc(db, MEDICINES_COLLECTION, id)))
  );
}

// الأقسام (قائمة أسماء بسيطة) نخزنها بمستند إعدادات واحد بدل مجموعة كاملة
async function fetchSectionsFromFirestore() {
  const snap = await getDoc(SETTINGS_DOC_REF());
  return snap.exists() ? snap.data().list || [] : [];
}

async function persistSectionsToFirestore(list) {
  await setDoc(SETTINGS_DOC_REF(), { list });
}

// سلة المهملات: مجموعة منفصلة "medicines_trash"، كل دواء محذوف يحفظ فيها
// مع وقت الحذف، عشان نقدر نرجّعه أو ننظف اللي أقدم من شهر
const TRASH_COLLECTION = "medicines_trash";
const TRASH_RETENTION_DAYS = 30;

async function fetchTrashFromFirestore() {
  const snapshot = await getDocs(collection(db, TRASH_COLLECTION));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function restoreMedicineFromTrash(item) {
  const { deletedAt, ...rest } = item;
  const id = String(item.id);
  await setDoc(doc(db, MEDICINES_COLLECTION, id), rest);
  await deleteDoc(doc(db, TRASH_COLLECTION, id));
}

async function permanentlyDeleteFromTrash(id) {
  await deleteDoc(doc(db, TRASH_COLLECTION, String(id)));
}

async function emptyTrashInFirestore(items) {
  // نفس إصلاح "حذف الكل" بالانفنتوري - دفعات بدل مئات الطلبات المتوازية
  const CHUNK_SIZE = 450;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    items.slice(i, i + CHUNK_SIZE).forEach((item) => {
      batch.delete(doc(db, TRASH_COLLECTION, String(item.id)));
    });
    await batch.commit();
  }
}

// تنظيف تلقائي لأي عنصر بسلة المهملات أقدم من ٣٠ يوم — نسويها وقت فتح
// الصفحة بدل جدولة سيرفر (Cloud Functions المجدولة تحتاج خطة Blaze
// المدفوعة)، فهذا الأسلوب يشتغل بالكامل ضمن الخطة المجانية
async function cleanupOldTrashItems() {
  try {
    const items = await fetchTrashFromFirestore();
    const cutoff = Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const expired = items.filter((item) => (item.deletedAt || 0) < cutoff);
    if (expired.length > 0) {
      const CHUNK_SIZE = 450;
      for (let i = 0; i < expired.length; i += CHUNK_SIZE) {
        const batch = writeBatch(db);
        expired.slice(i, i + CHUNK_SIZE).forEach((item) => {
          batch.delete(doc(db, TRASH_COLLECTION, String(item.id)));
        });
        await batch.commit();
      }
    }
    return items.filter((item) => (item.deletedAt || 0) >= cutoff);
  } catch (err) {
    console.error("فشل تنظيف سلة المهملات القديمة:", err);
    return [];
  }
}

// يحوّل الأرقام العربية (١٢٣) والفارسية (۱۲۳) إلى أرقام إنجليزية عادية
// عشان لما المستخدم يكتب كمية أو تاريخ بالأرقام العربية ما تصير NaN
function normalizeDigits(value) {
  if (value === null || value === undefined) return value;
  const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  return String(value).replace(/[٠-٩۰-۹]/g, (ch) => {
    const arabicIdx = arabicIndic.indexOf(ch);
    if (arabicIdx !== -1) return String(arabicIdx);
    const persianIdx = persian.indexOf(ch);
    if (persianIdx !== -1) return String(persianIdx);
    return ch;
  });
}

// كمية الدواء أحيانًا تُخزّن كنص فيه وحدة القياس ملتصقة به (مثل "150 tab" أو
// "6 injections" — زي ما توصل من ملفات إكسل NUPCO)، فـ Number(...) عليها
// مباشرة يرجع NaN وأي مقارنة رقمية (Low Stock، الترتيب...) تفشل بصمت. هذي
// الدالة تسحب أول رقم موجود بالنص وتتجاهل الوحدة، بدل ما تعتمد على القيمة
// تكون رقم صافي دايمًا. تطبّع الأرقام العربية/الفارسية أول شي كمان، لأن
// استيراد الإكسل ما يمرّ بـ normalizeDigits زي إدخال المستخدم اليدوي
function parseQuantityNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const normalized = normalizeDigits(value);
  const match = String(normalized).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

// يبني قائمة أرقام الصفحات اللي تظهر بشريط الترقيم الاحترافي (زي "1 2 3 ... 29")
// — يعرض دايمًا أول وآخر صفحة، وصفحة أو صفحتين حوالين الصفحة الحالية،
// ويحط "..." بمكان أي فجوة أكبر من صفحة وحدة بينهم
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

// شريط الترقيم يحسب "من/إلى/آخر صفحة" بناءً على عدد الأدوية الحقيقية بس
// (يستثني صفوف عناوين الأقسام لأنها مو أدوية فعلية). المشكلة كانت إن
// عملية التقطيع الفعلية بالجدول كانت تسحب ٥٠ عنصر من المصفوفة الكاملة
// (اللي فيها صفوف الأقسام مندمجة) — يعني لو وقع صف قسم أو أكثر داخل
// نطاق الصفحة، تاخذ مكان دواء حقيقي وتقل الأدوية المعروضة فعليًا عن ٥٠،
// وبتراكم هالفرق البسيط عبر الصفحات، آخر صفحة (اللي فيها عدد أقل من
// rowsPerPage أصلاً) توصل لمحتوى ناقص أو غير متطابق مع رقم الصفحة المحسوب.
// هذي الدالة تقطّع بالاعتماد على عدّاد "أدوية حقيقية" بس، وتضيف صف القسم
// معها لو وقع بنفس نطاق الصفحة — فرقم الصفحة يطابق تمامًا عدد الأدوية
// الحقيقية المعروضة، بغض النظر عن كم صف قسم موجود بينهم
function getMedicinePageSlice(list, page, rowsPerPage) {
  const startIdx = page * rowsPerPage;
  const endIdx = startIdx + rowsPerPage;
  const result = [];
  let realCount = 0;

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const isRealMedicine = !item.isSection;

    if (realCount >= startIdx && realCount < endIdx) {
      result.push(item);
    }

    if (isRealMedicine) {
      realCount++;
      if (realCount >= endIdx) break;
    }
  }

  return result;
}

// يقبل أي صيغة تاريخ يكتبها المستخدم بحرية (يوم كامل أو شهر وسنة بس)
// ويحولها لنفس صيغة "YYYY-MM-DD" اللي نستخدمها بالتطبيق، بنفس منطق
// استيراد الإكسل بالضبط: لو ماكتب يوم، ياخذ آخر يوم بالشهر تلقائيًا
function parseFlexibleDate(value) {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  const parsed = extractAllDates(trimmed);
  return parsed.length ? parsed[0] : trimmed;
}

// يفكك نص الكمية اللي نصدّره إحنا بصيغة "180 + 20" (لما يعيد المستخدم استيراد
// ملف صدّرناه هو نفسه) إلى شحنات منفصلة زي ما كانت بالضبط قبل التصدير
function splitExportedQuantities(qtyText) {
  if (!qtyText) return [];
  return String(qtyText)
    .split("+")
    .map((q) => q.trim())
    .filter((q) => q !== "");
}

// يفكك عمود الـ Labels اللي نصدّره بصيغة "🏷️ الاسم (#8B5CF6); ..." إلى
// مصفوفة ليبلز جاهزة لنفس الشكل اللي يستخدمه التطبيق {name, color, icon}
function parseExportedLabels(labelsText) {
  if (!labelsText) return [];
  return String(labelsText)
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const colorMatch = entry.match(/\(#([0-9A-Fa-f]{6})\)\s*$/);
      const color = colorMatch ? `#${colorMatch[1]}` : "#8B5CF6";
      const rest = colorMatch ? entry.slice(0, colorMatch.index).trim() : entry;
      const iconMatch = rest.match(/^(\S+)\s+(.*)$/);
      const icon = iconMatch ? iconMatch[1] : "🏷️";
      const name = iconMatch ? iconMatch[2] : rest;
      return { name: name || "Label", color, icon };
    });
}

// استخراج الكود والاسم من صف إكسل خام، بنفس الطريقة المستخدمة داخل
// processExcelImport بالضبط، عشان فلترة "الصفوف المتبقية" بنافذة التكرار تتطابق
function extractRowCode(item) {
  const rawCode =
    item["Generic Item Number"] || item["Trade Item Number"] || item["Item No"] ||
    item["NUPCO Code"] || item["Nupco Code"] || item["NUPCO"] || item["Nupco"] ||
    item["Moh Code"] || item["MohCode"] || "";
  let code = String(rawCode).trim();
  if (code.toLowerCase() === "-") code = "";
  return code;
}

function extractRowName(item) {
  const rawName = item["Trade Description"] || item["Name"] || item["Drug Name"] || item["Medicine Name"] || "";
  return String(rawName).trim();
}

import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import LocalPharmacyIcon from "@mui/icons-material/LocalPharmacy";
import { availableLabels } from "../data/drugCategories";
import { ministryMedicines } from "../data/ministryMedicines";
// تحويل قائمة أدوية الوزارة إلى خريطة تعتمد على كود نيبكو كمفتاح أساسي
const ministryDatabase = ministryMedicines.reduce((acc, item) => {
  const code = String(item.nupcoCode || item.NUPCO_Code || item.code || "").trim();
  const desc = item.description || item.Description || "";
  if (code) acc[code] = desc;
  return acc;
}, {});

// فهرس عكسي (اسم الدواء بأحرف صغيرة -> {code, name}) نستخدمه لمّا يكتب
// المستخدم الاسم مباشرة ونبي نقترح له كود النيبكو المطابق، وقائمة
// [code, name] جاهزة للبحث بالـ "يبدأ بـ" أثناء كتابة الكود تدريجيًا
const ministryNameToCode = {};
Object.entries(ministryDatabase).forEach(([code, name]) => {
  const key = String(name || "").trim().toLowerCase();
  if (key && !(key in ministryNameToCode)) {
    ministryNameToCode[key] = { code, name };
  }
});
const ministryCodeEntries = Object.entries(ministryDatabase);

// يقترح دواء واحد فقط بناءً على أول أرقام كتبها المستخدم من الكود (يبدأ
// بها الكود، مو موجودة بأي مكان منه — عشان ما نرجع لنفس مشكلة التخمين
// العشوائي). يرجع null لو الكتابة لسا قصيرة جدًا (أقل من ٤ أرقام) عشان
// ما نطلع اقتراح ضعيف الثقة بأول رقم أو رقمين
function findCodeSuggestionByPartialCode(partial) {
  if (!partial || partial.length < 4) return null;
  const match = ministryCodeEntries.find(([code]) => code.startsWith(partial));
  return match ? { code: match[0], name: match[1] } : null;
}

// نفس الفكرة بالاتجاه المعاكس: يقترح كود بناءً على أول أحرف كتبها المستخدم
// من اسم الدواء
function findNameSuggestionByPartialName(partial) {
  const key = String(partial || "").trim().toLowerCase();
  if (!key || key.length < 4) return null;
  const matchKey = Object.keys(ministryNameToCode).find((name) => name.startsWith(key));
  return matchKey ? ministryNameToCode[matchKey] : null;
}

import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import React, { useState, useEffect, useRef, useMemo } from "react";
import SettingsIcon from "@mui/icons-material/Settings";
import * as XLSX from "xlsx";
import CheckIcon from "@mui/icons-material/Check";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import RestoreFromTrashIcon from "@mui/icons-material/RestoreFromTrash";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import Tooltip from "@mui/material/Tooltip";
import {
  List,
  ListItem,
  ListItemText,
  Container,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Box,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TablePagination,
  Link,
  Snackbar,
  Alert,
  Badge,
  CircularProgress,
    Menu,
} from "@mui/material";

import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import CategoryIcon from "@mui/icons-material/Category";
import KeyboardDoubleArrowDownIcon from "@mui/icons-material/KeyboardDoubleArrowDown";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import KeyboardTabIcon from "@mui/icons-material/KeyboardTab";
import { useNavigate, useLocation } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { importExcel } from "../utils/excelImporter";
import { extractAllDates } from "../utils/dateParser";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import Stack from "@mui/material/Stack";

// أيقونة "Look Alike" مرسومة يدوي عشان تطابق الستايل المعتمد بالضبط (شكل
// العين الحبة + بؤبؤ فيه "لمعة" بالزاوية) — ما كانت موجودة جاهزة
// بأي مكتبة أيقونات (lucide/MUI)، فبنيناها كـ SVG مخصص بنفس منطق باقي الأيقونات
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


function Inventory() {
    const navigate = useNavigate();
    const location = useLocation();
  const [open, setOpen] = useState(false);
  const hiddenDateInputRefs = useRef({});
  const [copiedId, setCopiedId] = useState(null);
const [labelOpen, setLabelOpen] = useState(false);
const [labelMedicine, setLabelMedicine] = useState(null);
const [labelName, setLabelName] = useState("");
const [labelColor, setLabelColor] = useState("#8B5CF6");
const [labelIcon, setLabelIcon] = useState("🏷️");
const [selectedCategory, setSelectedCategory] = useState("All");
const [selectedStatus, setSelectedStatus] = useState("All");
const [excelAnchorEl, setExcelAnchorEl] = useState(null);

// نقرأ فلتر الحالة اللي توديه بطاقات الداش بورد عبر الرابط (?filter=expired وغيرها)
// ونطبّقه على نفس فلتر الحالة الموجود أصلاً بالصفحة، عشان الضغط على أي بطاقة
// (Total / Safe / Near Expiry / Expired) يفتح الانفنتوري بالفلتر الصحيح فعليًا
useEffect(() => {
  const params = new URLSearchParams(location.search);
  const filterKey = params.get("filter");

  const filterKeyToStatus = {
    all: "All",
    safe: "Safe",
    near: "Near Expiry",
    expired: "Expired",
    "low-stock": "Low Stock",
  };

  if (filterKey && filterKeyToStatus[filterKey]) {
    setSelectedStatus(filterKeyToStatus[filterKey]);
  }

  // نفس الفكرة لما توديك بطاقة نتيجة بحث (من الداش بورد مثلاً) لدواء معيّن
  // بالضبط عبر ?highlight=<id> — نصفّر أي فلاتر/بحث نشط عشان الدواء ما يكون
  // مخفي، ونسجّل رقمه عشان نروح لصفحته الصحيحة ونومض عليه بالجدول
  const highlightId = params.get("highlight");
  if (highlightId) {
    setSearch("");
    setSelectedCategory("All");
    setSelectedStatus("All");
    setHighlightedMedicineId(highlightId);
  }
}, [location.search]);

// مراجع صفوف الجدول (حسب id الدواء) عشان نقدر نسكرول لصف معيّن ونومض عليه
const rowRefs = useRef({});
const [highlightedMedicineId, setHighlightedMedicineId] = useState(null);

const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
const [exportDialogOpen, setExportDialogOpen] = useState(false);

// آخر مرة تم فيها تصدير إكسل (يُستخدم أيضًا كـ Backup للمخزون)
const [lastBackupDate, setLastBackupDate] = useState(null);

useEffect(() => {
  (async () => {
    try {
      const snap = await getDoc(doc(db, "settings", "backup"));
      if (snap.exists()) {
        setLastBackupDate(snap.data().lastBackupDate || null);
      }
    } catch (err) {
      console.error("فشل تحميل تاريخ آخر نسخة احتياطية:", err);
    }
  })();
}, []);
const [exportColumns, setExportColumns] = useState({
  name: true,
  code: true,
  quantity: true,
  expiry: true,
  status: true,
  mawsool: true,
  labels: false,
});
const [pendingExcelRows, setPendingExcelRows] = useState([]);
const [duplicateSummary, setDuplicateSummary] = useState([]);

const [isMerging, setIsMerging] = useState(false);

const [page, setPage] = useState(0);
const [rowsPerPage, setRowsPerPage] = useState(50); // عرض 50 دواء في الصفحة الواحدة

const [dupPage, setDupPage] = useState(0);
const [dupRowsPerPage, setDupRowsPerPage] = useState(10); // عرض 10 أدوية مكررة في كل صفحة داخل النافذة

const [openSectionsDialog, setOpenSectionsDialog] = useState(false);
const [newSection, setNewSection] = useState("");

const [sections, setSections] = useState([]);
  const handleAddSection = () => {
  if (!newSection.trim()) return;

  if (sections.includes(newSection.trim())) return;

  const updatedSections = [...sections, newSection.trim()];
  setSections(updatedSections);
  
  const newSecItem = {
    id: crypto.randomUUID(),
    name: newSection.trim(),
    isSection: true,
    quantity: "",
    expiryDates: [],
    otherNames: [newSection.trim()]
  };

  const updatedMedicines = [...medicines, newSecItem];
  setMedicines(updatedMedicines);
  setNewSection("");
};

const handleDeleteSection = (sectionName) => {
  const updatedSections = sections.filter((s) => s !== sectionName);
  setSections(updatedSections);
  
  const updatedMedicines = medicines.filter((m) => !(m.isSection && m.name === sectionName));
  setMedicines(updatedMedicines);
  persistMedicines(updatedMedicines);
};
 

const [medicines, setMedicines] = useState([]);
const [medicinesLoading, setMedicinesLoading] = useState(true);
// نتتبع بيها كل الـ id الموجودة حاليًا بفايرستور، عشان نعرف وقت الحفظ
// أي مستند لازم نحذفه (صار محذوف أو مدموج) وأينا نضيف/نحدّث بس
const knownMedicineIdsRef = useRef(new Set());
// آخر محتوى فعليًا مكتوب بفايرستور لكل دواء (id -> نص JSON) — نقارن عليه
// قبل أي كتابة جديدة عشان ما نعيد كتابة مستندات ما تغيّرت أبدًا
const lastSyncedContentRef = useRef(new Map());
// مؤقّت تأجيل الحفظ: لمن يصير أكثر من تغيير سريع متتالي (مثل حذف دوائين
// بسرعة)، ننتظر شوي ونجمعهم بمزامنة وحدة بدل ما نطلق مزامنة ضخمة منفصلة
// لكل تغيير — يقلل الضغط على فايرستور بشكل كبير وبالتالي بطء العمليات
const persistDebounceRef = useRef(null);
// لو true، معناه آخر setMedicines() كان تحميل بيانات (من الكاش أو من فايرستور
// مباشرة) مو تعديل حقيقي من المستخدم — فما نبيه نعيد كتابته فوق فايرستور
// (كان سبب مشكلة رجوع البيانات القديمة: صفحة ثانية زي موصول تعدّل مستند
// معيّن مباشرة بفايرستور، ثم لما نرجع لصفحة الانفنتوري كانت تحمّل الكاش
// القديم وتعيد حفظه بالكامل فوق التعديل الجديد قبل ما يوصل التحميل الطازج)
const skipNextPersistRef = useRef(false);

// دالة الحفظ الموحّدة: تستبدل كل استدعاء localStorage.setItem("medicines", ...)
// بمزامنة فعلية مع Firestore (إضافة/تحديث/حذف حسب الفرق)، بدون ما نغيّر أي
// منطق ثاني بالتطبيق — نفس مكان الاستدعاء، نفس المعطى، بس التخزين يتغيّر
const persistMedicines = (list) => {
  medicinesCache = list; // نحدّث الكاش فورًا (محليًا) عشان أي رجوع للصفحة يشوف آخر حالة

  if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
  persistDebounceRef.current = setTimeout(() => {
    syncMedicinesToFirestore(list, knownMedicineIdsRef.current, lastSyncedContentRef.current)
      .then(({ ids, contentMap }) => {
        knownMedicineIdsRef.current = ids;
        lastSyncedContentRef.current = contentMap;
      })
      .catch((err) => {
        console.error("فشل حفظ الأدوية بـ Firestore:", err);
        setSyncErrorOpen(true);
      });
  }, 400);
};

useEffect(() => {
  // لو عندنا نسخة محفوظة بالذاكرة من قبل (رجعنا لنفس التبويب)، نعرضها فورًا
  // بدون شاشة تحميل، ونحدّثها بهدوء بالخلفية بدل ما نوقف الواجهة على الفارغ
  if (medicinesCache !== null) {
    const { contentMap } = buildMedicineSyncSnapshot(medicinesCache);
    knownMedicineIdsRef.current = new Set(medicinesCache.map((m) => m.id));
    lastSyncedContentRef.current = contentMap;
    skipNextPersistRef.current = true; // تحميل من الكاش، مو تعديل — لا نحفظه
    setMedicines(medicinesCache);
    setSections(sectionsCache || []);
    setMedicinesLoading(false);
  }

  (async () => {
    try {
      const [loadedMedicines, loadedSections] = await Promise.all([
        fetchMedicinesFromFirestore(),
        fetchSectionsFromFirestore(),
      ]);

      const { contentMap } = buildMedicineSyncSnapshot(loadedMedicines);
      knownMedicineIdsRef.current = new Set(loadedMedicines.map((m) => m.id));
      lastSyncedContentRef.current = contentMap;
      skipNextPersistRef.current = true; // تحميل طازج من فايرستور، مو تعديل — لا نحفظه
      setMedicines(loadedMedicines);
      setSections(loadedSections);

      medicinesCache = loadedMedicines;
      sectionsCache = loadedSections;
    } catch (err) {
      console.error("فشل تحميل البيانات من Firestore:", err);
    } finally {
      setMedicinesLoading(false);
    }
  })();
}, []);

useEffect(() => {
  (async () => {
    const activeTrash = await cleanupOldTrashItems();
    setTrashItems(activeTrash);
  })();
}, []);

 const [newMedicine, setNewMedicine] = useState({
  name: "",
  batch: "",
  expiry: "",
  expiryDates: [""],
  quantity: "",
  reorderLevel: "20",
  shelf: "",
  barcode: "",
  code: "",
  otherNames: [],
});

const [editIndex, setEditIndex] = useState(null);
const [search, setSearch] = useState("");

// لمن يتغيّر البحث أو أي فلتر (تصنيف/حالة)، نرجع لأول صفحة تلقائيًا —
// وإلا لو كنت واقف بآخر صفحة (مثلاً صفحة ١٢) وبحثت عن دواء، النتيجة
// المطابقة تكون بأول الصفحات المفلترة الجديدة، لكن رقم الصفحة يفضل
// عالق على ١٢ فيطلع الجدول فاضي وكأن ماكو نتيجة، مع إن النتيجة موجودة
// فعلاً بس مو بنفس رقم الصفحة القديم
useEffect(() => {
  setPage(0);
}, [search, selectedCategory, selectedStatus]);
// true لو المستخدم كتب كود نيبكو وما انطابق مع أي اسم بقاعدة بيانات الوزارة
const [codeNotRecognized, setCodeNotRecognized] = useState(false);
const [codeTooLong, setCodeTooLong] = useState(false);
// اقتراح شفاف (مو تعبئة إجبارية) يظهر وإحنا لسا بنص الكتابة — إما اقتراح
// اسم بناءً على أول أرقام الكود، أو اقتراح كود بناءً على أول أحرف الاسم.
// المستخدم يقبله بضغطة Tab أو Enter، وإلا يفضل مجرد اقتراح بدون أي تأثير
const [codeSuggestion, setCodeSuggestion] = useState(null);
const [nameSuggestion, setNameSuggestion] = useState(null);

// سلة المهملات
const [trashItems, setTrashItems] = useState([]);
const [trashOpen, setTrashOpen] = useState(false);
const [trashPage, setTrashPage] = useState(0);
const [trashRowsPerPage, setTrashRowsPerPage] = useState(25);
// يظهر أثناء تنفيذ "حذف الكل نهائيًا" - عشان يوضح إنه قيد التنفيذ فعليًا
// مو إن الموقع متعلّق، خصوصًا إن العملية تاخذ وقت حقيقي لو فيه مئات العناصر
const [emptyingTrash, setEmptyingTrash] = useState(false);
// يظهر أثناء "Clear Inventory" (نقل كل الأدوية للسلة) - نستخدمه لعرض سبينر
// على زر Trash نفسه لين كل الأدوية توصل فعليًا للسلة
const [clearingInventory, setClearingInventory] = useState(false);
const [pendingDelete, setPendingDelete] = useState(null);
const [undoSnackOpen, setUndoSnackOpen] = useState(false);
// يظهر لو ضغطنا UNDO لكن الكتابة الفعلية على فايرستور فشلت — بدون هذا
// تنبيه، المستخدم يشوف الدواء رجع بالجدول ويفتكر التراجع نجح وهو فعليًا
// لسا محذوف بالسيرفر (نفس السبب اللي كان يخلي الدواء "يرجع يختفي" بعد تحديث الصفحة)
const [undoFailedOpen, setUndoFailedOpen] = useState(false);
// تنبيه هادئ بس لو المزامنة العامة بالخلفية (أي تعديل عادي: إضافة/تعديل/كمية)
// فشلت — بنفس مستوى بساطة إشعار "تراجع" فوق، مو تنبيه أحمر مزعج
const [syncErrorOpen, setSyncErrorOpen] = useState(false);
// أثناء نقل دواء لسلة المهملات نعطّل زره ونعرض دوّامة تحميل بدل الأيقونة،
// عشان المستخدم يعرف إن الضغطة انسجلت ولا يضغط عليها مرتين وهو منتظر
const [deletingIds, setDeletingIds] = useState(() => new Set());

// دالة جلب الاسم تلقائياً وسريعة جداً عند كتابة الكود يدوياً
const NUPCO_CODE_LENGTH = 13;

// استثناء: بعض أكواد النيبكو تشترك بين صنفين مختلفين تمامًا (نفس الكود
// بقاعدة بيانات الوزارة لكن يمثل دوائين منفصلين، مثل "المذيب" و"اللقاح
// نفسه"، أو اسمين مختلفين لنفس المستحضر الغذائي). لمن يكتب المستخدم أحد
// هذي الأكواد، نعرض له خانتين اسم دواء بدل وحدة، وبمجرد ما يضغط "إضافة"
// ينحفظون كصنفين منفصلين تمامًا (بكميات وتواريخ انتهاء منفصلة كل وحدة)
const SHARED_CODE_EXCEPTIONS = {
  "5013170108400": ["NUTRITION MODULAR LIQ MCT OIL", "MODULAR LIQUID MEDIUM CHAIN TRIGLYCERIDE"],
  "5120160000200": ["DILUENT FOR BCG VACCINE", "BCG VACCINE 0.25MG INJECTION"],
  "5120160000700": ["PLASTIC DROPPER FOR ORAL POLIO", "POLIOMYELITIS SEROTYPE 1 AND 3 VACCINE ORAL"],
};

const emptySecondMedicine = () => ({
  name: "",
  quantity: "",
  reorderLevel: "20",
  expiryDates: [""],
});

// true فقط لمن الكود المكتوب حاليًا موجود بقائمة الاستثناء أعلاه — يتحكم
// بإظهار خانة الدواء الثانية بنموذج الإضافة (وضع "التحرير" ما يستخدمها،
// لأنه يخص تعديل صنف واحد موجود أصلاً، مو إضافة جديدة)
const [isDualCodeEntry, setIsDualCodeEntry] = useState(false);
const [secondMedicine, setSecondMedicine] = useState(emptySecondMedicine());
const hiddenDateInputRefs2 = useRef([]);

const handleCodeChange = (e) => {
  const enteredCode = e.target.value.trim();
  setNewMedicine((prev) => ({ ...prev, code: enteredCode }));
  setCodeSuggestion(null);

  if (!enteredCode) {
    setCodeNotRecognized(false);
    setCodeTooLong(false);
    setIsDualCodeEntry(false);
    return;
  }

  if (enteredCode.length > NUPCO_CODE_LENGTH) {
    setCodeTooLong(true);
    setCodeNotRecognized(false);
    setIsDualCodeEntry(false);
    return;
  }
  setCodeTooLong(false);

  // نتحقق أولاً هل هذا الكود من الأكواد المشتركة الاستثنائية — لو نعم
  // نعبّي خانتي الاسم مباشرة وننهي هنا، بدون المرور بمنطق قاعدة بيانات
  // الوزارة العادي (اللي يفترض اسم واحد لكل كود)
  const exceptionNames = editIndex === null ? SHARED_CODE_EXCEPTIONS[enteredCode] : null;
  if (exceptionNames) {
    setNewMedicine((prev) => ({ ...prev, code: enteredCode, name: exceptionNames[0] }));
    setSecondMedicine((prev) => ({ ...prev, name: exceptionNames[1] }));
    setIsDualCodeEntry(true);
    setCodeNotRecognized(false);
    return;
  }
  setIsDualCodeEntry(false);

  // مطابقة تامة فقط — هذي وحدها آمنة تعبي خانة الاسم تلقائيًا وفورًا، بغض
  // النظر عن طول الكود لين الآن، لأنها مطابقة دقيقة ١٠٠٪؜ مو تخمين
  if (ministryDatabase[enteredCode]) {
    setNewMedicine((prev) => ({ ...prev, code: enteredCode, name: ministryDatabase[enteredCode] }));
    setCodeNotRecognized(false);
    return;
  }

  // لسا ما وصل الطول الكامل (١٣ رقم) — نعرض اقتراح شفاف تحت الخانة بس،
  // وما نلمس خانة الاسم ولا نطلع تحذير "غير موجود" لين يخلص من الكتابة.
  // هذا هو تحديدًا اللي كان يسبب قفز/رجفة اسم دواء غلط وهو لسا بأول
  // رقمين-ثلاثة من الكود (كان فيه بحث "يحتوي على" بأي مكان بالكود بدل
  // "يبدأ بـ"، فيطابق كود عشوائي تمامًا مالها علاقة بالي ينوي كتابته)
  if (enteredCode.length < NUPCO_CODE_LENGTH) {
    setCodeNotRecognized(false);
    setCodeSuggestion(findCodeSuggestionByPartialCode(enteredCode));
    return;
  }

  // وصل الطول الكامل وما فيه مطابقة تامة — نجرب تنظيف بسيط (شيل أي شي بعد
  // نقطة) بمطابقة تامة برضو، مو بحث "يحتوي على" عشوائي
  const cleanEntered = enteredCode.split(".")[0];
  const matchedKey = Object.keys(ministryDatabase).find((key) => key.split(".")[0] === cleanEntered);
  if (matchedKey) {
    setNewMedicine((prev) => ({ ...prev, code: enteredCode, name: ministryDatabase[matchedKey] }));
    setCodeNotRecognized(false);
  } else {
    // الكود مو موجود بقاعدة بيانات الوزارة — إما خطأ كتابة أو صنف جديد لسا ما انضاف
    // نفضّي حقل الاسم عشان ما يفضل اسم قديم من كود سابق كان متطابق
    setNewMedicine((prev) => ({ ...prev, code: enteredCode, name: "" }));
    setCodeNotRecognized(true);
  }
};

// لمن يكون فيه اقتراح شفاف (كود أو اسم) ظاهر، ضغطة Tab أو Enter تقبله
// وتعبي الخانتين مباشرة — بدون ما تقفل الديالوج أو تعمل أي حفظ فعلي
const handleCodeFieldKeyDown = (e) => {
  if ((e.key === "Tab" || e.key === "Enter") && codeSuggestion && newMedicine.code !== codeSuggestion.code) {
    e.preventDefault();
    setNewMedicine((prev) => ({ ...prev, code: codeSuggestion.code, name: codeSuggestion.name }));
    setCodeSuggestion(null);
    setCodeNotRecognized(false);
    setCodeTooLong(false);
  }
};

const handleNameFieldChange = (e) => {
  const value = e.target.value;
  setNewMedicine((prev) => ({ ...prev, name: value }));

  // اقتراح الكود من الاسم بس لمن خانة الكود لسا فاضية — لو المستخدم فعلاً
  // مسوي كود مخصص أو لسا يكتبه، ما نتدخل
  if (!newMedicine.code) {
    setNameSuggestion(findNameSuggestionByPartialName(value));
  } else {
    setNameSuggestion(null);
  }
};

const handleNameFieldKeyDown = (e) => {
  if ((e.key === "Tab" || e.key === "Enter") && nameSuggestion && !newMedicine.code) {
    e.preventDefault();
    setNewMedicine((prev) => ({ ...prev, code: nameSuggestion.code, name: nameSuggestion.name }));
    setNameSuggestion(null);
  }
};

// زر النسخ السريع للأكواد
const handleCopyCode = (codeText, id) => {
  navigator.clipboard.writeText(codeText);
  setCopiedId(id);
  setTimeout(() => {
    setCopiedId(null);
  }, 1500);
};
const handleToggleMawsool = (id) => {
    const updated = medicines.map((med) => {
      if (med.id === id) {
        return { ...med, mawsoolOrder: !med.mawsoolOrder };
      }
      return med;
    });
    setMedicines(updated);
  };

  const handleSave = () => {
   if (
 !newMedicine.name ||
 !newMedicine.quantity
) {
      alert("Please fill in the medicine name and quantity");
      return;
    }

// نضمن إن كل تاريخ اتكتب بأي صيغة (يوم كامل أو شهر/سنة بس) يتحول لصيغة موحدة
// قبل الحفظ، حتى لو المستخدم ما طلع من الحقل (onBlur) بعد الكتابة مباشرة
newMedicine.expiryDates = newMedicine.expiryDates.map((d) => parseFlexibleDate(d));

if (editIndex !== null) {
  // editIndex الحين يخزن id الدواء (مو رقم موقعه بالجدول) لنفس سبب مشكلة
  // الحذف: رقم الصف اللي يشوفه المستخدم يختلف عن موقع الدواء بالمصفوفة
  // الكاملة وقت وجود بحث/فلتر، فالبحث بالـ id يضمن تعديل نفس الدواء الصحيح
  const updatedMedicines = [...medicines];
  const targetIndex = updatedMedicines.findIndex((m) => m.id === editIndex);
  if (targetIndex !== -1) {
    updatedMedicines[targetIndex] = {
      ...newMedicine,
      id: updatedMedicines[targetIndex].id,
      expiry: newMedicine.expiryDates[0] || "",
      categories: getDrugCategories(newMedicine.name, newMedicine.code),
    };
  }

const handleLabelSave = () => {
  if (!labelName) return;

  const updated = medicines.map((med) => {
    if (med.id === labelMedicine.id) {
      return {
        ...med,
        labels: [
          ...(med.labels || []),
          {
            name: labelName,
            color: labelColor,
            icon: labelIcon,
          },
        ],
      };
    }

    return med;
  });

  setMedicines(updated);

  setLabelOpen(false);
  setLabelName("");
};
  setMedicines(updatedMedicines);
  setEditIndex(null);
} else if (isDualCodeEntry) {
  // هذا الكود من الأكواد المشتركة الاستثنائية: نحفظ الصنفين كسجلين
  // منفصلين تمامًا بنفس الكود، كل وحدة بكميتها وتواريخ انتهائها الخاصة
  if (!secondMedicine.name || !secondMedicine.quantity) {
    alert("Please fill in the name and quantity for the second item sharing this code");
    return;
  }
  const secondExpiryDates = secondMedicine.expiryDates.map((d) => parseFlexibleDate(d));

  const updatedMedicines = [
    ...medicines,
    {
      ...newMedicine,
      id: crypto.randomUUID(),
      isSection: false,
      expiry: newMedicine.expiryDates[0] || "",
      expiryDates: newMedicine.expiryDates.filter((d) => d),
      quantities: [newMedicine.quantity],
      categories: getDrugCategories(newMedicine.name, newMedicine.code),
      labels: [],
      otherNames: [newMedicine.name],
      dateAdded: new Date().toISOString(),
    },
    {
      name: secondMedicine.name,
      code: newMedicine.code,
      quantity: secondMedicine.quantity,
      reorderLevel: secondMedicine.reorderLevel || "20",
      id: crypto.randomUUID(),
      isSection: false,
      expiry: secondExpiryDates[0] || "",
      expiryDates: secondExpiryDates.filter((d) => d),
      quantities: [secondMedicine.quantity],
      categories: getDrugCategories(secondMedicine.name, newMedicine.code),
      labels: [],
      otherNames: [secondMedicine.name],
      dateAdded: new Date().toISOString(),
    },
  ];
  setMedicines(updatedMedicines);
  setIsDualCodeEntry(false);
  setSecondMedicine(emptySecondMedicine());
} else {
  // التحقق من تكرار الدواء: بالكود لو متوفر عند الاثنين، أو بالاسم لو الاثنين بدون كود
  const inputCode = String(newMedicine.code || "").trim();
  const inputHasCode = inputCode && inputCode.toLowerCase() !== "no code available";
  const inputName = String(newMedicine.name || "").trim().toLowerCase();

  const existingIndex = medicines.findIndex((m) => {
    if (m.isSection) return false;
    const mCode = String(m.code || "").trim();
    const mHasCode = mCode && mCode.toLowerCase() !== "no code available";
    const mName = String(m.name || "").trim().toLowerCase();

    if (inputHasCode && mHasCode) {
      return mCode.toLowerCase() === inputCode.toLowerCase();
    }
    if (!inputHasCode && !mHasCode) {
      return mName === inputName;
    }
    return false;
  });

  if (existingIndex !== -1) {
    // دواء مكرر — نعرض نفس نافذة التأكيد اللي تظهر عند استيراد الإكسل
    // بدل الدمج الصامت، عشان المستخدم يقدر يراجع أو يعدل الكمية أول
    const existing = medicines[existingIndex];
    setDuplicateSummary([
      {
        name: newMedicine.name,
        code: newMedicine.code || "",
        existingQty: existing.quantity,
        newQty: newMedicine.quantity,
        expiryDates: newMedicine.expiryDates.filter((d) => d),
      },
    ]);
    setOpen(false);
    setDuplicateModalOpen(true);
  } else {
    const updatedMedicines = [
      ...medicines,
      {
        ...newMedicine,
        id: crypto.randomUUID(),
        isSection: false,
        expiry: newMedicine.expiryDates[0] || "",
        expiryDates: newMedicine.expiryDates.filter((d) => d),
        quantities: [newMedicine.quantity],
        categories: getDrugCategories(newMedicine.name, newMedicine.code),
        labels: [],
        otherNames: [newMedicine.name],
        dateAdded: new Date().toISOString(),
      },
    ];
    setMedicines(updatedMedicines);
  }
}
    setNewMedicine({
    name: "",
    batch: "",
    quantity: "",
    reorderLevel: "20",
    shelf: "",
    barcode: "",
    expiry: "",
    expiryDates: [""],
    code: "",
    otherNames: [],
});

    setOpen(false);
    setEditIndex(null);
    setCodeNotRecognized(false);
    setIsDualCodeEntry(false);
    setSecondMedicine(emptySecondMedicine());
    setCodeSuggestion(null);
    setNameSuggestion(null);
  };

  // دالة تصحيح وقراءة التواريخ بدقة تامة (تحترم اليوم المحدد ولا تغيره إذا وُجد)
  const normalizeDate = (value) => {
    if (!value) return "";

    // إذا كان رقماً تسلسلياً من إكسل
    if (typeof value === "number") {
      const excelDate = XLSX.SSF.parse_date_code(value);
      if (excelDate) {
        return `${excelDate.y}-${String(excelDate.m).padStart(2, "0")}-${String(excelDate.d).padStart(2, "0")}`;
      }
    }

    let text = String(value).trim();
    text = text.replace(/\\/g, "/");
    text = text.replace(/-/g, "/");

    // 1. فحص التواريخ الكاملة ذات الـ 3 أجزاء (تحافظ على اليوم والسنة بدقة)
    const parts = text.split("/");
    if (parts.length === 3) {
      let p1 = parts[0].trim();
      let p2 = parts[1].trim();
      let p3 = parts[2].trim();

      // إذا كانت السنة في البداية (مثل 2026/08/31)
      if (p1.length === 4) {
        return `${p1}-${p2.padStart(2, "0")}-${p3.padStart(2, "0")}`;
      }
      // إذا كانت السنة في النهاية (مثل 31/05/2027 أو 5/5/2027)
      else if (p3.length === 4) {
        return `${p3}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
      }
    }

    // 2. معالجة أسماء الأشهر
    const months = {
      يناير:1, فبراير:2, مارس:3, أبريل:4, ابريل:4,
      مايو:5, يونيو:6, يوليو:7, أغسطس:8, اغسطس:8,
      سبتمبر:9, أكتوبر:10, اكتوبر:10,
      نوفمبر:11, ديسمبر:12,
      Jan:1, Feb:2, Mar:3, Apr:4,
      May:5, Jun:6, Jul:7, Aug:8,
      Sep:9, Oct:10, Nov:11, Dec:12
    };

    for (const m in months) {
      if (text.includes(m)) {
        const yearMatch = text.match(/\d{4}/);
        if (!yearMatch) return value;
        const year = yearMatch[0];
        const month = months[m];
        const lastDay = new Date(year, month, 0).getDate();
        return `${year}-${String(month).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
      }
    }

    // 3. إذا كان التاريخ مكوناً من جزأين فقط (شهر وسنة)
    if (parts.length === 2) {
      let p1 = Number(parts[0]);
      let p2 = Number(parts[1]);

      let month = p1;
      let year = p2;

      if (p1 > 12) {
        month = p2;
        year = p1;
      }

      if (year < 100) year += 2000;

      const lastDay = new Date(year, month, 0).getDate();
      return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    }

    return value;
  };
  
  const handleExcelUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  importExcel(file, (rows) => {
    let duplicates = [];
    let currentMedicines = [...medicines];

    rows.forEach((item) => {
      // ⭐ دعم شامل لجميع تسميات الأكواد (القديمة والجديدة) لضمان عمل نافذة التكرار للجميع
      const rawCode = item["NUPCO Code"] || item["Nupco Code"] || item["NUPCO"] || item["Nupco"] || 
                      item["Generic Item Number"] || item["Trade Item Number"] || item["Item No"] || 
                      item["Moh Code"] || item["MohCode"] || "";
      const itemCode = String(rawCode).trim();
      
      const rawName = item["Name"] || item["Drug Name"] || item["Medicine Name"] || item["Trade Description"] || "";
      let itemName = String(rawName).trim();

      // سطر بدون اسم = سطر تاريخ إضافي فقط (تكملة لدواء الصف اللي فوقه)،
      // مو دواء مستقل بحد ذاته — نتجاهله هنا تمامًا. لو عبّيناه هنا باسم
      // الوزارة (باستخدام نفس كود الصف اللي فوقه) كان يطلع وكأنه دواء ثاني
      // مكرر منفصل، وياخذ كمية "١" افتراضية رغم إنه ما جاب معه أي كمية أصلاً
      if (!itemName) return;

      const existingDrug = currentMedicines.find(
        (m) => !m.isSection && itemCode && itemCode !== "" && itemCode.toLowerCase() !== "no code available" && m.code && String(m.code).trim() === itemCode
      );

      if (existingDrug) {
        const rawDupQty = item["Quantity"] || item["Pick Qty"] || item["Qty"] || "";
        const dupQty = rawDupQty !== undefined && rawDupQty !== null && String(rawDupQty).trim() !== "" ? String(rawDupQty).trim() : "";

        duplicates.push({ 
          name: itemName || existingDrug.name, 
          code: itemCode, 
          existingQty: existingDrug.quantity, 
          newQty: dupQty
        });
      }
    });

    setPendingExcelRows(rows);
    setDuplicateSummary(duplicates);

    if (duplicates.length > 0) {
      setDuplicateModalOpen(true);
    } else {
      const result = processExcelImport(rows);
      setMedicines(result);
    }
  });
};

const processExcelImport = (rows, baseMedicines) => {
  let currentMedicines = baseMedicines ? [...baseMedicines] : [...medicines];
  let lastValidDrug = null; // مرجع لحفظ الدواء الحالي لربط التواريخ الإضافية به

  rows.forEach((item) => {
    // 1. التقاط الأعمدة بمرونة تامة (التسميات القديمة والجديدة الخاصة بشحنات المستودع)
    const expiryField = item["Best Before Date"] || item["Expiry Date"] || "";
    const expiryDates = extractAllDates(expiryField);

    const rawCode = item["Generic Item Number"] || item["Trade Item Number"] || item["Item No"] || item["NUPCO Code"] || item["Nupco Code"] || item["NUPCO"] || item["Nupco"] || item["Moh Code"] || item["MohCode"] || "";
    let itemCode = String(rawCode).trim();
    if (itemCode.toLowerCase() === "-") {
      itemCode = "";
    }

    const rawName = item["Trade Description"] || item["Name"] || item["Drug Name"] || item["Medicine Name"] || "";
    let incomingName = String(rawName).trim();

    const rawQty = item["Pick Qty"] || item["Quantity"] || item["Qty"] || "";
    const itemQty = rawQty !== undefined && rawQty !== null && String(rawQty).trim() !== "" ? String(rawQty).trim() : "";

    // ⭐ الذكاء التلقائي: إذا كان الاسم فارغاً لكن معه كود *ومعه كمية* (يعني
    // منتج حقيقي مستقل بدون اسم بالمصدر)، نجلب الاسم الرسمي من الوزارة.
    // لو ما فيه كمية أصلاً، فهذا سطر "تاريخ إضافي" تابع لآخر دواء فوقه، مو
    // منتج جديد — لو عبّيناه هنا باسم كان يفوّت خطوة الدمج بالأسفل ويتحول
    // بالغلط لدواء ثاني مستقل بكمية افتراضية خاطئة
    if (!incomingName && itemCode && itemQty && ministryDatabase && ministryDatabase[itemCode]) {
      incomingName = ministryDatabase[itemCode];
    }

    // عمود الليبلز (يظهر بس لو كان الملف مصدَّر من التطبيق نفسه)
    const rawLabels = item["Labels"] || "";
    const incomingLabels = rawLabels ? parseExportedLabels(rawLabels) : [];

    // 2. معالجة الأقسام (Sections)
    const isSecHeader = incomingName !== "" && !itemQty && expiryDates.length === 0 && !itemCode;
    if (isSecHeader) {
      const existsSec = currentMedicines.find(m => m.isSection && m.name === incomingName);
      if (!existsSec) {
        const newSec = {
          id: crypto.randomUUID(),
          name: incomingName,
          isSection: true,
          quantity: "",
          expiryDates: [],
          otherNames: [incomingName]
        };
        currentMedicines.push(newSec);
        lastValidDrug = null; // إعادة تعيين المرجع عند الانتقال لقسم جديد
      }
      return;
    }

    // 3. إذا كان السطر فارغاً من الاسم ولكنه يحتوي على تاريخ، نلصقه فوراً بآخر دواء صحيح فوقه
    if (!incomingName || incomingName.toLowerCase() === "unknown item") {
      if (expiryDates.length > 0 && lastValidDrug) {
        lastValidDrug.expiryDates = Array.from(new Set([...(lastValidDrug.expiryDates || []), ...expiryDates]));
        lastValidDrug.expiry = lastValidDrug.expiryDates[0];
      }
      return;
    }

    if (!itemQty && expiryDates.length === 0 && !itemCode) return;

    // توحيد الاسم الرسمي من الوزارة: لو الكود معروف بقاعدة بيانات الوزارة،
    // الاسم الرسمي هو اللي يطلع بالأعلى (وتحته بالـ "i" كل الأسماء التجارية
    // اللي جتنا من الشحنات كبدائل)، وإلا نستخدم الاسم المستورد كما هو
    let officialName = incomingName;
    if (itemCode && ministryDatabase && ministryDatabase[itemCode]) {
      officialName = ministryDatabase[itemCode];
    }

    if (!officialName) return;

    // البحث والتطابق: عبر كود نيبكو لو متوفر عند الاثنين، أو بالاسم لو الاثنين بدون كود
    // (بدون هذا الاحتياط، أي دواء بدون كود نيبكو كان يتكرر كصنف جديد بكل استيراد بدل الدمج)
    const hasItemCode = itemCode && itemCode !== "" && !itemCode.toLowerCase().includes("no code");
    const foundIdx = currentMedicines.findIndex((m) => {
      if (m.isSection) return false;
      const mCode = String(m.code || "").trim();
      const mHasCode = mCode && !mCode.toLowerCase().includes("no code");

      if (hasItemCode && mHasCode) {
        return mCode === itemCode;
      }
      if (!hasItemCode && !mHasCode) {
        return String(m.name || "").trim().toLowerCase() === officialName.trim().toLowerCase();
      }
      return false;
    });

    if (foundIdx !== -1) {
      const med = currentMedicines[foundIdx];
      
      if (itemQty) {
        if (!Array.isArray(med.quantities)) {
          med.quantities = [med.quantity || "1"];
        }
        // نفكك صيغة "180 + 20" المُصدَّرة إلى شحنات منفصلة زي ما كانت أصلًا،
        // ونضيفها دايمًا (بدون تجاهل القيم المتطابقة) عشان شحنة ثانية بنفس
        // الكمية تظهر كسطر منفصل، بدل ما تختفي بصمت وكأنها ما انضافت
        const incomingQuantities = splitExportedQuantities(itemQty);
        incomingQuantities.forEach((q) => {
          med.quantities.push(q);
        });
        med.quantity = incomingQuantities[incomingQuantities.length - 1] || itemQty;
      }

      if (incomingLabels.length > 0) {
        const existingLabelNames = (med.labels || []).map((l) => l.name);
        const newLabels = incomingLabels.filter((l) => !existingLabelNames.includes(l.name));
        if (newLabels.length > 0) {
          med.labels = [...(med.labels || []), ...newLabels];
        }
      }

      if (expiryDates.length > 0) {
        med.expiryDates = Array.from(new Set([...(med.expiryDates || [med.expiry]), ...expiryDates]));
        med.expiry = med.expiryDates[0];
      }

      if (incomingName && !med.otherNames.includes(incomingName)) {
        med.otherNames.push(incomingName);
      }

      lastValidDrug = med; // تحديث المرجع
    } else {
      const initialQuantities = itemQty ? splitExportedQuantities(itemQty) : ["1"];
      const newMed = {
        id: crypto.randomUUID(),
        name: officialName,
        isSection: false,
        code: itemCode || "", 
        quantity: initialQuantities[initialQuantities.length - 1] || itemQty,
        quantities: initialQuantities.length ? initialQuantities : [itemQty || "1"],
        expiry: expiryDates[0] || "",
        expiryDates: expiryDates.length > 0 ? expiryDates : (expiryDates[0] ? [expiryDates[0]] : []),
        shelf: "",
        categories: getDrugCategories(officialName, itemCode),
        labels: incomingLabels,
        mawsoolOrder: false,
        otherNames: incomingName !== officialName ? [officialName, incomingName] : [incomingName],
        dateAdded: new Date().toISOString(),
      };
      
      currentMedicines.push(newMed);
      lastValidDrug = newMed; // حفظ المرجع لكي تستفيد منه الأسطر التي تحته مباشرة
    }
  });

  return currentMedicines;
};

// يستقبل الآن "id" الدواء نفسه، مو رقم موقعه بالجدول. السبب: لمن يكون فيه
// بحث/فلتر أو ترقيم صفحات فعّال، رقم الصف اللي يشوفه المستخدم (actualIndex)
// يختلف عن رقم موقع نفس الدواء داخل مصفوفة medicines الكاملة غير المفلترة —
// وكان يمرر مباشرة كـ "index" لهذي الدالة، فتحذف عنصر ثاني عشوائي من نفس
// الموقع بالمصفوفة الكاملة بدل الدواء المحدد فعليًا. البحث بالـ id يضمن
// حذف نفس الدواء اللي ضغط عليه المستخدم دائمًا، بغض النظر عن الفلترة/الترقيم
const handleDelete = async (id) => {
 const index = medicines.findIndex((m) => m.id === id);
 if (index === -1) return;
 const medicineToDelete = medicines[index];

 setDeletingIds((prev) => new Set(prev).add(id));

 // نمنع الـ useEffect العام (اللي يراقب medicines) من تشغيل مزامنة كاملة
 // مؤجّلة (persistMedicines) فوق هالتغيير — إحنا أصلاً بنكتب على فايرستور
 // مباشرة تحت، ومزامنته العامة كانت تدخل بسباق (race) مع الكتابة المباشرة
 // على نت بطيء وتسبب رجوع بيانات قديمة بعد التراجع
 skipNextPersistRef.current = true;
 const updatedMedicines = medicines.filter((_, i) => i !== index);
 setMedicines(updatedMedicines);

 // ننقله فورًا لسلة المهملات (بدل الانتظار ٥ ثواني) عشان ما تصير مشكلة
 // لو المستخدم سكّر الصفحة بسرعة — الزر "تراجع" يرجعه فورًا من السلة.
 // وبنفس الوقت نحذف مستنده من مجموعة medicines مباشرة (بدل ما ننتظر
 // المزامنة العامة المؤجّلة) — هذا يضمن اختفاءه من فايرستور فعليًا خلال
 // أجزاء من الثانية، ويمنع رجوعه لو المستخدم رجع/حدّث الصفحة بسرعة قبل
 // ما تخلص المزامنة العامة (اللي تصير بعد نص ثانية وممكن تشمل مئات الأدوية)
 try {
   await Promise.all([
     setDoc(doc(db, TRASH_COLLECTION, String(medicineToDelete.id)), {
       ...medicineToDelete,
       deletedAt: Date.now(),
     }),
     deleteMedicineDocImmediately(medicineToDelete.id),
   ]);
   setTrashItems((prev) => [...prev, { ...medicineToDelete, deletedAt: Date.now() }]);
   // نحدّث المرجعين محليًا فورًا عشان المزامنة العامة اللي بتصير بعد شوي
   // ما تحاول تحذفه مرة ثانية أو تعتبره "لسا موجود" بالخطأ
   knownMedicineIdsRef.current = new Set(
     [...knownMedicineIdsRef.current].filter((mid) => mid !== String(medicineToDelete.id))
   );
   lastSyncedContentRef.current.delete(String(medicineToDelete.id));
 } catch (err) {
   console.error("فشل نقل الدواء لسلة المهملات:", err);
 } finally {
   setDeletingIds((prev) => {
     const next = new Set(prev);
     next.delete(id);
     return next;
   });
 }

 setPendingDelete({ medicine: medicineToDelete, index });
 setUndoSnackOpen(true);
 setTimeout(() => {
   setPendingDelete((curr) =>
     curr && curr.medicine.id === medicineToDelete.id ? null : curr
   );
 }, 5000);
};

const handleUndoDelete = async () => {
  if (!pendingDelete) return;
  const { medicine, index } = pendingDelete;

  // نفس المنطق اللي بالحذف: نوقف المزامنة العامة المؤجّلة عن هالتغيير
  // عشان ما تتصادم (race) مع الكتابة المباشرة تحت وترجع تحذف المستند
  // اللي احنا لسا نكتبه
  skipNextPersistRef.current = true;
  const restored = [...medicines];
  restored.splice(index, 0, medicine);
  setMedicines(restored);

  try {
    // نعيد كتابة مستنده مباشرة بمجموعة medicines فورًا (بدل الانتظار على
    // المزامنة العامة المؤجّلة) عشان التراجع يصير فوري وموثوق دائمًا
    await Promise.all([
      setDoc(doc(db, MEDICINES_COLLECTION, String(medicine.id)), medicine),
      deleteDoc(doc(db, TRASH_COLLECTION, String(medicine.id))),
    ]);
    setTrashItems((prev) => prev.filter((item) => item.id !== medicine.id));
    knownMedicineIdsRef.current = new Set([...knownMedicineIdsRef.current, String(medicine.id)]);
    lastSyncedContentRef.current.set(String(medicine.id), JSON.stringify(medicine));
  } catch (err) {
    console.error("فشل التراجع عن الحذف:", err);
    // الكتابة الفعلية بفايرستور فشلت — لازم نرجّع الواجهة لحالتها الحقيقية
    // (الدواء لسا بالسلة) بدل ما نخلي المستخدم يفتكر إن التراجع نجح وهو
    // ما نجح فعليًا، وننبّهه يحاول مرة ثانية
    skipNextPersistRef.current = true;
    setMedicines((curr) => curr.filter((m) => m.id !== medicine.id));
    setUndoFailedOpen(true);
    setPendingDelete(null);
    setUndoSnackOpen(false);
    return;
  }

  setPendingDelete(null);
  setUndoSnackOpen(false);
};

const handleRestoreFromTrash = async (item) => {
  try {
    await restoreMedicineFromTrash(item);
    setTrashItems((prev) => prev.filter((t) => t.id !== item.id));
    setMedicines((prev) => [...prev, item]);
    knownMedicineIdsRef.current = new Set([...knownMedicineIdsRef.current, String(item.id)]);
    lastSyncedContentRef.current.set(String(item.id), JSON.stringify(item));
  } catch (err) {
    console.error("فشل استرجاع الدواء من سلة المهملات:", err);
  }
};

const handlePermanentDelete = async (id) => {
  try {
    await permanentlyDeleteFromTrash(id);
    setTrashItems((prev) => prev.filter((t) => t.id !== id));
  } catch (err) {
    console.error("فشل الحذف النهائي من سلة المهملات:", err);
  }
};

const handleEmptyTrash = async () => {
  if (!window.confirm("Permanently delete all items in the trash? This can't be undone.")) return;
  try {
    await emptyTrashInFirestore(trashItems);
    setTrashItems([]);
  } catch (err) {
    console.error("فشل تفريغ سلة المهملات:", err);
  }
};

const handleDeleteAll = async () => {
  if (!window.confirm("Are you sure you want to delete all medicines?")) return;

  const toTrash = medicines.filter((m) => !m.isSection);
  // الأقسام (isSection) مو أدوية فعلية فما تروح للسلة، بس لازم تنحذف
  // صراحة من فايرستور هنا — قبل كذا كانت تختفي بس من الواجهة وتضل
  // موجودة فعليًا بالسيرفر، وترجع تطلع بعد أي تحديث للصفحة
  const sectionsToRemove = medicines.filter((m) => m.isSection);
  const deletedAt = Date.now();

  skipNextPersistRef.current = true;
  setMedicines([]);
  setClearingInventory(true);

  try {
    // نبني كل عملية (كتابة تراش / حذف) كدالة صغيرة، ونطبقها على "دفعات"
    // (batch) بدل ما نرسل مئات الطلبات المنفصلة بنفس الوقت — دفعة واحدة
    // تنرسل بطلب شبكة وحد، وهذا أسرع وأوثق بكثير على نت ضعيف من مئات
    // الطلبات المتوازية اللي كانت تسبب التعليق/التأخير اللي لاحظتيه.
    // فايرستور يسمح بحد أقصى 500 عملية بالدفعة الوحدة فنحط هامش أمان 450
    const ops = [];
    toTrash.forEach((medicine) => {
      ops.push((batch) =>
        batch.set(doc(db, TRASH_COLLECTION, String(medicine.id)), {
          ...medicine,
          deletedAt,
        })
      );
      ops.push((batch) => batch.delete(doc(db, MEDICINES_COLLECTION, String(medicine.id))));
    });
    sectionsToRemove.forEach((section) => {
      ops.push((batch) => batch.delete(doc(db, MEDICINES_COLLECTION, String(section.id))));
    });

    const CHUNK_SIZE = 450;
    for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      ops.slice(i, i + CHUNK_SIZE).forEach((apply) => apply(batch));
      await batch.commit();
    }

    setTrashItems((prev) => [...prev, ...toTrash.map((m) => ({ ...m, deletedAt }))]);
    knownMedicineIdsRef.current = new Set();
    lastSyncedContentRef.current = new Map();
  } catch (err) {
    console.error("فشل نقل كل الأدوية لسلة المهملات:", err);
    setSyncErrorOpen(true);
  } finally {
    setClearingInventory(false);
  }
};

const handleExportExcel = async () => {
  const cfg = exportColumns;

  const columnDefs = [];
  if (cfg.name) columnDefs.push({ header: "Name", key: "name", width: 35 });
  if (cfg.code) columnDefs.push({ header: "Nupco Code", key: "code", width: 20 });
  if (cfg.quantity) columnDefs.push({ header: "Quantity", key: "quantity", width: 24 });
  if (cfg.expiry) columnDefs.push({ header: "Expiry Date", key: "expiry", width: 18 });
  if (cfg.status) columnDefs.push({ header: "Status", key: "status", width: 16 });
  if (cfg.mawsool) columnDefs.push({ header: "Mawsool", key: "mawsool", width: 14 });
  if (cfg.labels) columnDefs.push({ header: "Labels", key: "labels", width: 25 });

  if (columnDefs.length === 0) {
    alert("Please select at least one column to export");
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Inventory");
  worksheet.columns = columnDefs;

  worksheet.getRow(1).font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "1976D2" },
  };

  // فهرس عمود الحالة (Status) داخل الأعمدة المختارة فقط، عشان نلوّنه بعدين
  const statusColIndex = columnDefs.findIndex((c) => c.key === "status") + 1;

  medicines.forEach((medicine, index) => {
    if (medicine.isSection) {
      const rowData = {};
      if (cfg.name) rowData.name = medicine.name;
      const sectionRow = worksheet.addRow(rowData);
      sectionRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9EAF7" } };
        cell.font = { bold: true };
      });
      return;
    }

    const expiryList =
      medicine.expiryDates && medicine.expiryDates.length
        ? medicine.expiryDates
        : [medicine.expiry || ""];

    // نعرض كل كميات الشحنات مع بعض (مو بس أول شحنة)، عشان ما تضيع بيانات
    const allQuantitiesText =
      Array.isArray(medicine.quantities) && medicine.quantities.length
        ? medicine.quantities.join(" + ")
        : medicine.quantity || "";

    const mawsoolText = medicine.mawsoolOrder ? "Yes" : "No";
    const labelsText = (medicine.labels || [])
      .map((l) => `${l.icon || "🏷️"} ${l.name}${l.color ? ` (${l.color})` : ""}`)
      .join("; ");

    if (!medicine.quantity && !medicine.expiry && medicine.name) {
      const rowData = {};
      if (cfg.name) rowData.name = medicine.name;
      const sectionRow = worksheet.addRow(rowData);
      sectionRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9EAF7" } };
        cell.font = { bold: true };
      });
      return;
    }

    const rowColor = index % 2 === 0 ? "E5E7EB" : "FFFFFF";

    expiryList.forEach((expiryDate, expiryIndex) => {
      const status = getStatus(expiryDate);

      const rowData = {};
      if (cfg.name) rowData.name = expiryIndex === 0 ? medicine.name : "";
      if (cfg.code) rowData.code = expiryIndex === 0 ? medicine.code : "";
      if (cfg.quantity) rowData.quantity = expiryIndex === 0 ? allQuantitiesText : "";
      if (cfg.expiry) rowData.expiry = expiryDate;
      if (cfg.status) rowData.status = status;
      if (cfg.mawsool) rowData.mawsool = expiryIndex === 0 ? mawsoolText : "";
      if (cfg.labels) rowData.labels = expiryIndex === 0 ? labelsText : "";

      const row = worksheet.addRow(rowData);

      row.eachCell((cell) => {
        cell.alignment = { vertical: "center", wrapText: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowColor } };
      });

      if (medicine.expiryDates && medicine.expiryDates.length > 1) {
        row.height = medicine.expiryDates.length * 22;
      }

      // نلوّن خلية الحالة فقط لو فيه تاريخ فعلي (بدون تاريخ = بدون لون ولا نص)
      if (cfg.status && statusColIndex > 0 && status) {
        const statusCell = row.getCell(statusColIndex);
        statusCell.alignment = { vertical: "top", horizontal: "left", wrapText: true };

        if (status === "Safe") {
          statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2E7D32" } };
          statusCell.font = { color: { argb: "FFFFFFFF" }, bold: true };
        } else if (status === "Near Expiry") {
          statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "ED6C02" } };
          statusCell.font = { color: { argb: "FFFFFFFF" }, bold: true };
        } else if (status === "Expired") {
          statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D32F2F" } };
          statusCell.font = { color: { argb: "FFFFFFFF" }, bold: true };
        }
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();

  saveAs(
    new Blob([buffer]),
    `Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`
  );

  // كل تصدير يُحتسب أيضًا كنسخة احتياطية — نسجّل توقيته في فايرستور
  const backupTimestamp = new Date().toISOString();
  try {
    await setDoc(doc(db, "settings", "backup"), {
      lastBackupDate: backupTimestamp,
    });
    setLastBackupDate(backupTimestamp);
  } catch (err) {
    console.error("فشل حفظ تاريخ آخر نسخة احتياطية:", err);
  }

  setExportDialogOpen(false);
};

// يهيّئ تاريخ آخر نسخة احتياطية بصيغة مقروءة، أو "Never" لو ما فيه ولا نسخة بعد
function formatBackupDate(isoString) {
  if (!isoString) return "Never";

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Never";

  const datePart = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const timePart = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${datePart} · ${timePart}`;
}

useEffect(() => {
  if (medicinesLoading) return; // ما نكتب فوق البيانات وقت التحميل الأولي لسا
  sectionsCache = sections;
  persistSectionsToFirestore(sections).catch((err) =>
    console.error("فشل حفظ الأقسام بـ Firestore:", err)
  );
}, [sections]);

useEffect(() => {
  if (medicinesLoading) return; // ما نكتب فوق البيانات وقت التحميل الأولي لسا
  if (skipNextPersistRef.current) {
    // آخر تحديث كان تحميل بيانات (كاش أو فايرستور)، مو تعديل من المستخدم —
    // نتجاهله مرة وحدة عشان ما نكتب بيانات قديمة/مكررة فوق أي تعديل صار
    // بصفحة ثانية (مثل صفحة موصول) مباشرة على فايرستور
    skipNextPersistRef.current = false;
    return;
  }
  persistMedicines(medicines);
}, [medicines]);

const handleDeleteLabel = (medicineId, labelIndex) => {
  const updated = medicines.map((med) => {
    if (med.id === medicineId) {
      return {
        ...med,
        labels: (med.labels || []).filter(
          (_, i) => i !== labelIndex
        )
      };
    }
    return med;
  });

  setMedicines(updated);
};

const getStatus = (expiry) => {
  if (!expiry) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiryDate = new Date(expiry);
  expiryDate.setHours(23, 59, 59, 999);

  // نحسب "قبل ٣ شهور بالضبط من تاريخ الانتهاء" (مو ٩٠ يوم ثابتة، لأن
  // الأشهر تختلف بعدد أيامها) وأي تاريخ يوصله اليوم أو يتجاوزه يعتبر Near Expiry
  const nearExpiryThreshold = new Date(expiryDate);
  nearExpiryThreshold.setMonth(nearExpiryThreshold.getMonth() - 3);
  nearExpiryThreshold.setHours(0, 0, 0, 0);

  if (today > expiryDate) return "Expired";
  if (today >= nearExpiryThreshold) return "Near Expiry";
  return "Safe";
};

// نص العد التنازلي/التصاعدي اللي يظهر بالـ Tooltip فوق شارة الحالة
const getCountdownText = (expiry) => {
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

  // نعرضها بالأشهر والأيام إذا كانت المدة أطول من شهر، وإلا بالأيام فقط
  if (diffDays >= 30) {
    const months = Math.floor(diffDays / 30);
    const remainingDays = diffDays % 30;
    const monthsText = `${months} ${months === 1 ? "month" : "months"}`;
    return remainingDays > 0
      ? `${monthsText} and ${remainingDays} ${remainingDays === 1 ? "day" : "days"} left`
      : `${monthsText} left`;
  }

  return `${diffDays} ${diffDays === 1 ? "day" : "days"} left`;
};

// رقم سطر ثابت لكل دواء (يتجاهل الأقسام) حسب ترتيبه الفعلي بقائمة المخزون
// الكاملة — نفس الرقم اللي يظهر بعمود "NO." بالجدول. نحسبه هنا بمرحلة
// وحدة عشان نفس الرقم يُستخدم بالبحث وبالعرض معًا، فلما تكتب رقم بصندوق
// البحث يطابق فعلاً نفس الرقم اللي شايفه قدام الدواء بالجدول
const medicineLineNumbers = useMemo(() => {
  const map = new Map();
  let counter = 0;
  medicines.forEach((m) => {
    if (m.isSection) return;
    counter++;
    map.set(m.id, counter);
  });
  return map;
}, [medicines]);

// تصفية الأدوية والأقسام للبحث (بالاسم الرسمي، الأسماء البديلة داخل قائمة المعلومات، الكود، أو رقم السطر NO.)
// ملفوفة بـ useMemo عشان ما تتكرر الحسابات الثقيلة (خصوصًا جلب التصنيفات)
// إلا لما تتغير القائمة أو مصطلح البحث أو الفلاتر فعليًا، مو مع كل ضغطة زر
// بالواجهة (زي فتح نافذة التصدير) اللي كانت تسبب تأخير ملحوظ بمخزون كبير
const filteredMedicines = useMemo(() => {
  const searchTerm = search ? search.trim().toLowerCase() : "";
  const isFiltering = Boolean(searchTerm) || selectedCategory !== "All" || selectedStatus !== "All";

  // نتحقق أولاً من كل دواء (مو سكشن) لوحده هل يطابق البحث/الفلاتر، ونحفظ
  // نتيجته بمجموعة IDs — نحتاجها بعدين عشان نقرر أي سكاشن نعرضها
  const matchingIds = new Set();
  medicines.forEach((medicine) => {
    if (medicine.isSection) return;

    const drugLineNumber = String(medicineLineNumbers.get(medicine.id) ?? "");

    // التحقق هل مصطلح البحث مطابـق لاسم الدواء الأساسي، أو الكود، أو رقم السطر
    const matchMain =
      drugLineNumber === searchTerm ||
      (medicine.name && medicine.name.toLowerCase().includes(searchTerm)) ||
      (medicine.code && String(medicine.code).toLowerCase().includes(searchTerm));

    // ⭐ التحقق أيضاً هل مصطلح البحث موجود داخل أي اسم من الأسماء البديلة (otherNames)
    const matchAlternatives =
      medicine.otherNames &&
      Array.isArray(medicine.otherNames) &&
      medicine.otherNames.some(altName => altName && altName.toLowerCase().includes(searchTerm));

    const matchSearch = !searchTerm || matchMain || matchAlternatives;

    // جلب التصنيفات بأمان تام
    let medCategories = [];
    try {
      medCategories = Array.isArray(medicine.categories)
        ? medicine.categories
        : (typeof getDrugCategories === 'function' ? getDrugCategories(medicine.name, medicine.code) : []);
    } catch (err) {
      medCategories = [];
    }

    const matchCategory =
      selectedCategory === "All" ||
      medCategories.includes(selectedCategory);

    const status = getStatus(
      medicine.expiryDates?.[0] || medicine.expiry
    );

    // Low Stock فلتر منفصل عن حالة الانتهاء: يقارن الكمية الحالية بحد إعادة
    // الطلب (reorderLevel)، نفس المنطق المستخدم بالداش بورد بالضبط
    const quantityValue = parseQuantityNumber(medicine.quantity);
    const reorderLevelValue = Number(medicine.reorderLevel ?? 20);
    const isLowStock =
      quantityValue >= 0 && quantityValue <= reorderLevelValue;

    const matchStatus =
      selectedStatus === "All" ||
      (selectedStatus === "Low Stock"
        ? isLowStock
        : status === selectedStatus);

    if (matchSearch && matchCategory && matchStatus) {
      matchingIds.add(medicine.id);
    }
  });

  // ثاني تمريرة: نبني القائمة النهائية بنفس ترتيب medicines الأصلي، ونقرر
  // لكل سكشن هل نعرضه ولا لا. لو ماكو أي فلتر فعّال (بحث/تصنيف/حالة) نعرض
  // كل السكاشن زي ما كانت (حتى الفاضية، عشان تصير جاهزة لإضافة أدوية فيها).
  // لو فيه فلتر فعّال، نعرض السكشن بس إذا فيه دواء واحد على الأقل تحته
  // يطابق الفلتر الحالي — عشان ما يطلع لنا كل السكاشن الفاضية أثناء البحث
  const result = [];
  for (let i = 0; i < medicines.length; i++) {
    const medicine = medicines[i];

    if (!medicine.isSection) {
      if (matchingIds.has(medicine.id)) result.push(medicine);
      continue;
    }

    if (!isFiltering) {
      result.push(medicine);
      continue;
    }

    let hasMatchUnderneath = false;
    for (let j = i + 1; j < medicines.length; j++) {
      if (medicines[j].isSection) break;
      if (matchingIds.has(medicines[j].id)) {
        hasMatchUnderneath = true;
        break;
      }
    }

    if (hasMatchUnderneath) result.push(medicine);
  }

  return result;
}, [medicines, medicineLineNumbers, search, selectedCategory, selectedStatus]);

// شبكة أمان: لو تغيّر عدد الأدوية (حذف/دمج/فلترة) وصار رقم الصفحة الحالي
// أكبر من آخر صفحة متوفرة فعليًا، نرجعه لآخر صفحة صحيحة بدل ما يفضل
// عالق على صفحة فاضية
useEffect(() => {
  const medicinesOnlyCount = filteredMedicines.filter((m) => !m.isSection).length;
  const totalPages = Math.max(1, Math.ceil(medicinesOnlyCount / rowsPerPage));
  if (page > totalPages - 1) {
    setPage(totalPages - 1);
  }
}, [filteredMedicines, rowsPerPage, page]);

// لما يتحدد دواء للتوهيج (highlightedMedicineId) وتكون قائمة الأدوية جاهزة،
// نروح لصفحة الترقيم الصحيحة اللي موجود فيها هذا الدواء، ثم نسكرول له
// ونومض عليه بضع ثواني قبل ما نلغي التوهيج تلقائيًا
useEffect(() => {
  if (!highlightedMedicineId || medicinesLoading) return;

  const indexInFiltered = filteredMedicines.findIndex(
    (m) => m.id === highlightedMedicineId
  );

  if (indexInFiltered === -1) return;

  // رقم الصفحة لازم يتحسب باعتماد على عدد الأدوية الحقيقية قبل هذا الدواء
  // بس (نفس منطق getMedicinePageSlice) — لو اعتمدنا رقم موقعه الخام
  // بالمصفوفة (اللي فيها صفوف عناوين الأقسام مندمجة)، كنا نطلع لصفحة غلط
  // كل ما فيه قسم أو أكثر قبل الدواء المقصود
  const realCountBefore = filteredMedicines
    .slice(0, indexInFiltered)
    .filter((m) => !m.isSection).length;
  const targetPage = Math.floor(realCountBefore / rowsPerPage);
  setPage(targetPage);

  const scrollTimer = setTimeout(() => {
    const el = rowRefs.current[highlightedMedicineId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 150);

  const clearTimer = setTimeout(() => {
    setHighlightedMedicineId(null);
  }, 2600);

  return () => {
    clearTimeout(scrollTimer);
    clearTimeout(clearTimer);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [highlightedMedicineId, medicinesLoading, filteredMedicines.length]);

return (
<Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>

{/* =====================================================
    INVENTORY HEADER — EXACT BUTTON WIDTH MATCHING
===================================================== */}
<Box
  sx={{
    mt: 2,
    mb: 3,
    pb: 2.5,
    borderBottom: "1px solid #e5e7eb",
    width: "100%",
    px: 0,
  }}
>
  {/* LOGO */}
  <Box
    sx={{
      display: "flex",
      justifyContent: "center",
      mb: 2,
    }}
  >
    <Box
      component="img"
      src="/logo.png"
      alt="Hail Health Cluster"
      sx={{
        width: 350,
        height: "auto",
        display: "block",
        objectFit: "contain",
      }}
    />
  </Box>

  {/* SEARCH */}
  <Box
    sx={{
      width: "100%",
      maxWidth: "740px",
      mx: "auto",
      mb: 3,
    }}
  >
    <TextField
      fullWidth
      placeholder="Search by name, code, or line no..."
      size="medium"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      slotProps={{
        input: {
          startAdornment: (
            <FilterAltIcon sx={{ color: "#94a3b8", mr: 1, fontSize: 20 }} />
          ),
        },
      }}
      sx={{
        "& .MuiOutlinedInput-root": {
          borderRadius: "14px",
          bgcolor: "#f8fafc",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          "& fieldset": { borderColor: "#cbd5e1" },
          "&:hover fieldset": { borderColor: "#94a3b8" },
          "&.Mui-focused fieldset": { borderColor: "#1976d2", borderWidth: "1.5px" },
        },
        "& input": { fontSize: "1rem", py: 1.5 },
      }}
    />
  </Box>

  {/* TITLE + ACTIONS */}
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      gap: 2,
      flexWrap: "wrap",
    }}
  >
    {/* LEFT — TITLE */}
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        flexShrink: 0,
        pl: 0.5,
      }}
    >
      <IconButton
        onClick={() => navigate("/Dashboard")}
        sx={{
          bgcolor: "#f3f4f6",
          "&:hover": { bgcolor: "#e5e7eb" },
          width: 42,
          height: 42,
        }}
      >
        <ArrowBackRoundedIcon />
      </IconButton>

      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: "16px",
          bgcolor: "#1976d2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
        }}
      >
        <Inventory2RoundedIcon sx={{ fontSize: 30 }} />
      </Box>

      <Typography
        variant="h4"
        sx={{
          fontWeight: 700,
          color: "#1f2937",
          whiteSpace: "nowrap",
        }}
      >
        Inventory
      </Typography>
    </Box>

    {/* RIGHT — ALL ACTION BUTTONS IN ONE GROUP */}
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        gap: 1.2,
        flexWrap: "wrap",
        pr: 0.5,
      }}
    >
      {/* Add Medicine */}
      <Button
        variant="contained"
        onClick={() => {
          setEditIndex(null);
          setNewMedicine({
            name: "",
            quantity: "",
            reorderLevel: "20",
            expiry: "",
            expiryDates: [""],
            shelf: "",
            barcode: "",
            code: "",
            otherNames: [],
          });
          setCodeNotRecognized(false);
          setIsDualCodeEntry(false);
          setSecondMedicine(emptySecondMedicine());
          setCodeSuggestion(null);
          setNameSuggestion(null);
          setOpen(true);
        }}
        sx={{
          borderRadius: "12px",
          textTransform: "none",
          px: 2.2,
          py: 1,
          height: 42,
          whiteSpace: "nowrap",
        }}
      >
        + Add Medicine
      </Button>

      {/* Import Excel */}
      <Button
        component="label"
        variant="outlined"
        sx={{
          borderRadius: "12px",
          textTransform: "none",
          px: 2.2,
          py: 1,
          height: 42,
          whiteSpace: "nowrap",
          minWidth: 165, // تثبيت عرض موحد ليتطابق مع زر الاكسبورت
        }}
      >
        Import Excel (Merge)
        <input
          hidden
          type="file"
          accept=".xlsx,.xls"
          onChange={handleExcelUpload}
        />
      </Button>

      {/* EXPORT + LAST BACKUP WRAPPER (نفس العرض تماماً 165px) */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          position: "relative",
          width: 165, // نفس عرض زر الإمبورت بالمللي
        }}
      >
        <Button
          variant="outlined"
          color="success"
          onClick={() => setExportDialogOpen(true)}
          sx={{
            borderRadius: "12px",
            textTransform: "none",
            py: 1,
            height: 42,
            whiteSpace: "nowrap",
            width: "100%",
          }}
        >
          Export Excel
        </Button>

        {/* Last Backup */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.5,
            position: "absolute",
            top: "46px",
            left: 0,
            right: 0,
            mt: 0.5,
          }}
        >
          <Box
            component="span"
            sx={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              bgcolor: "#20ae54",
              flexShrink: 0,
            }}
          />
          <Typography
            sx={{
              fontSize: "10px",
              color: "#94a3b8",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            Last backup: {formatBackupDate(lastBackupDate)}
          </Typography>
        </Box>
      </Box>

      {/* Clear Inventory */}
      <Button
        variant="outlined"
        color="error"
        disabled={clearingInventory}
        onClick={handleDeleteAll}
        sx={{
          borderRadius: "12px",
          textTransform: "none",
          px: 2,
          py: 1,
          height: 42,
          whiteSpace: "nowrap",
        }}
      >
        Clear Inventory
      </Button>

      {/* Trash */}
      <Badge badgeContent={trashItems.length} color="default" max={99}>
        <Button
          variant="outlined"
          disabled={clearingInventory}
          onClick={() => {
            setTrashPage(0);
            setTrashOpen(true);
          }}
          startIcon={clearingInventory
            ? <CircularProgress size={16} thickness={5} sx={{ color: "inherit" }} />
            : <DeleteSweepIcon />}
          sx={{
            borderRadius: "12px",
            textTransform: "none",
            px: 2,
            py: 1,
            height: 42,
            whiteSpace: "nowrap",
            color: "#475569",
            borderColor: "#cbd5e1",
          }}
        >
          {clearingInventory ? "Moving to Trash…" : "Trash"}
        </Button>
      </Badge>
    </Box>
  </Box>
</Box>


{/* =====================================================
    FILTERS
===================================================== */}

<Box
  sx={{
    display: "flex",
    alignItems: "center",
    width: "100%",
    gap: 2,
    mb: 3,
  }}
>
  {/* CATEGORY */}
  <FormControl
    size="small"
    sx={{
      minWidth: 205,

      "& .MuiOutlinedInput-root": {
        bgcolor:
          selectedCategory !== "All"
            ? "#eff6ff"
            : "transparent",

        "& fieldset": {
          borderColor:
            selectedCategory !== "All"
              ? "#2563eb"
              : "rgba(0, 0, 0, 0.23)",

          borderWidth:
            selectedCategory !== "All"
              ? "2px"
              : "1px",
        },
      },
    }}
  >
    <InputLabel
      sx={{
        fontWeight:
          selectedCategory !== "All" ? 700 : 400,

        color:
          selectedCategory !== "All"
            ? "#2563eb"
            : "inherit",
      }}
    >
      Category {selectedCategory !== "All" && "●"}
    </InputLabel>

    <Select
      value={selectedCategory}
      label="Category"
      onChange={(e) =>
        setSelectedCategory(e.target.value)
      }
    >
      <MenuItem value="All">
        All Categories
      </MenuItem>

      {availableLabels.map((label) => (
        <MenuItem
          key={label.name}
          value={label.name}
        >
          {label.name}
        </MenuItem>
      ))}
    </Select>
  </FormControl>


  {/* STATUS */}
  <FormControl
    size="small"
    sx={{
      minWidth: 205,

      "& .MuiOutlinedInput-root": {
        bgcolor:
          selectedStatus !== "All"
            ? "#eff6ff"
            : "transparent",

        "& fieldset": {
          borderColor:
            selectedStatus !== "All"
              ? "#2563eb"
              : "rgba(0, 0, 0, 0.23)",

          borderWidth:
            selectedStatus !== "All"
              ? "2px"
              : "1px",
        },
      },
    }}
  >
    <InputLabel
      sx={{
        fontWeight:
          selectedStatus !== "All" ? 700 : 400,

        color:
          selectedStatus !== "All"
            ? "#2563eb"
            : "inherit",
      }}
    >
      Status {selectedStatus !== "All" && "●"}
    </InputLabel>

    <Select
      value={selectedStatus}
      label="Status"
      onChange={(e) =>
        setSelectedStatus(e.target.value)
      }
    >
      <MenuItem value="All">
        All Status
      </MenuItem>

      <MenuItem value="Safe">
        Safe
      </MenuItem>

      <MenuItem value="Near Expiry">
        Near Expiry
      </MenuItem>

      <MenuItem value="Expired">
        Expired
      </MenuItem>

      <MenuItem value="Low Stock">
        Low Stock
      </MenuItem>
    </Select>
  </FormControl>


  {/* RESET */}
  {(selectedCategory !== "All" ||
    selectedStatus !== "All" ||
    search.trim() !== "") && (
    <Tooltip title="Reset Filters & Search">
      <IconButton
        onClick={() => {
          setSearch("");
          setSelectedCategory("All");
          setSelectedStatus("All");
        }}
        sx={{
          bgcolor: "#f3f4f6",
          border: "1px solid #d1d5db",
          borderRadius: "50%",
          width: 40,
          height: 40,
          color: "#374151",

          transition: "all 0.2s ease",

          "&:hover": {
            bgcolor: "#e5e7eb",
            color: "#2563eb",
            transform: "rotate(180deg)",
          },
        }}
      >
        <RestartAltRoundedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  )}


  {/* PUSH MANAGE SECTIONS TO FAR RIGHT */}
  <Box sx={{ flex: 1 }} />

  <Button
    variant="outlined"
    startIcon={<SettingsIcon />}
    onClick={() => setOpenSectionsDialog(true)}
    sx={{
      borderRadius: "10px",
      textTransform: "none",
      whiteSpace: "nowrap",
    }}
  >
    Manage Sections
  </Button>
</Box>


      <TableContainer component={Paper}>
        <Table>

          <TableHead>
    <TableRow>
      <TableCell sx={{ width: "60px" }}><b>NO.</b></TableCell>
      <TableCell><b>Name</b></TableCell>
      <TableCell><b>Nupco Code</b></TableCell>
      <TableCell><b>Quantity</b></TableCell>
      <TableCell><b>Expiry Date</b></TableCell>
<TableCell align="center"><b>Mawsool</b></TableCell>
      <TableCell align="center"><b>Action</b></TableCell>
    </TableRow>
  </TableHead>

          <TableBody>

{medicinesLoading ? (
  <TableRow>
    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
      Loading inventory from Firestore...
    </TableCell>
  </TableRow>
) : (
(() => {

  return getMedicinePageSlice(filteredMedicines, page, rowsPerPage)
    .map((medicine, index) => {
      const actualIndex = page * rowsPerPage + index;

      if (medicine.isSection) {
        return (
          <TableRow
    key={medicine.id ?? `section-${actualIndex}`}
    sx={{
      backgroundColor: "#f0f9ff",
      borderLeft: "4px solid #0284c7"
    }}
  >
    <TableCell colSpan={7}>
  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.5 }}>
    <FolderOpenIcon sx={{ color: "#0284c7", fontSize: 22 }} />
    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#0369a1", letterSpacing: "0.3px" }}>
      {medicine.name}
    </Typography>
  </Box>
</TableCell>
  </TableRow>
        );
      }

      // لمن ما فيه فلتر ولا بحث فعّال (عرض "الكل")، نستخدم الرقم الثابت اللي
      // يعتمد عليه البحث برقم السطر بقائمة المخزون الكاملة. لكن لمن يكون
      // فيه فلتر تصنيف/حالة أو بحث نشط (مثل الضغط على "Safe Medicines" من
      // الداشبورد)، لازم الترقيم يكون متسلسل 1..N ضمن النتائج المعروضة —
      // وإلا يطلع فجوات بالأرقام (زي 45، 46، 47... 51) لأن أرقام الأدوية
      // المستبعدة بالفلتر تظل محسوبة بترتيبها الأصلي بالقائمة الكاملة
      const isNumberingFiltered =
        Boolean(search && search.trim()) ||
        selectedCategory !== "All" ||
        selectedStatus !== "All";
      const drugCounter = isNumberingFiltered
        ? actualIndex + 1
        : medicineLineNumbers.get(medicine.id) ?? (actualIndex + 1);
      const isHighlighted = medicine.id === highlightedMedicineId;

      return (
              <TableRow
                key={medicine.id ?? `row-${actualIndex}`}
                ref={(el) => { rowRefs.current[medicine.id] = el; }}
                sx={isHighlighted ? {
                  animation: "shelfSensePulseHighlight 1.3s ease-in-out 2",
                  "@keyframes shelfSensePulseHighlight": {
                    "0%": { backgroundColor: "#FEF9C3" },
                    "50%": { backgroundColor: "#FDE047" },
                    "100%": { backgroundColor: "#FEF9C3" },
                  },
                } : undefined}
              >

              <TableCell align="center" sx={{ color: "#6b7280", fontWeight: 600 }}>
                {drugCounter}
              </TableCell>

              <TableCell>
  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
    <strong>{medicine.name}</strong>
   {medicine.otherNames && medicine.otherNames.length > 1 && (
  <Tooltip 
      title={
        <div>
          <strong style={{ display: 'block', marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '3px', color: '#60a5fa' }}>
           Official Ministry Name & Alternatives:
          </strong>
          <div style={{ fontSize: '0.85rem', lineHeight: '1.5', fontWeight: 'bold', color: '#f8fafc' }}>
             {medicine.name} <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>(Official Ministry Name)</span>
          </div>
          {medicine.otherNames && medicine.otherNames.filter(n => n !== medicine.name).map((name, idx) => (
            <div key={idx} style={{ fontSize: '0.8rem', lineHeight: '1.4', opacity: 0.9, marginTop: '2px' }}>
              • {name}
            </div>
          ))}
        </div>
      } 
      arrow
    >
      <IconButton size="small" color="primary">
        <InfoOutlinedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
)}
  </Box>

<div
  style={{
    display: "inline-flex",
    flexWrap: "wrap",
    gap: "6px",
    marginLeft: "8px",
    verticalAlign: "middle"
  }}
>

{medicine.labels?.map((label,labelIdx)=>(
  <Chip
    key={labelIdx}
    label={`${label.icon} ${label.name}`}
    onDelete={() => handleDeleteLabel(medicine.id, labelIdx)}
    sx={{
      backgroundColor: label.color,
      marginLeft:"6px",
      marginTop:"5px",
      color:"#fff",
      fontWeight:"bold"
    }}
  />
))}
</div> 
{[...new Set(medicine.categories || getDrugCategories(medicine.name, medicine.code))].map((category, i) => { 
  const badgeBg =
    category === "High Alert" ? "#E53935" :
    category === "Hazardous" ? "#8B5CF6" :
    category === "Sound Alike" ? "#FFD54F" :
    category === "Look Alike" ? "#FFD54F" :
    "#ccc";
  const badgeColor = category === "Look Alike" || category === "Sound Alike" ? "#000" : "#fff";

  return (
    <Box
      key={i}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        marginLeft: "6px",
        padding: "4px 10px",
        whiteSpace: "nowrap",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: "bold",
        backgroundColor: badgeBg,
        color: badgeColor,
      }}
    >
      {category}
      {category === "High Alert" && <AlertTriangle size={14} color={badgeColor} strokeWidth={2.2} />}
      {category === "Sound Alike" && <Ear size={14} color={badgeColor} strokeWidth={2.2} />}
      {category === "Look Alike" && <LookAlikeEyeIcon size={17} color={badgeColor} strokeWidth={2.2} />}
    </Box>
  );
})}
</TableCell>
                
                {/* عمود الكود المستقل مع زر النسخ السريع والعبارات النصية الخفيفة */}
<TableCell>
  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
    <Typography 
      variant="body2" 
      sx={{ 
        fontFamily: medicine.code && /^\d+$/.test(medicine.code) ? "monospace" : "inherit", 
        fontWeight: 600,
        color: medicine.code && /^\d+$/.test(medicine.code) ? "text.primary" : "text.secondary",
        fontStyle: medicine.code && !/^\d+$/.test(medicine.code) ? "italic" : "normal",
        fontSize: medicine.code && !/^\d+$/.test(medicine.code) ? "0.85rem" : "0.9rem"
      }}
    >
      {medicine.code || "-"}
    </Typography>
    
    {/* زر النسخ يظهر فقط إذا كان الكود عبارة عن رقم حقيقي وليس عبارة نصية */}
    {medicine.code && /^\d+$/.test(medicine.code) && (
      <Tooltip title={copiedId === medicine.id ? "Copied!" : "Copy Code"}>
        <IconButton
          size="small"
          onClick={() => handleCopyCode(medicine.code, medicine.id)}
          sx={{ bgcolor: copiedId === medicine.id ? "#dcfce7" : "#f3f4f6", p: 0.5, transition: "0.2s" }}
        >
          {copiedId === medicine.id ? (
            <CheckIcon sx={{ fontSize: 14, color: "#16a34a" }} />
          ) : (
            <ContentCopyIcon sx={{ fontSize: 13 }} />
          )}
        </IconButton>
      </Tooltip>
    )}
  </Box>
</TableCell>

               <TableCell>
  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
    <Typography variant="body2" sx={{ fontWeight: 600 }}>
      {medicine.quantity}
    </Typography>
    {medicine.quantities && medicine.quantities.length > 1 && (
  <Tooltip 
    title={
      <Box sx={{ p: 0.5 }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 'bold', mb: 0.5, borderBottom: '1px solid rgba(255,255,255,0.2)', pb: 0.5, color: '#60a5fa' }}>
          All Shipments Quantities:
        </Typography>
        {medicine.quantities.map((q, idx) => (
          <Box key={idx} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 0.3 }}>
            <Typography sx={{ fontSize: '0.8rem' }}>• {q}</Typography>
            <IconButton 
              size="small" 
              onClick={(e) => {
                e.stopPropagation();
                const updatedShipments = medicine.quantities.filter((_, i) => i !== idx);
                const updatedMedicines = medicines.map(med => {
                  if (med.id === medicine.id) {
                    return {
                      ...med,
                      quantities: updatedShipments,
                      quantity: updatedShipments[updatedShipments.length - 1] || "0"
                    };
                  }
                  return med;
                });
                setMedicines(updatedMedicines);
              }}
              sx={{ color: '#f87171', p: 0.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
            >
              <DeleteIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        ))}
      </Box>
    } 
    arrow
  >
    <IconButton size="small" color="primary" sx={{ p: 0.5 }}>
      <InfoOutlinedIcon fontSize="small" />
    </IconButton>
  </Tooltip>
)}
  </Box>
</TableCell>

                <TableCell>
  {(medicine.expiryDates || [medicine.expiry]).map((date, i) => (
    <Box key={i} mb={1}>
      <Typography variant="body2">
        {date}
      </Typography>

      {date && (
        <Tooltip
          title={getCountdownText(date)}
          arrow
          placement="top"
          enterTouchDelay={0}
          leaveTouchDelay={3000}
        >
          <Chip
            label={getStatus(date)}
            color={
              getStatus(date) === "Safe"
                ? "success"
                : getStatus(date) === "Near Expiry"
                ? "warning"
                : "error"
            }
            size="small"
            sx={{ mt: 0.5, cursor: "pointer" }}
          />
        </Tooltip>
      )}
    </Box>
  ))}
</TableCell>

{/* عمود طلب موصول Mawsool */}
<TableCell align="center">
  <Tooltip title={medicine.mawsoolOrder ? "Requested from Mawsool" : "Click to mark for Mawsool order"}>
    <Checkbox
      icon={<LocalPharmacyIcon sx={{ color: "#d1d5db" }} />}
      checkedIcon={<LocalPharmacyIcon sx={{ color: "#2563eb" }} />}
      checked={Boolean(medicine.mawsoolOrder)}
      onChange={() => handleToggleMawsool(medicine.id)}
    />
  </Tooltip>
</TableCell>

{/* أزرار الأكشن المنمقة في صندوق مرتب (Action Toolbar) */}
<TableCell align="center">
  <Box sx={{ display: "inline-flex", bgcolor: "#f3f4f6", p: 0.5, borderRadius: "10px", gap: 0.5 }}>
    <Tooltip title="Edit Medicine">
      <IconButton size="small" onClick={() => { setNewMedicine({ ...medicine, expiryDates: medicine.expiryDates?.length ? [...medicine.expiryDates] : [medicine.expiry || ""] }); setEditIndex(medicine.id); setCodeNotRecognized(false); setIsDualCodeEntry(false); setSecondMedicine(emptySecondMedicine()); setCodeSuggestion(null); setNameSuggestion(null); setOpen(true); }} sx={{ bgcolor: "#fff", "&:hover": { bgcolor: "#e5e7eb" }, borderRadius: "8px" }}>
        <EditIcon fontSize="small" sx={{ color: "#374151" }} />
      </IconButton>
    </Tooltip>
    <Tooltip title="Add Custom Tag / Label">
      <IconButton size="small" onClick={() => { setLabelMedicine(medicine); setLabelOpen(true); }} sx={{ bgcolor: "#fff", "&:hover": { bgcolor: "#e5e7eb" }, borderRadius: "8px" }}>
        <LocalOfferIcon fontSize="small" sx={{ color: "#2563eb" }} />
      </IconButton>
    </Tooltip>
    <Tooltip title="Delete Medicine">
      <span>
        <IconButton
          size="small"
          color="error"
          disabled={deletingIds.has(medicine.id)}
          onClick={() => handleDelete(medicine.id)}
          sx={{ bgcolor: "#fff", "&:hover": { bgcolor: "#fee2e2" }, borderRadius: "8px" }}
        >
          {deletingIds.has(medicine.id) ? (
            <CircularProgress size={16} color="error" />
          ) : (
            <DeleteIcon fontSize="small" />
          )}
        </IconButton>
      </span>
    </Tooltip>
  </Box>
</TableCell>

              </TableRow>
      );
    });
})()
)}

          </TableBody>

        </Table>

        {/* شريط ترقيم صفحات احترافي: أول/سابق/أرقام صفحات مع "..." للفجوات/تالي/أخير،
            بدل شكل TablePagination الافتراضي — نفس أرقام الصفحة والكمية بالصف ماتغيرت */}
        {(() => {
          const medicinesOnlyCount = filteredMedicines.filter((m) => !m.isSection).length;
          const totalPages = Math.max(1, Math.ceil(medicinesOnlyCount / rowsPerPage));
          const currentPage = page + 1;
          const from = medicinesOnlyCount === 0 ? 0 : page * rowsPerPage + 1;
          const to = Math.min(medicinesOnlyCount, (page + 1) * rowsPerPage);
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
                borderTop: "1px solid #EAECF0",
                px: 2,
                py: 1.5,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Typography sx={{ fontSize: 13, color: "#667085" }}>
                  Showing {from} to {to} of {medicinesOnlyCount} items
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

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          Add Medicine
          {isDualCodeEntry && editIndex === null && (
            <Tooltip title="This NUPCO code has a second item — scroll down to fill in its details too">
              <Chip
                icon={<KeyboardDoubleArrowDownIcon sx={{ fontSize: 16, color: "#fff !important" }} />}
                label="2nd item below"
                size="small"
                sx={{
                  bgcolor: "#2563eb",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 11,
                  animation: "dualItemHintBounce 1.4s ease-in-out infinite",
                  "@keyframes dualItemHintBounce": {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(3px)" },
                  },
                }}
              />
            </Tooltip>
          )}
        </DialogTitle>

        <DialogContent>

          <TextField
            label="NUPCO Code"
            fullWidth
            margin="normal"
            value={newMedicine.code}
            onChange={handleCodeChange}
            onKeyDown={handleCodeFieldKeyDown}
            placeholder="Enter Nupco Code to fetch name automatically..."
          />

          {/* اقتراح شفاف (مو تعبئة فعلية) وإحنا لسا بنص كتابة الكود — يظهر بس
              لو فيه مطابقة بادئة واضحة، ويختفي أول ما يوصل الكود لمطابقة تامة
              أو يطول عن الحد المسموح. الضغط Tab أو Enter يقبله */}
          {codeSuggestion && !codeTooLong && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                mt: -1,
                mb: 1.5,
                px: 0.5,
                opacity: 0.75,
              }}
            >
              <KeyboardTabIcon sx={{ fontSize: 13, color: "#94a3b8" }} />
              <Typography sx={{ fontSize: 11.5, color: "#64748b", fontStyle: "italic" }}>
                {codeSuggestion.name} ({codeSuggestion.code}) — press Tab to autofill
              </Typography>
            </Box>
          )}

          {/* تحذير طول الكود — نقلته يصير مباشرة تحت خانة NUPCO Code نفسها
              (كان يظهر غلط تحت خانة الاسم)، وبتصميم صندوق واضح بدل السطر
              الرفيع القديم اللي كان يعتمد على margin سالب */}
          {codeTooLong && (
            <Box
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1,
                bgcolor: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: "10px",
                p: 1.25,
                mt: -1,
                mb: 1.5,
              }}
            >
              <WarningAmberIcon sx={{ fontSize: 18, color: "#d97706", mt: 0.15 }} />
              <Typography sx={{ fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
                This exceeds the usual NUPCO code digit count ({NUPCO_CODE_LENGTH} digits) — double-check it before saving.
              </Typography>
            </Box>
          )}

          <TextField
            label="Medicine Name"
            fullWidth
            margin="normal"
            value={newMedicine.name}
            onChange={handleNameFieldChange}
            onKeyDown={handleNameFieldKeyDown}
          />

          {/* نفس فكرة الاقتراح الشفاف بس بالاتجاه المعاكس: كتب اسم يطابق
              بداية اسم بقاعدة بيانات الوزارة وخانة الكود لسا فاضية */}
          {nameSuggestion && !newMedicine.code && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                mt: -1,
                mb: 1.5,
                px: 0.5,
                opacity: 0.75,
              }}
            >
              <KeyboardTabIcon sx={{ fontSize: 13, color: "#94a3b8" }} />
              <Typography sx={{ fontSize: 11.5, color: "#64748b", fontStyle: "italic" }}>
                NUPCO code: {nameSuggestion.code} — press Tab to autofill
              </Typography>
            </Box>
          )}

          {/* تحذير "الكود مو موجود بقاعدة البيانات" — يفضل بنفس مكانه تحت
              خانة الاسم، بس بتصميم صندوق أوضح ومرتب بدل السطر الرفيع القديم */}
          {codeNotRecognized && (
            <Box
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1,
                bgcolor: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: "10px",
                p: 1.25,
                mt: -1,
                mb: 1.5,
              }}
            >
              <WarningAmberIcon sx={{ fontSize: 18, color: "#d97706", mt: 0.15 }} />
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, flexWrap: "wrap" }}>
                  <Typography sx={{ fontSize: 12, color: "#92400e", fontWeight: 600 }}>
                    NUPCO code not found in our database.
                  </Typography>
                  <Tooltip
                    arrow
                    placement="top"
                    title={
                      <Box sx={{ p: 0.5 }}>
                        <Typography sx={{ fontSize: 11.5, fontWeight: 700, mb: 0.5 }}>
                          Before adding it manually:
                        </Typography>
                        <Typography sx={{ fontSize: 11, lineHeight: 1.6 }}>
                          1. Make sure it's a NUPCO code, not a MOH code<br />
                          2. Double-check you typed it correctly<br />
                          3. If it's correct, adding it now will auto-match future
                          items — or send it to support to add it and stay in sync
                          with ministry updates
                        </Typography>
                      </Box>
                    }
                  >
                    <InfoOutlinedIcon
                      sx={{ fontSize: 15, color: "#b45309", cursor: "help" }}
                    />
                  </Tooltip>
                </Box>

                <Typography
                  onClick={() => navigate("/support")}
                  sx={{
                    fontSize: 11.5,
                    color: "#b45309",
                    fontWeight: 700,
                    cursor: "pointer",
                    width: "fit-content",
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  Contact support
                </Typography>
              </Box>
            </Box>
          )}

          {/* صندوق أزرق فاتح يظهر الكاتيقوري المصاحبة تلقائيًا بمجرد ما
              يتعرف على اسم/كود الدواء — يختفي طبيعي لو ما فيه كاتيقوري */}
          {(() => {
            const previewCategories = newMedicine.name
              ? [...new Set(getDrugCategories(newMedicine.name, newMedicine.code) || [])]
              : [];
            if (previewCategories.length === 0) return null;
            return (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1,
                  bgcolor: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "10px",
                  p: 1.25,
                  mt: 0.5,
                  mb: 1,
                }}
              >
                <CategoryIcon sx={{ fontSize: 18, color: "#2563eb", mt: 0.3 }} />
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#1d4ed8" }}>
                    Category
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.6 }}>
                    {previewCategories.map((category, i) => (
                      <Chip
                        key={i}
                        label={category}
                        size="small"
                        sx={{
                          bgcolor: "#dbeafe",
                          color: "#1e40af",
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      />
                    ))}
                  </Box>
                  {/* رابط لأداة التحقق من التصنيف بصفحة الدعم — نفس الزر
                      الموجود بصفحة طباعة الليبلز بالضبط */}
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => window.open("/support", "_blank")}
                    sx={{
                      mt: 0.5,
                      textTransform: "none",
                      fontWeight: 600,
                      borderRadius: "8px",
                      borderColor: "#2563eb",
                      color: "#2563eb",
                      alignSelf: "flex-start",
                    }}
                  >
                    Not sure of the category? Check it →
                  </Button>
                </Box>
              </Box>
            );
          })()}

          <TextField
            label="Quantity"
            fullWidth
            margin="normal"
            value={newMedicine.quantity}
            onChange={(e) =>
              setNewMedicine({
                ...newMedicine,
                quantity: normalizeDigits(e.target.value),
              })
            }
          />

          <TextField
            label="Reorder Level"
            fullWidth
            margin="normal"
            helperText="Optional — medicine shows under Low Stock once quantity reaches this number or below (defaults to 20)"
            value={newMedicine.reorderLevel ?? "20"}
            onChange={(e) =>
              setNewMedicine({
                ...newMedicine,
                reorderLevel: normalizeDigits(e.target.value),
              })
            }
          />

         {newMedicine.expiryDates.map((date, index) => (
  <Box
    key={index}
    sx={{ display: "flex", gap: 1, alignItems: "center" }}
  >
    <TextField
      type="text"
      fullWidth
      margin="normal"
      label={`Expiry ${index + 1}`}
      placeholder="e.g. 2027-05-05 or just 5/2027"
      helperText="Full date, or just month/year (last day of that month is used automatically)"
      value={date}
      onChange={(e) => {
        // نسمح بالكتابة الحرة (أي ترتيب أو صيغة)، فقط نحول الأرقام العربية لإنجليزية
        const dates = [...newMedicine.expiryDates];
        dates[index] = normalizeDigits(e.target.value);

        setNewMedicine({
          ...newMedicine,
          expiryDates: dates,
        });
      }}
      onBlur={(e) => {
        // بس لما يخلص من الكتابة (يطلع من الحقل) نحوّل الصيغة لـ YYYY-MM-DD
        // بنفس منطق استيراد الإكسل بالضبط (يحافظ على اليوم لو مكتوب، وإلا آخر يوم بالشهر)
        const dates = [...newMedicine.expiryDates];
        dates[index] = parseFlexibleDate(e.target.value);

        setNewMedicine({
          ...newMedicine,
          expiryDates: dates,
        });
      }}
      slotProps={{
        inputLabel: { shrink: true },
        htmlInput: { dir: "ltr", style: { direction: "ltr", textAlign: "left" } },
        input: {
          endAdornment: (
            <IconButton
              size="small"
              onClick={() => {
                const input = hiddenDateInputRefs.current[index];
                if (input) {
                  if (typeof input.showPicker === "function") {
                    input.showPicker();
                  } else {
                    input.click();
                  }
                }
              }}
            >
              <CalendarMonthIcon fontSize="small" />
            </IconButton>
          ),
        },
      }}
    />

    {/* حقل تاريخ أصلي مخفي بس نستخدمه لفتح تقويم الاختيار؛ قيمته دايمًا
        YYYY-MM-DD برمجيًا بغض النظر عن لغة النظام (اللي كانت تسبب مشكلة
        "رهش/موي")، فما نعرضه للمستخدم أبدًا، بس نسحب منه القيمة بعد الاختيار */}
    <input
      ref={(el) => (hiddenDateInputRefs.current[index] = el)}
      type="date"
      value={date}
      onChange={(e) => {
        const dates = [...newMedicine.expiryDates];
        dates[index] = e.target.value;
        setNewMedicine({
          ...newMedicine,
          expiryDates: dates,
        });
      }}
      style={{
        position: "absolute",
        width: 0,
        height: 0,
        opacity: 0,
        pointerEvents: "none",
        border: "none",
      }}
    />

    <IconButton
      color="error"
      onClick={() => {
        const dates = newMedicine.expiryDates.filter(
          (_, i) => i !== index
        );

        setNewMedicine({
          ...newMedicine,
          expiryDates: dates,
        });
      }}
    >
      ✕
    </IconButton>
  </Box>
))}
<Button
    variant="outlined"
    sx={{ mt: 1 }}
    onClick={() =>
        setNewMedicine({
            ...newMedicine,
            expiryDates: [...newMedicine.expiryDates, ""],
        })
    }
>
    + Add Expiry Date
</Button>

{/* الخانة الثانية — تظهر فقط لمن الكود المكتوب من الأكواد المشتركة
    الاستثنائية (وإحنا بوضع إضافة جديد مو تعديل). لمن يضغط "حفظ" ينحفظ
    هذا الصنف كسجل مستقل تمامًا بكميته وتواريخه الخاصة */}
{isDualCodeEntry && editIndex === null && (
  <Box
    sx={{
      mt: 2.5,
      pt: 2,
      borderTop: "2px dashed #bfdbfe",
    }}
  >
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.8,
        bgcolor: "#eff6ff",
        border: "1px solid #bfdbfe",
        borderRadius: "10px",
        p: 1,
        mb: 1,
      }}
    >
      <InfoOutlinedIcon sx={{ fontSize: 16, color: "#2563eb" }} />
      <Typography sx={{ fontSize: 12, color: "#1d4ed8", fontWeight: 600 }}>
        This NUPCO code is shared by two different items. Add the second item's details below —
        both will be saved as separate entries with their own quantity and expiry.
      </Typography>
    </Box>

    <TextField
      label="Second Item — Medicine Name"
      fullWidth
      margin="normal"
      value={secondMedicine.name}
      onChange={(e) => setSecondMedicine({ ...secondMedicine, name: e.target.value })}
    />

    <TextField
      label="Second Item — Quantity"
      fullWidth
      margin="normal"
      value={secondMedicine.quantity}
      onChange={(e) => setSecondMedicine({ ...secondMedicine, quantity: normalizeDigits(e.target.value) })}
    />

    <TextField
      label="Second Item — Reorder Level"
      fullWidth
      margin="normal"
      helperText="Optional — defaults to 20"
      value={secondMedicine.reorderLevel ?? "20"}
      onChange={(e) => setSecondMedicine({ ...secondMedicine, reorderLevel: normalizeDigits(e.target.value) })}
    />

    {secondMedicine.expiryDates.map((date, index) => (
      <Box key={index} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <TextField
          type="text"
          fullWidth
          margin="normal"
          label={`Second Item — Expiry ${index + 1}`}
          placeholder="e.g. 2027-05-05 or just 5/2027"
          helperText="Full date, or just month/year (last day of that month is used automatically)"
          value={date}
          onChange={(e) => {
            const dates = [...secondMedicine.expiryDates];
            dates[index] = normalizeDigits(e.target.value);
            setSecondMedicine({ ...secondMedicine, expiryDates: dates });
          }}
          onBlur={(e) => {
            const dates = [...secondMedicine.expiryDates];
            dates[index] = parseFlexibleDate(e.target.value);
            setSecondMedicine({ ...secondMedicine, expiryDates: dates });
          }}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { dir: "ltr", style: { direction: "ltr", textAlign: "left" } },
            input: {
              endAdornment: (
                <IconButton
                  size="small"
                  onClick={() => {
                    const input = hiddenDateInputRefs2.current[index];
                    if (input) {
                      if (typeof input.showPicker === "function") {
                        input.showPicker();
                      } else {
                        input.click();
                      }
                    }
                  }}
                >
                  <CalendarMonthIcon fontSize="small" />
                </IconButton>
              ),
            },
          }}
        />

        <input
          ref={(el) => (hiddenDateInputRefs2.current[index] = el)}
          type="date"
          value={date}
          onChange={(e) => {
            const dates = [...secondMedicine.expiryDates];
            dates[index] = e.target.value;
            setSecondMedicine({ ...secondMedicine, expiryDates: dates });
          }}
          style={{
            position: "absolute",
            width: 0,
            height: 0,
            opacity: 0,
            pointerEvents: "none",
            border: "none",
          }}
        />

        <IconButton
          color="error"
          onClick={() => {
            const dates = secondMedicine.expiryDates.filter((_, i) => i !== index);
            setSecondMedicine({ ...secondMedicine, expiryDates: dates });
          }}
        >
          ✕
        </IconButton>
      </Box>
    ))}
    <Button
      variant="outlined"
      sx={{ mt: 1 }}
      onClick={() =>
        setSecondMedicine({
          ...secondMedicine,
          expiryDates: [...secondMedicine.expiryDates, ""],
        })
      }
    >
      + Add Expiry Date (Second Item)
    </Button>
  </Box>
)}
        </DialogContent>

        <DialogActions>

          <Button
            onClick={() => {
              setOpen(false);
              setIsDualCodeEntry(false);
              setSecondMedicine(emptySecondMedicine());
              setCodeSuggestion(null);
              setNameSuggestion(null);
            }}
          >
            Cancel
          </Button>

  <Button
  variant="contained"
  onClick={handleSave}
>
  Save
</Button>

        </DialogActions>

            </Dialog>


      {/* نافذة إضافة تگ أو علامة مخصصة مع تظليل واضح للاختيار */}
      <Dialog 
        open={labelOpen} 
        onClose={() => setLabelOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Add Custom Tag
        </DialogTitle>

        <DialogContent dividers>
          <TextField
            fullWidth
            size="small"
            label="Tag Name (e.g. High Alert)"
            value={labelName}
            onChange={(e)=>setLabelName(e.target.value)}
            margin="normal"
          />
         
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
            Choose Color
          </Typography>
          <input
            type="color"
            value={labelColor}
            onChange={(e) => setLabelColor(e.target.value)}
            style={{ width: "100%", height: 40, border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer", padding: 2 }}
          />

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
            Choose Icon
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {[
              { icon: "🏷️", name: "Tag" },
              { icon: "⚠️", name: "Warning" },
              { icon: "👁️", name: "Look Alike" },
              { icon: "👂", name: "Sound Alike" },
              { icon: "🔒", name: "Secure" },
              { icon: "❄️", name: "Cold Chain" },
              { icon: "💊", name: "Pill" }
            ].map((item) => (
              <Tooltip key={item.icon} title={item.name} arrow>
                <Button
                  onClick={() => setLabelIcon(item.icon)}
                  sx={{
                    minWidth: 42,
                    height: 42,
                    fontSize: "20px",
                    borderRadius: "10px",
                    bgcolor: labelIcon === item.icon ? "#e0e7ff" : "#f3f4f6",
                    border: labelIcon === item.icon ? "2px solid #2563eb" : "2px solid transparent",
                    "&:hover": { bgcolor: "#dbeafe" }
                  }}
                >
                  {item.icon}
                </Button>
              </Tooltip>
            ))}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setLabelOpen(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>

        <Button
          variant="contained"
          onClick={() => {
            if(!labelName.trim()){
              alert("Please enter label name");
              return;
            }
            const updated = medicines.map((med) => {
              if (med.id === labelMedicine.id) {
                return {
                  ...med,
                  labels:[
                    ...(med.labels || []),
                    { name: labelName.trim(), color: labelColor, icon: labelIcon }
                  ]
                };
              }
              return med;
            });

            setMedicines(updated);
            setLabelOpen(false);
            setLabelName("");
          }}
          sx={{ textTransform: "none", borderRadius: "8px" }}
        >
          Save Tag
        </Button>
        </DialogActions>

     </Dialog>

{/* ===== Manage Sections ===== */}

<Dialog
  open={openSectionsDialog}
  onClose={() => setOpenSectionsDialog(false)}
  fullWidth
  maxWidth="sm"
>
  <DialogTitle>Manage Sections</DialogTitle>

  <DialogContent>

    <List>
{medicines
  .filter((med) => med.isSection)
  .map((section, idx) => (        <ListItem
          key={idx}
          secondaryAction={
            <IconButton
              onClick={() => handleDeleteSection(section.name || section)}
            >
              <DeleteIcon color="error" />
            </IconButton>
          }
        >
          <ListItemText primary={section.name || section} />
        </ListItem>
      ))}
    </List>

    {medicines.filter((med) => med.isSection).length === 0 && (
      <Typography variant="body2" color="textSecondary" sx={{ py: 2, textAlign: "center" }}>
        No sections found. Sections are automatically imported from Excel files.
      </Typography>
    )}

  </DialogContent>

  <DialogActions>

    <Button
      onClick={() => setOpenSectionsDialog(false)}
    >
      Close
    </Button>

  </DialogActions>
</Dialog>
{/* نافذة تنبيه الأدوية المكررة مع إمكانية تعديل الكميات يدوياً */}
<Dialog 
  open={duplicateModalOpen} 
  onClose={() => setDuplicateModalOpen(false)}
  maxWidth="md"
  fullWidth
>
  <DialogTitle sx={{ fontWeight: 700, color: "#d97706", display: "flex", alignItems: "center", gap: 1 }}>
    ⚠️ Warning: Duplicate Medicines Detected (Matched by Nupco Code)
  </DialogTitle>
  <DialogContent dividers>
    <Typography variant="body2" sx={{ mb: 2, color: "#4b5563", fontWeight: 500 }}>
      These items share existing Nupco codes in your inventory. You can review or adjust incoming quantities manually before confirming:
    </Typography>
    
    <Box sx={{ maxHeight: 300, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 2, bgcolor: "#f9fafb" }}>
  <Table size="small" stickyHeader>
        <TableHead sx={{ bgcolor: "#f3f4f6" }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, fontSize: "0.85rem" }}>Medicine Name</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: "0.85rem" }}>Nupco Code</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: "0.85rem" }}>Current Qty</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: "0.85rem" }}>Incoming Qty (Editable)</TableCell>
          </TableRow>
        </TableHead>
       <TableBody>
    {duplicateSummary
      .slice(dupPage * dupRowsPerPage, dupPage * dupRowsPerPage + dupRowsPerPage)
      .map((dup, idx) => {
        const actualDupIdx = dupPage * dupRowsPerPage + idx;
        return (
          <TableRow key={actualDupIdx} sx={{ "&:hover": { bgcolor: "#fff" } }}>
            <TableCell sx={{ fontSize: "0.85rem", fontWeight: 600, color: "#1f2937" }}>{dup.name}</TableCell>
            <TableCell sx={{ fontSize: "0.85rem", fontFamily: "monospace", color: "#4b5563" }}>{dup.code || "No Code"}</TableCell>
            <TableCell sx={{ fontSize: "0.85rem", fontWeight: 600, color: "#2563eb" }}>{dup.existingQty}</TableCell>
            <TableCell sx={{ py: 1 }}>
              <TextField
                size="small"
                value={dup.newQty}
                onChange={(e) => {
                  const val = normalizeDigits(e.target.value);
                  setDuplicateSummary(prev => prev.map((item, i) => i === actualDupIdx ? { ...item, newQty: val } : item));
                }}
                sx={{ width: "130px", bgcolor: "#fff" }}
                slotProps={{ htmlInput: { style: { fontSize: "0.85rem", padding: "6px 8px" } } }}
              />
            </TableCell>
          </TableRow>
        );
      })}
  </TableBody>
      </Table>
    </Box>
    <TablePagination
  component="div"
  count={duplicateSummary.length}
  page={dupPage}
  onPageChange={(e, newPage) => setDupPage(newPage)}
  rowsPerPage={dupRowsPerPage}
  onRowsPerPageChange={(e) => {
    setDupRowsPerPage(parseInt(e.target.value, 10));
    setDupPage(0);
  }}
  rowsPerPageOptions={[5, 10, 25]}
  size="small"
/>
  </DialogContent>
  <DialogActions sx={{ p: 2, gap: 1 }}>
    <Button 
      onClick={() => setDuplicateModalOpen(false)} 
      sx={{ textTransform: "none", color: "text.secondary", fontWeight: 600 }}
    >
      Cancel
    </Button>
    <Button 
    variant="contained" 
    color="warning" 
    disabled={isMerging}
    onClick={() => {
      setIsMerging(true);

      setTimeout(() => {
        let currentMedicines = [...medicines];

        duplicateSummary.forEach(dup => {
          const dupCode = String(dup.code || "").trim();
          const dupName = String(dup.name || "").trim().toLowerCase();

          const foundIdx = currentMedicines.findIndex(m => {
            if (m.isSection) return false;
            const mCode = String(m.code || "").trim();
            const mName = String(m.name || "").trim().toLowerCase();

            if (dupCode && dupCode !== "No Code Available" && mCode && mCode !== "No Code Available") {
              return mCode === dupCode;
            }

            const isDupNoCode = !dupCode || dupCode === "No Code Available";
            const isMNoCode = !mCode || mCode === "No Code Available";

            return isDupNoCode && isMNoCode && mName === dupName;
          });

          if (foundIdx !== -1) {
            const med = currentMedicines[foundIdx];
            let shipments = Array.isArray(med.quantities) ? [...med.quantities] : [med.quantity || "1"];
            
            const newQtyStr = String(dup.newQty).trim();
            if (newQtyStr) {
              shipments.push(newQtyStr);
            }

            // لو الدواء المكرر جايبه معه تواريخ انتهاء (زي حالة إضافة دواء يدويًا)، ندمجها مع تواريخ الدواء الموجود
            const incomingDates = Array.isArray(dup.expiryDates) ? dup.expiryDates.filter((d) => d) : [];
            const existingDates = med.expiryDates || (med.expiry ? [med.expiry] : []);
            const combinedDates = Array.from(new Set([...existingDates, ...incomingDates]));

            currentMedicines[foundIdx] = {
              ...med,
              quantity: newQtyStr,
              quantities: shipments,
              expiryDates: combinedDates.length ? combinedDates : med.expiryDates,
              expiry: combinedDates.length ? combinedDates[0] : med.expiry,
            };
          } else {
            currentMedicines.push({
              id: crypto.randomUUID(),
              name: dup.name,
              code: dup.code || "",
              quantity: dup.newQty,
              quantities: [dup.newQty],
              expiryDates: (dup.expiryDates && dup.expiryDates.length) ? dup.expiryDates : [""],
              categories: getDrugCategories(dup.name, dup.code),
              labels: [],
              otherNames: [dup.name],
              dateAdded: new Date().toISOString(),
            });
          }
        });

        setMedicines(currentMedicines);

        // ⭐ باقي صفوف الملف (أدوية جديدة، أدوية بدون كود، أسطر تواريخ إضافية،
        // أقسام) كانت تُهمل بالكامل قبل لو الملف فيه أي دواء مكرر بالكود —
        // الحين نكمل معالجتها بنفس دالة الاستيراد الكاملة بعد ما خلصنا دمج
        // المكررات أعلاه، عشان ما يضيع أي صف من الملف
        const handledCodes = new Set(
          duplicateSummary
            .map((dup) => String(dup.code || "").trim().toLowerCase())
            .filter((c) => c && c !== "no code available")
        );
        const remainingRows = pendingExcelRows.filter((row) => {
          const rowCode = extractRowCode(row).toLowerCase();
          return !(rowCode && handledCodes.has(rowCode));
        });

        if (remainingRows.length > 0) {
          const finalMedicines = processExcelImport(remainingRows, currentMedicines);
          setMedicines(finalMedicines);
        }

        setIsMerging(false);
        setDuplicateModalOpen(false);
      }, 500);
    }}
    sx={{ textTransform: "none", fontWeight: 600, borderRadius: "8px", px: 3 }}
  >
    {isMerging ? "Merging & Adding..." : "Confirm & Merge by Nupco Code"}
  </Button>
  </DialogActions>
</Dialog>

{/* نافذة اختيار الأعمدة المراد تصديرها بالإكسل */}
<Dialog
  open={exportDialogOpen}
  onClose={() => setExportDialogOpen(false)}
  maxWidth="xs"
  fullWidth
>
  <DialogTitle sx={{ fontWeight: 700 }}>Export to Excel</DialogTitle>
  <DialogContent dividers>
    <Typography variant="body2" sx={{ mb: 2, color: "#4b5563" }}>
      Choose which columns to include in the exported file:
    </Typography>

    <Box sx={{ display: "flex", flexDirection: "column" }}>
      <FormControlLabel
        control={
          <Checkbox
            checked={exportColumns.name}
            onChange={(e) => setExportColumns({ ...exportColumns, name: e.target.checked })}
          />
        }
        label="Medicine Name"
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={exportColumns.code}
            onChange={(e) => setExportColumns({ ...exportColumns, code: e.target.checked })}
          />
        }
        label="Nupco Code"
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={exportColumns.quantity}
            onChange={(e) => setExportColumns({ ...exportColumns, quantity: e.target.checked })}
          />
        }
        label="Quantity (all shipments)"
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={exportColumns.expiry}
            onChange={(e) => setExportColumns({ ...exportColumns, expiry: e.target.checked })}
          />
        }
        label="Expiry Date"
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={exportColumns.status}
            onChange={(e) => setExportColumns({ ...exportColumns, status: e.target.checked })}
          />
        }
        label="Status (Safe / Near Expiry / Expired)"
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={exportColumns.mawsool}
            onChange={(e) => setExportColumns({ ...exportColumns, mawsool: e.target.checked })}
          />
        }
        label="Mawsool"
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={exportColumns.labels}
            onChange={(e) => setExportColumns({ ...exportColumns, labels: e.target.checked })}
          />
        }
        label="Custom Labels"
      />
    </Box>
  </DialogContent>
  <DialogActions sx={{ p: 2, gap: 1 }}>
    <Button
      onClick={() =>
        setExportColumns({
          name: true,
          code: true,
          quantity: true,
          expiry: true,
          status: true,
          mawsool: true,
          labels: true,
        })
      }
      sx={{ textTransform: "none", fontWeight: 600, mr: "auto" }}
    >
      Select All
    </Button>
    <Button
      onClick={() => setExportDialogOpen(false)}
      sx={{ textTransform: "none", color: "text.secondary", fontWeight: 600 }}
    >
      Cancel
    </Button>
    <Button
      variant="contained"
      color="success"
      onClick={handleExportExcel}
      sx={{ textTransform: "none", fontWeight: 600, borderRadius: "8px", px: 3 }}
    >
      Export
    </Button>
  </DialogActions>
</Dialog>

  {/* GLOBAL FOOTER (نفس فوتر الداش بورد بالضبط) */}
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

  {/* توست التراجع عن الحذف — يفضل ٥ ثواني */}
  <Snackbar
    open={undoSnackOpen}
    autoHideDuration={5000}
    onClose={() => setUndoSnackOpen(false)}
    anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
  >
    <Alert
      onClose={() => setUndoSnackOpen(false)}
      severity="info"
      variant="filled"
      action={
        <Button color="inherit" size="small" onClick={handleUndoDelete} sx={{ fontWeight: 700 }}>
          UNDO
        </Button>
      }
      sx={{ bgcolor: "#334155" }}
    >
      {pendingDelete ? `"${pendingDelete.medicine.name}" moved to trash` : "Medicine deleted"}
    </Alert>
  </Snackbar>

  {/* إشعار هادئ لو تعديل عادي (إضافة/تعديل/كمية) ما انحفظ فعليًا بالخلفية —
      نفس شكل وموقع إشعار التراجع بالضبط، بدون أي لون تحذيري مزعج */}
  <Snackbar
    open={syncErrorOpen}
    autoHideDuration={5000}
    onClose={() => setSyncErrorOpen(false)}
    anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
  >
    <Alert
      onClose={() => setSyncErrorOpen(false)}
      severity="info"
      variant="filled"
      sx={{ bgcolor: "#334155" }}
    >
      Change wasn't saved — weak internet connection, please try again
    </Alert>
  </Snackbar>

  {/* تنبيه لو التراجع (UNDO) ما نجح فعليًا بحفظه على فايرستور */}
  <Snackbar
    open={undoFailedOpen}
    autoHideDuration={6000}
    onClose={() => setUndoFailedOpen(false)}
    anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
  >
    <Alert onClose={() => setUndoFailedOpen(false)} severity="error" variant="filled">
      Undo failed — the item is still in the Trash. Please try restoring it from there.
    </Alert>
  </Snackbar>

  {/* نافذة سلة المهملات */}
  <Dialog open={trashOpen} onClose={() => setTrashOpen(false)} maxWidth="md" fullWidth>
    <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 700 }}>
      <DeleteSweepIcon /> Trash
      <Typography component="span" sx={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 500, ml: 1 }}>
        (items are kept for 30 days, then removed automatically)
      </Typography>
    </DialogTitle>
    <DialogContent dividers>
      {trashItems.length === 0 ? (
        <Box sx={{ py: 5, textAlign: "center", color: "#94a3b8" }}>
          <DeleteSweepIcon sx={{ fontSize: 42, mb: 1 }} />
          <Typography>Trash is empty</Typography>
        </Box>
      ) : (
        <>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Nupco Code</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Deleted</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {trashItems
              .slice()
              .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0))
              .slice(trashPage * trashRowsPerPage, trashPage * trashRowsPerPage + trashRowsPerPage)
              .map((item) => {
                const daysAgo = Math.floor((Date.now() - (item.deletedAt || 0)) / (24 * 60 * 60 * 1000));
                return (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.code || "-"}</TableCell>
                    <TableCell>{daysAgo <= 0 ? "Today" : `${daysAgo} ${daysAgo === 1 ? "day" : "days"} ago`}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Restore">
                        <IconButton size="small" color="primary" onClick={() => handleRestoreFromTrash(item)}>
                          <RestoreFromTrashIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete permanently">
                        <IconButton size="small" color="error" onClick={() => handlePermanentDelete(item.id)}>
                          <DeleteForeverIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={trashItems.length}
          page={trashPage}
          onPageChange={(e, newPage) => setTrashPage(newPage)}
          rowsPerPage={trashRowsPerPage}
          onRowsPerPageChange={(e) => {
            setTrashRowsPerPage(parseInt(e.target.value, 10));
            setTrashPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
        </>
      )}
    </DialogContent>
    <DialogActions sx={{ p: 2 }}>
      {trashItems.length > 0 && (
        <Button
          color="error"
          disabled={emptyingTrash}
          onClick={async () => {
            setEmptyingTrash(true);
            try {
              await handleEmptyTrash();
            } finally {
              setEmptyingTrash(false);
            }
          }}
          sx={{
            textTransform: "none", fontWeight: 600, mr: "auto",
            display: "flex", alignItems: "center", gap: 1,
          }}
        >
          {emptyingTrash && <CircularProgress size={15} thickness={5} sx={{ color: "inherit" }} />}
          {emptyingTrash ? "Deleting…" : "Delete All Permanently"}
        </Button>
      )}
      <Button onClick={() => setTrashOpen(false)} sx={{ textTransform: "none" }}>
        Close
      </Button>
    </DialogActions>
  </Dialog>

</Container>
  );
}

export default Inventory;