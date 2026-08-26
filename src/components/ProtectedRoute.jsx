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

import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { isAuthenticated } from "../utils/auth";
import { authReady } from "../firebase";

export default function ProtectedRoute() {
  // ننتظر لحظة اكتمال تسجيل الدخول المجهول (Anonymous Auth) بفايرستور قبل
  // ما نعرض أي صفحة تقرأ/تكتب بيانات - عادة أقل من ثانية، بس بدونها ممكن
  // أول طلب بيانات يوصل السيرفر قبل ما يكون معه تصريح صالح، فيرفضه
  const [firebaseReady, setFirebaseReady] = useState(false);

  useEffect(() => {
    authReady.finally(() => setFirebaseReady(true));
  }, []);

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (!firebaseReady) {
    return null;
  }

  return <Outlet />;
}