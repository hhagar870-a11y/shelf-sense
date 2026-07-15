import {
    
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
Paper,
Chip,
} from "@mui/material";


import Sidebar from "../components/Sidebar";
import Button from "@mui/material/Button";


function Dashboard() {
    const medicines = JSON.parse(
  localStorage.getItem("medicines") || "[]"
);

const totalMedicines = medicines.length;

const today = new Date();

const expired = medicines.filter((item) => {
  return new Date(item.expiry) < today;
}).length;

const nearExpiry = medicines.filter((item) => {
  const expiry = new Date(item.expiry);
  const diff =
    (expiry - today) / (1000 * 60 * 60 * 24);

  return diff >= 0 && diff <= 30;
}).length;

  return (

    <Box sx={{ display: "flex" }}>

      <Sidebar />

      <Box
        sx={{
          flexGrow: 1,
          p: 4,
          bgcolor: "#F8FAFC",
          minHeight: "100vh",
        }}
      >

        <Typography
          variant="h4"
          fontWeight="bold"
          gutterBottom
        >
          Dashboard
        </Typography>

        <Typography
          color="text.secondary"
          sx={{ mb: 4 }}
        >
          Welcome back 👋
        </Typography>

        <Grid container spacing={3}>

          <Grid item xs={12} md={4}>

            <Card
              sx={{
                borderRadius: 4,
                boxShadow: 3,
              }}
            >

              <CardContent>

                <Typography color="text.secondary">
                  Total Medicines
                </Typography>

                <Typography
                  variant="h3"
                  fontWeight="bold"
                >
                  {totalMedicines}
                </Typography>

              </CardContent>

            </Card>

          </Grid>

          <Grid item xs={12} md={4}>

            <Card
              sx={{
                borderRadius:4,
                boxShadow:3,
              }}
            >

              <CardContent>

                <Typography color="text.secondary">
                  Near Expiry
                </Typography>

                <Typography
                  variant="h3"
                  fontWeight="bold"
                  color="warning.main"
                >
                  {nearExpiry}
                </Typography>

              </CardContent>

            </Card>

          </Grid>

          <Grid item xs={12} md={4}>

            <Card
              sx={{
                borderRadius:4,
                boxShadow:3,
              }}
            >

              <CardContent>

                <Typography color="text.secondary">
                  Expired
                </Typography>

                <Typography
                  variant="h3"
                  fontWeight="bold"
                  color="error.main"
                >
                  {expired}
                </Typography>

              </CardContent>

            </Card>

          </Grid>

        </Grid>
        <Box sx={{ mt: 5 }}>

  <Typography
    variant="h5"
    fontWeight="bold"
    gutterBottom
  >
    Recent Medicines
  </Typography>

  <TableContainer
    component={Paper}
    sx={{
      borderRadius:4,
      boxShadow:3,
    }}
  >

    <Table>

      <TableHead>

        <TableRow>

          <TableCell><b>Name</b></TableCell>

          <TableCell><b>Batch</b></TableCell>

          <TableCell><b>Expiry</b></TableCell>

          <TableCell><b>Quantity</b></TableCell>

          <TableCell><b>Shelf</b></TableCell>

          <TableCell><b>Status</b></TableCell>

        </TableRow>

      </TableHead>

      <TableBody>

        {medicines.slice(-5).reverse().map((item,index)=>(

          <TableRow key={index}>

            <TableCell>{item.name}</TableCell>

            <TableCell>{item.batch}</TableCell>

            <TableCell>{item.expiry}</TableCell>

            <TableCell>{item.quantity}</TableCell>

            <TableCell>{item.shelf}</TableCell>

            <TableCell>

  {(() => {

    const expiry = new Date(item.expiry);

    const today = new Date();

    const diff =
      (expiry - today) / (1000 * 60 * 60 * 24);

    if (diff < 0)
      return (
        <Chip
          label="Expired"
          color="error"
          size="small"
        />
      );

    if (diff <= 30)
      return (
        <Chip
          label="Near Expiry"
          color="warning"
          size="small"
        />
      );

    return (
      <Chip
        label="Safe"
        color="success"
        size="small"
      />
    );

  })()}

</TableCell>

          </TableRow>

        ))}

      </TableBody>

    </Table>

  </TableContainer>

</Box>

      </Box>

    </Box>

  );

}

export default Dashboard;