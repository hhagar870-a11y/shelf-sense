// src/utils/brandTokens.js
//
// Colors, radii and type scale lifted directly from Dashboard.jsx so every
// new screen looks native to the product instead of introducing a second
// visual language. If the Dashboard palette changes, update it here once.

export const colors = {
  primary: "#1976D2",
  primaryBg: "#EAF4FF",
  success: "#00A86B",
  successBg: "#EAF9F2",
  warning: "#F59E0B",
  warningBg: "#FFF7E6",
  error: "#E63946",
  errorBg: "#FFF0F1",
  textDark: "#172B4D",
  textMuted: "#475467",
  textFaint: "#98A2B3",
  border: "#EAECF0",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FAFC",
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
};

export const shadow = {
  card: "0 1px 3px rgba(16, 24, 40, 0.06), 0 1px 2px rgba(16, 24, 40, 0.04)",
  float: "0 8px 24px rgba(16, 24, 40, 0.16)",
};

// Icon-in-tinted-box treatment used throughout Dashboard's stat cards
export function iconBadgeSx(color, bg) {
  return {
    width: 32,
    height: 32,
    borderRadius: `${radii.sm}px`,
    bgcolor: bg,
    color,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };
}