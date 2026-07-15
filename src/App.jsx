import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import SmartScan from "./pages/SmartScan";
function App() {
 return (
 <Routes>
 <Route path="/" element={<Home />} />
 <Route path="/dashboard" element={<Dashboard />} />
 <Route path="/inventory" element={<Inventory />} />
 <Route path="/scan" element={<SmartScan />} />
 </Routes>
 );
}
export default App;