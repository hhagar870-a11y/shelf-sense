import * as XLSX from "xlsx";

export function importExcel(file, callback) {
  const reader = new FileReader();

  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);

    const workbook = XLSX.read(data, {
      type: "array",
      cellDates: true,
    });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: true,
    });

    callback(rows);
  };

  reader.readAsArrayBuffer(file);
}