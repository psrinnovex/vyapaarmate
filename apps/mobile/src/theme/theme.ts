import { useColorScheme } from "react-native";

/**
 * VyapaarMate "Marigold Bazaar" palette, shared with the website and the design system.
 * Built on the logo: black #0B0D0B, logo green #1EC926 (always with black text) and white,
 * on a warm ivory canvas. Marigold is for offers and price tags, peacock for information
 * and kumkum for errors. Dark mode ("Bazaar night") uses the logo black as its canvas.
 */
const light = {
  background: "#FAF7F0",
  surface: "#FFFFFF",
  surfaceMuted: "#F3EEE2",
  text: "#0B0D0B",
  textMuted: "#625F57",
  border: "#E6DFCF",
  primary: "#1EC926",
  primaryPressed: "#19B821",
  primaryLip: "#0B7A10",
  onPrimary: "#0B0D0B",
  accent: "#0E7C86",
  accentSurface: "#D4EEEF",
  contrast: "#0B0D0B",
  contrastLip: "#000000",
  onContrast: "#FFFFFF",
  marigold: "#F2A20C",
  marigoldSurface: "#FDEBC4",
  onMarigold: "#0B0D0B",
  kumkum: "#B3311D",
  danger: "#B3311D",
  dangerSurface: "#FBE1DB",
  success: "#0B7A10",
  successSurface: "#D8F6D2",
  warning: "#8F5400",
  warningSurface: "#FDEBC4",
  blobA: "#D8F6D2",
  blobB: "#FDEBC4",
  clayShadow: "0px 18px 30px -16px rgba(84, 58, 18, 0.34), 0px 6px 12px -8px rgba(84, 58, 18, 0.16), inset 0px -5px 12px rgba(140, 100, 40, 0.07), inset 0px 3px 6px rgba(255, 255, 255, 0.9)",
  clayShadowSmall: "0px 10px 18px -12px rgba(84, 58, 18, 0.3), inset 0px -3px 8px rgba(120, 84, 30, 0.06)",
  insetShadow: "inset 0px 3px 8px rgba(84, 58, 18, 0.1)",
};

const dark: typeof light = {
  background: "#0B0D0B",
  surface: "#161A16",
  surfaceMuted: "#1F241F",
  text: "#F4F1EA",
  textMuted: "#B3ADA1",
  border: "#2C322C",
  primary: "#3FD645",
  primaryPressed: "#1EC926",
  primaryLip: "#0B7A10",
  onPrimary: "#0B0D0B",
  accent: "#5CC7CF",
  accentSurface: "#12383B",
  contrast: "#F4F1EA",
  contrastLip: "#B3ADA1",
  onContrast: "#0B0D0B",
  marigold: "#F5B031",
  marigoldSurface: "#3A2A0A",
  onMarigold: "#0B0D0B",
  kumkum: "#F0735E",
  danger: "#F0735E",
  dangerSurface: "#3D1A14",
  success: "#3FD645",
  successSurface: "#12361A",
  warning: "#F5B031",
  warningSurface: "#3A2A0A",
  blobA: "#12361A",
  blobB: "#3A2A0A",
  clayShadow: "0px 18px 30px -16px rgba(0, 0, 0, 0.65), inset 0px -5px 12px rgba(0, 0, 0, 0.22), inset 0px 2px 4px rgba(255, 255, 255, 0.06)",
  clayShadowSmall: "0px 10px 18px -12px rgba(0, 0, 0, 0.6), inset 0px 2px 4px rgba(255, 255, 255, 0.05)",
  insetShadow: "inset 0px 3px 8px rgba(0, 0, 0, 0.4)",
};

export function useAppTheme() {
  const darkMode = useColorScheme() === "dark";
  return { colors: darkMode ? dark : light, dark: darkMode };
}

export type AppColors = typeof light;
