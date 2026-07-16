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

function lastDay(year, month) {
  return new Date(year, month, 0).getDate();
}

function formatDate(year, month) {
  const day = lastDay(year, month);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

export function parseSingleDate(value) {
  if (!value) return "";

  // Excel Serial Number
  if (typeof value === "number") {
    const excel = XLSX.SSF.parse_date_code(value);

    if (excel) {
      return `${excel.y}-${String(excel.m).padStart(2, "0")}-${String(
        excel.d
      ).padStart(2, "0")}`;
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
  if (!value) return [];

  // إذا كانت قيمة إكسل رقمية
 if (typeof value === "number") {
  const excel = XLSX.SSF.parse_date_code(value);

  if (excel) {
    return [formatDate(excel.y, excel.m)];
  }

  return [];
}
  let text = String(value);

  text = text.replace(/Near\s*Exp/gi, "");
  text = text.replace(/Near\s*EXP/gi, "");
  text = text.replace(/Expired/gi, "");
  text = text.replace(/remaining/gi, "");
  text = text.replace(/\(.*?\)/g, "");
  text = text.replace(/📍/g, "");

  const dates = [];

  function addDate(month, year) {
    month = Number(month);
    year = Number(year);

    if (year < 100) year += 2000;

    if (month >= 1 && month <= 12) {
      dates.push(formatDate(year, month));
    }
  }
    // 5-2027 أو 5/2027 أو 5.2027
  let match;

const regex1 =
  /(?<!\d)(\d{1,2})\s*[-/.]\s*(\d{4}|\d{2})(?!\d)/g;

while ((match = regex1.exec(text)) !== null) {
  console.log("regex1", match[0]);
  addDate(match[1], match[2]);
}

  // 2027-5 أو 2027/5
  const regex2 = /(?<![/\d])(\d{4})\s*[-/.]\s*(\d{1,2})(?!\/\d{4})/g;
  // 30/11/2027
  const regex3 = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;

  while ((match = regex3.exec(text)) !== null) {
  console.log("regex3", match[0]);
  addDate(match[2], match[3]);
}

  // January 2027 أو Jan 2027
  const monthRegex =
    /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/gi;

  while ((match = monthRegex.exec(text)) !== null) {
    addDate(monthMap[match[1].toLowerCase()], match[2]);
  }
    return [...new Set(dates)].sort();

}
  