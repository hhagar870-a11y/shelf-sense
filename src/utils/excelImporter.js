import * as XLSX from "xlsx";

function pad(n) {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// يتحقق هل فورمات الخلية فيها رمز "يوم" (d) فعليًا، أو أنها شهر/سنة فقط
// زي "mmm-yyyy" أو "mm/yyyy" بدون يوم
function cellHasDayFormat(fmt) {
  if (!fmt) return true; // ما فيه فورمات معروف؟ نفترض فيه يوم عشان ما نضيع بيانات
  const clean = fmt.replace(/\[[^\]]*\]/g, ""); // نشيل أقسام زي [Red] من الفورمات
  return /d/i.test(clean);
}

// يحوّل الرقم التسلسلي لتاريخ إكسل إلى نص "YYYY-MM-DD" صحيح 100%
// مع مراعاة نظام التاريخ 1904 (سبب شائع لانزياح التاريخ بسنوات كاملة)
// واحترام اليوم الفعلي المخزّن إلا إذا كانت الخلية "شهر وسنة فقط"
export function excelSerialToISO(serial, date1904, cellFormat) {
  const parsed = XLSX.SSF.parse_date_code(serial, { date1904 });
  if (!parsed) return "";

  const hasDay = cellHasDayFormat(cellFormat);
  const day = hasDay ? parsed.d : lastDayOfMonth(parsed.y, parsed.m);

  return `${parsed.y}-${pad(parsed.m)}-${pad(day)}`;
}

export function importExcel(file, callback) {
  const reader = new FileReader();

  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);

    const workbook = XLSX.read(data, {
      type: "array",
      cellDates: false,
      cellNF: true, // نحتاجها عشان نقدر نفحص صيغة كل خلية (فيها يوم أو شهر/سنة بس)
    });

    // نظام 1904 (شائع بملفات جات من ماك أو بعض إعدادات SharePoint) هو
    // السبب الأشهر لانزياح التاريخ بحوالي 4 سنين لأن XLSX.SSF.parse_date_code
    // تفترض نظام 1900 افتراضيًا إذا ما قلنا لها غير ذلك
    const date1904 = Boolean(
      workbook.Workbook &&
        workbook.Workbook.WBProps &&
        workbook.Workbook.WBProps.date1904
    );

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const headerRowIdx = range.s.r;

    // نحدد عمود التاريخ من صف الهيدر
    let dateColIdx = null;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: headerRowIdx, c })];
      if (cell && cell.v && /expiry|date/i.test(String(cell.v))) {
        dateColIdx = c;
        break;
      }
    }

    const rawRows = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: true,
    });

    // نصلّح عمود التاريخ لكل صف *قبل* أي معالجة ثانية: نحوّله من رقم
    // تسلسلي إلى نص ISO صحيح يحترم اليوم الفعلي ونظام 1904/1900
    if (dateColIdx !== null) {
      rawRows.forEach((row, i) => {
        const excelRowIdx = headerRowIdx + 1 + i;
        const cellAddr = XLSX.utils.encode_cell({
          r: excelRowIdx,
          c: dateColIdx,
        });
        const cell = sheet[cellAddr];
        const dateKey = Object.keys(row).find((k) => /expiry|date/i.test(k));

        if (dateKey && typeof row[dateKey] === "number" && cell) {
          row[dateKey] = excelSerialToISO(row[dateKey], date1904, cell.z);
        }
      });
    }

    // ملاحظة مهمة: أزلنا هنا خطوة "دمج الأسطر المتقطعة" اللي كانت موجودة
    // سابقًا، لأنها كانت تحوّل التاريخ الرقمي إلى نص وتلصقه بفاصلة مع
    // التاريخ السابق (مثل "46477, 46934")، وهذا النص ما كان يتطابق مع
    // أي نمط بـ dateParser.js فكانت تُفقد تواريخ أو تُقرأ غلط.
    // Inventory.jsx (داخل processExcelImport) عنده أصلاً منطق يدمج أي
    // صف بدون اسم دواء ولكن فيه تاريخ مع آخر دواء صحيح فوقه — فهو
    // المكان الصحيح لهذا الدمج، فتركناه يقوم بالمهمة بدل التكرار هنا.
    callback(rawRows);
  };

  reader.readAsArrayBuffer(file);
}