import * as XLSX from "xlsx";

export function importExcel(file, callback) {
  const reader = new FileReader();

  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);

    const workbook = XLSX.read(data, {
      type: "array",
      cellDates: false,
    });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
console.log(sheet["C3"]);
console.log(sheet["C4"]);
console.log(sheet["C5"]);
console.log(sheet["C6"]);
    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: true,
    });
    console.log(rows[0]);
console.log(rows[1]);
console.log(rows[2]);
console.log(rows[3]);

    callback(rows);
  };

  reader.readAsArrayBuffer(file);
}