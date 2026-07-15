import { Container, Typography, Button, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  return (
    <Container maxWidth="lg">
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        {/* Left Side */}
        <Box sx={{ flex: 1 }}>
          <Typography
            variant="h2"
            fontWeight="bold"
            sx={{ lineHeight: 1.2 }}
          >
            Smarter Inventory,
            <br />
            <span style={{ color: "#16a34a" }}>
              Safer
            </span>{" "}
            Pharmacy.
          </Typography>

          <Typography
            sx={{
              mt: 3,
              color: "#666",
              fontSize: 20,
            }}
          >
            Shelf Sense helps pharmacy teams manage medicines,
            track expiry dates, and reduce waste — all in one place.
          </Typography>

          <Box sx={{ mt: 5, display: "flex", gap: 2 }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate("/dashboard")}
              sx={{
                backgroundColor: "#16a34a",
                px: 4,
                py: 1.5,
                borderRadius: "12px",
                fontWeight: "bold",
                "&:hover": {
                  backgroundColor: "#15803d",
                },
              }}
            >
              Get Started
            </Button>

            <Button
              variant="outlined"
              size="large"
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: "12px",
              }}
            >
              Learn More
            </Button>
          </Box>
        </Box>

        {/* Right Side */}
        <Box sx={{ flex: 1, textAlign: "center" }}>
          <img
            src="/logo.png"
            alt="Shelf Sense"
            style={{
              width: "100%",
              maxWidth: "520px",
            }}
          />
        </Box>
      </Box>
    </Container>
  );
}

export default Home;