import { useColorScheme } from "react-native";

const light = {
  background: "#F3F6EF",
  surface: "#FFFFFF",
  surfaceMuted: "#E8EEE6",
  text: "#10261C",
  textMuted: "#5C6D64",
  border: "#CED9D1",
  primary: "#17643A",
  primaryPressed: "#0F4A2A",
  onPrimary: "#FFFFFF",
  accent: "#E8842B",
  danger: "#B42318",
  dangerSurface: "#FEE4E2",
  success: "#157347",
  warning: "#9A5700",
};

const dark = {
  background: "#07150F",
  surface: "#10261C",
  surfaceMuted: "#193327",
  text: "#F3F6EF",
  textMuted: "#AFC0B6",
  border: "#2F4A3B",
  primary: "#56B878",
  primaryPressed: "#78CC94",
  onPrimary: "#07150F",
  accent: "#F29B3D",
  danger: "#FF8A80",
  dangerSurface: "#4A1E1A",
  success: "#69D49A",
  warning: "#FFC06A",
};

export function useAppTheme() {
  const darkMode = useColorScheme() === "dark";
  return { colors: darkMode ? dark : light, dark: darkMode };
}

export type AppColors = typeof light;
