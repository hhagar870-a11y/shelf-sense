// src/components/ProtectedRoute.jsx
//
// Wraps protected routes in App.jsx. If the shared password hasn't been
// entered yet, redirects to /login instead of rendering the page - this is
// what makes a shared link land on the login screen rather than going
// straight into the dashboard.
//
// Usage in App.jsx (react-router v6 nested-route pattern):
//
//   import ProtectedRoute from "./components/ProtectedRoute";
//
//   <Routes>
//     <Route path="/login" element={<Home />} />
//
//     <Route element={<ProtectedRoute />}>
//       <Route path="/dashboard" element={<Dashboard />} />
//       <Route path="/inventory" element={<Inventory />} />
//       <Route path="/alerts" element={<AlertsCenter />} />
//       {/* ...every other page that should require login... */}
//     </Route>
//   </Routes>
//
// Every <Route> nested inside the <Route element={<ProtectedRoute />}>
// block is automatically gated - no need to touch each page individually.

import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { isAuthenticated } from "../utils/auth";

export default function ProtectedRoute() {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}