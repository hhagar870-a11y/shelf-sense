import * as XLSX from "xlsx";

const monthMap = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,

  يناير: 1,
  فبراير: 2,
  مارس: 3,
  أبريل: 4,
  ابريل: 4,
  مايو: 5,
  يونيو: 6,
  يوليو: 7,
  أغسطس: 8,
  اغسطس: 8,
  سبتمبر: 9,
  أكتوبر: 10,
  اكتوبر: 10,
  نوفمبر: 11,
  ديسمبر: 12,
};

function pad(n) {
  return String(n).padStart(2, "0");
}

function lastDay(year, month) {
  return new Date(year, month, 0).getDate();
}

// day = null/undefined  ->  ما فيه يوم محدد (شهر وسنة فقط) => نستخدم آخر يوم بالشهر
// day = رقم                -> يوم محدد صراحة => نحافظ عليه بالضبط
function formatDate(year, month, day) {
  const finalDay = day ? Number(day) : lastDay(year, month);
  return `${year}-${pad(month)}-${pad(finalDay)}`;
}

export function parseSingleDate(value) {
  if (!value) return "";

  // رقم تسلسلي من إكسل (يُفضّل ألا يصل هنا كرقم بعد إصلاح excelImporter,
  // لكن نتركه كخط أمان احتياطي مع الحفاظ على اليوم الحقيقي)
  if (typeof value === "number") {
    const excel = XLSX.SSF.parse_date_code(value);
    if (excel) {
      return formatDate(excel.y, excel.m, excel.d);
    }
  }

  let text = String(value);

  text = text.replace(/Near Exp/gi, "");
  text = text.replace(/remaining/gi, "");
  text = text.replace(/\(.*?\)/g, "");
  text = text.replace(/📍/g, "");
  text = text.trim();

  return text;
}

export function extractAllDates(value) {
  if (value === null || value === undefined || value === "") return [];

  // رقم تسلسلي من إكسل — خط أمان احتياطي (المفروض ما يوصل هنا كرقم بعد
  // إصلاح excelImporter.js، لأنه يحوّل التاريخ إلى نص ISO قبل ما يوصل هنا)
  if (typeof value === "number") {
    const excel = XLSX.SSF.parse_date_code(value);
    if (excel) {
      return [formatDate(excel.y, excel.m, excel.d)];
    }
    return [];
  }

  let text = String(value);
  if (!text) return [];

  text = text.replace(/Near\s*Exp/gi, "");
  text = text.replace(/Near\s*EXP/gi, "");
  text = text.replace(/Expired/gi, "");
  text = text.replace(/remaining/gi, "");
  text = text.replace(/\(.*?\)/g, "");
  text = text.replace(/📍/g, "");

  const dates = [];

  function addDate(year, month, day) {
    year = Number(year);
    month = Number(month);

    if (year < 100) year += 2000;

    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      dates.push(formatDate(year, month, day));
    }
  }

  // مهم جداً: نبدأ بالصيغ "الدقيقة" (اللي فيها يوم صريح) ونحذف كل جزء
  // نطابقه من النص قبل ما نجرب الصيغ "الغامضة" (شهر/سنة فقط)، عشان ما
  // ننتج تاريخين لنفس القيمة (واحد صحيح وواحد خاطئ من نفس الرقم)

  // 1) صيغة ISO القادمة من الاستيراد المصحّح: 2027-03-31
  let workingText = text.replace(
    /(\d{4})-(\d{1,2})-(\d{1,2})/g,
    (full, y, m, d) => {
      addDate(y, m, Number(d));
      return " ";
    }
  );

  // 2) يوم/شهر/سنة كامل: 30/11/2027 أو 5/5/2027 — يحافظ على اليوم بالضبط
  workingText = workingText.replace(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
    (full, d, m, y) => {
      addDate(y, m, Number(d));
      return " ";
    }
  );

  // 3) شهر/سنة فقط: 5-2027 أو 5/2027 أو 5.2027 -> آخر يوم بالشهر تلقائيًا
  const regex1 = /(?<!\d)(\d{1,2})\s*[-/.]\s*(\d{4}|\d{2})(?!\d)/g;
  let match;
  let safety1 = 0;
  while ((match = regex1.exec(workingText)) !== null && safety1 < 20) {
    addDate(match[2], match[1], null);
    safety1++;
  }

  // 4) اسم الشهر بالحروف: January 2027 أو Jan 2027 -> آخر يوم بالشهر
  const monthRegex =
    /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/gi;
  let safetyMonth = 0;
  while ((match = monthRegex.exec(workingText)) !== null && safetyMonth < 20) {
    const mNum = monthMap[match[1].toLowerCase()];
    if (mNum) {
      addDate(match[2], mNum, null);
    }
    safetyMonth++;
  }

  return [...new Set(dates)].sort();
}