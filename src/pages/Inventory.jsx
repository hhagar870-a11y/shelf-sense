import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
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
} from "@mui/material";

import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { importExcel } from "../utils/excelImporter";
import { extractAllDates } from "../utils/dateParser";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

function Inventory() {
    const navigate = useNavigate();
  const [open, setOpen] = useState(false);

const [medicines, setMedicines] = useState(() => {
  const saved = localStorage.getItem("medicines");

  if (saved) {
    return JSON.parse(saved);
  }

  return [
    {
      id: 1,
      name: "Panadol",
      quantity: 20,
      expiry: "2026-12-01",
      barcode: "628100000001",
      shelf: "A1",
    },
    {
      id: 2,
      name: "Augmentin",
      quantity: 10,
      expiry: "2026-09-15",
      barcode: "628100000002",
      shelf: "B3",
    },
    {
      id: 3,
      name: "Vitamin C",
      quantity: 30,
      expiry: "2027-01-20",
      barcode: "628100000003",
      shelf: "C2",
    },
  ];
  })

 const [newMedicine, setNewMedicine] = useState({
  name: "",
  batch: "",
  expiry: "",
  expiryDates: [""],
  quantity: "",
  shelf: "",
  barcode: "",
});

const [editIndex, setEditIndex] = useState(null);
const [search, setSearch] = useState("");
  const handleSave = () => {
    if (
      !newMedicine.name ||
      !newMedicine.quantity ||
      !newMedicine.expiry
    ) {
      alert("Please fill all fields");
      return;
    }

if (editIndex !== null) {
  const updatedMedicines = [...medicines];
  updatedMedicines[editIndex] = {
    ...newMedicine,
    expiry: newMedicine.expiryDates[0] || "",
};
  setMedicines(updatedMedicines);
  setEditIndex(null);
} else {
 setMedicines([
    ...medicines,
    {
        ...newMedicine,
        expiry: newMedicine.expiryDates[0] || "",
    },
]);
}
    setNewMedicine({
    name: "",
    batch: "",
    quantity: "",
    shelf: "",
    barcode: "",
    expiry: "",
    expiryDates: [""],
});

    setOpen(false);
    setEditIndex(null);
  };
  const normalizeDate = (value) => {
    console.log("DATE =", value);
  if (!value) return "";
if (value instanceof Date) {
  const year = value.getFullYear();
  const month = value.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();

  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}
// Excel Serial Date (مثل 46844)
if (typeof value === "number") {
    const excelDate = XLSX.SSF.parse_date_code(value);

    if (excelDate) {
        return `${excelDate.y}-${String(excelDate.m).padStart(2, "0")}-${String(excelDate.d).padStart(2, "0")}`;
    }
}
  let text = String(value).trim();

  text = text.replace(/\./g, "/");
  text = text.replace(/-/g, "/");

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
      const year = text.match(/\d{4}/)?.[0];

      if (!year) return value;

      const month = months[m];

      const lastDay = new Date(year, month, 0).getDate();
      console.log("Month:", month, "Year:", year, "Text:", text);

      return `${year}-${String(month).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
    }
  }

  const parts = text.split("/");

  if (parts.length === 2) {
    let month = Number(parts[0]);
    let year = Number(parts[1]);

    if (month > 12) {
      [year, month] = [month, year];
    }

    const lastDay = new Date(year, month, 0).getDate();

    return `${year}-${String(month).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
  }

  return value;
};
  const handleExcelUpload = (event) => {
  const file = event.target.files[0];

  if (!file) return;



importExcel(file, (rows) => {

  const medicinesFromExcel = rows.map((item) => {

    const expiryDates = extractAllDates(item["Expiry Date"]);
console.log({
  raw: item["Expiry Date"],
  parsed: expiryDates,
});
    return {
      name: item["Drug Name"] || "",
      barcode: "",
      batch: "",
      expiry: expiryDates[0] || "",
      expiryDates: expiryDates,
      quantity: item["Quantity"] || "",
      shelf: "",
    };

  });

  setMedicines(medicinesFromExcel);

  alert("Excel imported successfully");

});
};

const handleDelete = (index) => {
    

 const updatedMedicines = medicines.filter(
 (_, i) => i !== index
 );
 setMedicines(updatedMedicines);
};
const handleDeleteAll = () => {
  if (window.confirm("Are you sure you want to delete all medicines?")) {
    setMedicines([]);
    localStorage.removeItem("medicines");
  }
};
const handleExportExcel = async () => {

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Inventory");

  worksheet.columns = [
    { header: "Name", key: "name", width: 35 },
    { header: "Quantity", key: "quantity", width: 15 },
    { header: "Expiry Date", key: "expiry", width: 18 },
    { header: "Shelf", key: "shelf", width: 15 },
    { header: "Status", key: "status", width: 18 },
  ];

  worksheet.getRow(1).font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "1976D2" },
  };

  medicines.forEach((medicine) => {
if (
    !medicine.quantity &&
    (!medicine.expiryDates || medicine.expiryDates.length === 0) &&
    !medicine.expiry
) {
    const row = worksheet.addRow({
        name: medicine.name,
        quantity: "",
        expiry: "",
        shelf: "",
        status: "",
    });

    row.eachCell((cell) => {
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "D9F0FF" },
        };

        cell.font = {
            bold: true,
        };
    });

    return;
}
const expiryList =
  medicine.expiryDates && medicine.expiryDates.length
    ? medicine.expiryDates
    : [medicine.expiry];
