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