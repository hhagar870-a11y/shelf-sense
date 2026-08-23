import { Routes, Route } from "react-router-dom";
import Login from "./pages/public/Login";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import SmartScan from "./pages/SmartScan";
import Sidebar from "./components/Sidebar";
import MawsoolOrders from "./pages/MawsoolOrders";
import LabelPrinting from "./pages/LabelPrinting";
import QRLanding from "./pages/QRLanding";
import Support from "./pages/Support";
import AlertsCenter from "./pages/AlertsCenter";
import ProtectedRoute from "./components/ProtectedRoute";
import ClassificationSearch from "./pages/classificationsearch";

function App() {
  return (
    <>
      <Routes>
        {/* Public - no login required */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        {/* QR landing stays public - it's meant to be opened by whoever
            scans the physical QR code (e.g. a Mawsool driver), not
            someone already signed into the dashboard */}
        <Route path="/qr-landing" element={<QRLanding />} />

        {/* Everything below requires the shared team login */}
        <Route element={<ProtectedRoute />}>
          <Route path="/mawsool-orders" element={<MawsoolOrders />} />

          <Route
            path="/dashboard"
            element={
              <>
                <Sidebar />
                <Dashboard />
              </>
            }
          />

          <Route
            path="/inventory"
            element={
              <>
                <Sidebar />
                <Inventory />
              </>
            }
          />

          <Route
            path="/scan"
            element={
              <>
                <Sidebar />
                <SmartScan />
              </>
            }
          />

          <Route
            path="/labels"
            element={
              <>
                <Sidebar />
                <LabelPrinting />
              </>
            }
          />

          <Route
            path="/support"
            element={
              <>
                <Sidebar />
                <Support />
              </>
            }
          />
<Route path="/classification-search" element={<ClassificationSearch />} />
          <Route
            path="/alerts"
            element={
              <>
                <Sidebar />
                <AlertsCenter />
              </>
            }
          />
        </Route>
      </Routes>
    </>
  );
}

export default App;