expiryList.forEach((expiryDate) => {

const status = getStatus(
  medicine.expiryDates && medicine.expiryDates.length
    ? medicine.expiryDates[0]
    : medicine.expiry
);
const row = worksheet.addRow({    name: medicine.name,
    quantity: medicine.quantity,
  
        expiry: expiryDate,
    shelf: medicine.shelf,
    status: status,
});


row.getCell(3).alignment = {
    wrapText: true,
    vertical: "top",
};

if (medicine.expiryDates && medicine.expiryDates.length > 1) {
    row.height = medicine.expiryDates.length * 18;
}

    const statusCell = row.getCell(5);

    if (status === "Safe") {

      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "2E7D32" },
      };

      statusCell.font = {
        color: { argb: "FFFFFFFF" },
        bold: true,
      };

    } else if (status === "Near Expiry") {

      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "ED6C02" },
      };

      statusCell.font = {
        color: { argb: "FFFFFFFF" },
        bold: true,
      };

    } else {

      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "D32F2F" },
      };

      statusCell.font = {
        color: { argb: "FFFFFFFF" },
        bold: true,
      };

    }

  });
});

  const buffer = await workbook.xlsx.writeBuffer();

  saveAs(
    new Blob([buffer]),
    `Inventory_${new Date().toISOString().slice(0,10)}.xlsx`
  );

};
useEffect(() => {
  localStorage.setItem(
    "medicines",
    JSON.stringify(medicines)
  );
}, [medicines]);

const getStatus = (expiry) => {
  const today = new Date();
today.setHours(0, 0, 0, 0);

const expiryDate = new Date(expiry);
expiryDate.setHours(23, 59, 59, 999);
  const diffDays = Math.ceil(
    (expiryDate - today) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) return "Expired";
  if (diffDays <= 30) return "Near Expiry";
  return "Safe";
};

