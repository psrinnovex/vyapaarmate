import { useColorScheme } from "react-native";

/**
 * Clay & glass palette shared with the VyapaarMate website: lavender canvas, ink text,
 * emerald actions, violet accents and mango / berry highlights.
 */
const light = {
  background: "#F4F1FC",
  surface: "#FFFFFF",
  surfaceMuted: "#F1EDFC",
  text: "#1D1A39",
  textMuted: "#6B6788",
  border: "#E6E1F5",
  primary: "#12B76A",
  primaryPressed: "#0E9F5C",
  primaryLip: "#087A45",
  onPrimary: "#FFFFFF",
  accent: "#7C5CFF",
  accentSurface: "#EEE9FF",
  contrast: "#1D1A39",
  contrastLip: "#0D0A22",
  onContrast: "#FFFFFF",
  mango: "#FFAD1F",
  mangoSurface: "#FFF4D9",
  berry: "#FF5C8A",
  ocean: "#4F5BD5",
  danger: "#D93A68",
  dangerSurface: "#FFE8EF",
  success: "#0B8A50",
  successSurface: "#DDF7EA",
  warning: "#B86A00",
  warningSurface: "#FFF4D9",
  blobA: "#D9CEFF",
  blobB: "#C2F0D9",
  clayShadow: "0px 18px 30px -16px rgba(55, 41, 130, 0.32), 0px 6px 12px -8px rgba(55, 41, 130, 0.16), inset 0px -5px 12px rgba(84, 64, 168, 0.07), inset 0px 3px 6px rgba(255, 255, 255, 0.95)",
  clayShadowSmall: "0px 10px 18px -12px rgba(55, 41, 130, 0.3), inset 0px -3px 8px rgba(84, 64, 168, 0.06)",
  insetShadow: "inset 0px 3px 8px rgba(55, 41, 130, 0.1)",
};

const dark: typeof light = {
  background: "#0F0D22",
  surface: "#1D1A39",
  surfaceMuted: "#27234A",
  text: "#F4F1FC",
  textMuted: "#A9A4C9",
  border: "#322D5C",
  primary: "#3DD68C",
  primaryPressed: "#2BBF78",
  primaryLip: "#178A55",
  onPrimary: "#0B1F15",
  accent: "#A48BFF",
  accentSurface: "#2E2860",
  contrast: "#F4F1FC",
  contrastLip: "#A9A4C9",
  onContrast: "#1D1A39",
  mango: "#FFC04D",
  mangoSurface: "#3A2E12",
  berry: "#FF7FA5",
  ocean: "#8E96FF",
  danger: "#FF7FA5",
  dangerSurface: "#43172A",
  success: "#69D49A",
  successSurface: "#143528",
  warning: "#FFC06A",
  warningSurface: "#3A2E12",
  blobA: "#2E2470",
  blobB: "#123D2C",
  clayShadow: "0px 18px 30px -16px rgba(0, 0, 0, 0.6), inset 0px -5px 12px rgba(0, 0, 0, 0.22), inset 0px 2px 4px rgba(255, 255, 255, 0.06)",
  clayShadowSmall: "0px 10px 18px -12px rgba(0, 0, 0, 0.55), inset 0px 2px 4px rgba(255, 255, 255, 0.05)",
  insetShadow: "inset 0px 3px 8px rgba(0, 0, 0, 0.35)",
};

export function useAppTheme() {
  const darkMode = useColorScheme() === "dark";
  return { colors: darkMode ? dark : light, dark: darkMode };
}

export type AppColors = typeof light;
