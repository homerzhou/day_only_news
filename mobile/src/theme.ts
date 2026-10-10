import { useColorScheme } from "react-native";

export function useTheme() {
  const dark = useColorScheme() === "dark";
  return {
    dark,
    bg: dark ? "#121417" : "#F3F1EC",
    card: dark ? "#1C1F24" : "#FFFFFF",
    text: dark ? "#F3F1EA" : "#1C1A17",
    muted: dark ? "#A7A59E" : "#6E6A62",
    line: dark ? "#2C3138" : "#E4E0D8",
    accent: dark ? "#C5D4E8" : "#1F3A5F",
    accentInk: dark ? "#121417" : "#FFFFFF",
    chip: dark ? "#2A3140" : "#E7EEF6",
  };
}

const SWATCHES = ["#1F3A5F", "#3E5C4B", "#6B3A3A", "#3F4A5A", "#5C4A32", "#3D4F5F"];

export function swatch(title: string): string {
  let hash = 0;
  for (const char of title) hash = (hash + char.charCodeAt(0)) % SWATCHES.length;
  return SWATCHES[hash];
}
