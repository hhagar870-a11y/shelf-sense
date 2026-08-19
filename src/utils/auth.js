// src/utils/auth.js
//
// Simple shared-password gate for the whole team - no individual accounts.
// The password lives in an environment variable (VITE_SITE_PASSWORD) so it
// can be changed without touching code, and isn't hardcoded in the bundle
// source as plain text in this file.
//
// Important limitation: this is a client-side gate, not real security -
// anyone who opens the browser devtools can read the compiled password or
// flip the localStorage flag by hand. It stops casual/accidental access via
// a shared link, which is what was asked for. It does not protect the
// Firestore data itself - that's governed separately by Firestore security
// rules, which should still require an authenticated Firebase user for any
// real protection of the data.

const AUTH_KEY = "shelfSenseAuthenticated";

// Shared team credentials - override by setting these in a real .env file
// (see .env.example) instead of editing this file, especially before
// deploying anywhere public.
const SITE_USERNAME = import.meta.env.VITE_SITE_USERNAME || "KSHPharmacy";
const SITE_PASSWORD = import.meta.env.VITE_SITE_PASSWORD || "Aa123456@@";

export function isAuthenticated() {
  return localStorage.getItem(AUTH_KEY) === "true";
}

export function login(username, password) {
  if (username === SITE_USERNAME && password === SITE_PASSWORD) {
    localStorage.setItem(AUTH_KEY, "true");
    return true;
  }
  return false;
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
}