return (
    <Container sx={{ mt: 5 }}>
       <Button
  variant="outlined"
  onClick={() => navigate("/")}
  sx={{ mb: 2 }}
>
  🏠 Back to Home
</Button> 
      <Typography variant="h4" gutterBottom>
        <TextField
    fullWidth
    label="Search Medicine"
    variant="outlined"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    sx={{ mb: 3 }}
/>
        📦 Inventory
      </Typography>

     <Box sx={{ display: "flex", gap: 2, mb: 3 }}>

  <Button
    variant="contained"
    onClick={() => setOpen(true)}
  >
    + Add Medicine
  </Button>

  <Button
    component="label"
    variant="outlined"
  >
    Import Excel

    <input
      hidden
      type="file"
      accept=".xlsx,.xls"
      onChange={handleExcelUpload}
    />
  </Button>
  <Button
  variant="contained"
  color="success"
  onClick={handleExportExcel}
>
  Export Excel
</Button>

  <Button
    color="error"
    variant="contained"
    onClick={handleDeleteAll}
  >
    Clear Inventory
  </Button>

</Box>
      <TableContainer component={Paper}>
        <Table>

          <TableHead>
            <TableRow>
              <TableCell><b>Name</b></TableCell>
              <TableCell><b>Quantity</b></TableCell>
              <TableCell><b>Expiry Date</b></TableCell>
<TableCell><b>Status</b></TableCell>
<TableCell align="center"><b>Action</b></TableCell>
            </TableRow>
          </TableHead>

          <TableBody>

{medicines
  .filter((medicine) =>
    medicine.name.toLowerCase().includes(search.toLowerCase())
  )
  .map((medicine, index) => {
    if (
  !medicine.quantity &&
  (!medicine.expiryDates || medicine.expiryDates.length === 0) &&
  !medicine.expiry
) {
  return (
    <TableRow
      key={index}
      sx={{
        backgroundColor: "#d9f0ff",
      }}
    >
      <TableCell colSpan={6}>
        <strong>{medicine.name}</strong>
      </TableCell>
    </TableRow>
  );
}

return (
              <TableRow key={index}>

                <TableCell>
                  {medicine.name}
                </TableCell>

                <TableCell>
                  {medicine.quantity}
                </TableCell>

                <TableCell>
  {(medicine.expiryDates || [medicine.expiry]).map((date, i) => (
    <Box key={i} mb={1}>
      <Typography variant="body2">
        {date}
      </Typography>

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
        sx={{ mt: 0.5 }}
      />
    </Box>
  ))}
</TableCell>

<TableCell align="center">

    <IconButton
        onClick={() => {
    setNewMedicine({
        ...medicine,
        expiryDates:
            medicine.expiryDates && medicine.expiryDates.length
                ? [...medicine.expiryDates]
                : [medicine.expiry || ""],
    });

    setEditIndex(index);
    setOpen(true);
}}
    >
        <EditIcon />
    </IconButton>

    <IconButton
        color="error"
        onClick={() => handleDelete(index)}
    >
        <DeleteIcon />
    </IconButton>

</TableCell>

              </TableRow>
);
})
}

          </TableBody>

        </Table>
      </TableContainer>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
      >
        <DialogTitle>Add Medicine</DialogTitle>

        <DialogContent>

          <TextField
            label="Medicine Name"
            fullWidth
            margin="normal"
            value={newMedicine.name}
            onChange={(e) =>
              setNewMedicine({
                ...newMedicine,
                name: e.target.value,
              })
            }
          />

          <TextField
            label="Quantity"
            fullWidth
            margin="normal"
            value={newMedicine.quantity}
            onChange={(e) =>
              setNewMedicine({
                ...newMedicine,
                quantity: e.target.value,
              })
            }
          />

         {newMedicine.expiryDates.map((date, index) => (
    <TextField
        key={index}
        type="date"
        fullWidth
        margin="normal"
        label={`Expiry ${index + 1}`}
        InputLabelProps={{ shrink: true }}
        value={date}
        onChange={(e) => {
            const dates = [...newMedicine.expiryDates];
            dates[index] = e.target.value;

            setNewMedicine({
                ...newMedicine,
                expiryDates: dates,
            });
        }}
    />
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
        </DialogContent>

        <DialogActions>

          <Button
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>

          <Button onClick={handleSave}>
    {editIndex !== null ? "Update" : "Save"}
</Button>

        </DialogActions>

      </Dialog>

    </Container>
  );
}

export default Inventory;