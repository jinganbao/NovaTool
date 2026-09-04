import { darkTheme } from "naive-ui";
import type { AppConfig } from "@/composables/useConfig";

export const brandColor = "#3DD6C6";

export const themePresets = [
  { name: "NovaMsg", color: "#3DD6C6" },
  { name: "NovaDB", color: "#5BA8FF" },
  { name: "NovaFlow", color: "#A3E635" },
  { name: "NovaOps", color: "#F59E0B" },
  { name: "NovaAI", color: "#8BDAFF" },
];

export const themeModeOptions: { label: string; value: AppConfig["themeMode"] }[] = [
  { label: "暗色", value: "dark" },
  { label: "亮色", value: "light" },
  { label: "跟随系统", value: "auto" },
];

export function getNaiveTheme(mode: "dark" | "light") {
  return mode === "dark" ? darkTheme : null;
}

export function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;
  const num = Number.parseInt(value, 16);
  if (Number.isNaN(num)) return { r: 61, g: 214, b: 198 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function mix(hex: string, target: string, weight: number) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  const channel = (x: number, y: number) => Math.round(x * (1 - weight) + y * weight);
  return `#${[channel(a.r, b.r), channel(a.g, b.g), channel(a.b, b.b)]
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getThemeOverrides(config: AppConfig, resolvedMode: "dark" | "light") {
  const accent = config.themeAccent || brandColor;
  const dark = resolvedMode === "dark";
  return {
    common: {
      primaryColor: accent,
      primaryColorHover: mix(accent, "#FFFFFF", 0.18),
      primaryColorPressed: mix(accent, "#000000", 0.18),
      primaryColorSuppl: accent,
      borderRadius: "6px",
      borderColor: dark ? "#2B323C" : "#D8E0EA",
      bodyColor: dark ? "#111418" : "#F7F9FC",
      cardColor: dark ? "#1B2027" : "#FFFFFF",
      modalColor: dark ? "#1B2027" : "#FFFFFF",
      inputColor: dark ? "#2A3038" : "#F1F5F9",
      textColorBase: dark ? "#E7ECF3" : "#17202A",
      textColor1: dark ? "#E7ECF3" : "#17202A",
      textColor2: dark ? "#9AA5B5" : "#5D6978",
      textColor3: dark ? "#6F7A89" : "#7B8797",
    },
  };
}

export function getThemeVars(config: AppConfig, resolvedMode: "dark" | "light") {
  const accent = config.themeAccent || brandColor;
  const dark = resolvedMode === "dark";
  return {
    "--bg-app": dark ? "#111418" : "#F7F9FC",
    "--bg-sider": dark ? "#15191E" : "#EEF3F7",
    "--bg-panel": dark ? "#1B2027" : "#FFFFFF",
    "--bg-panel-hover": dark ? "#222832" : "#EAF0F7",
    "--bg-hover": dark ? "#222832" : "#EAF0F7",
    "--bg-input": dark ? "#2A3038" : "#F1F5F9",
    "--border-subtle": dark ? "#2B323C" : "#D8E0EA",
    "--border-strong": dark ? "#39424E" : "#BCC8D6",
    "--text-primary": dark ? "#E7ECF3" : "#17202A",
    "--text-secondary": dark ? "#9AA5B5" : "#5D6978",
    "--text-muted": dark ? "#6F7A89" : "#7B8797",
    "--brand": accent,
    "--brand-hover": mix(accent, "#FFFFFF", 0.18),
    "--brand-active": mix(accent, "#000000", 0.18),
    "--brand-soft": rgba(accent, dark ? 0.14 : 0.12),
    "--focus": dark ? "#7DD3FC" : "#0284C7",
    "--danger": dark ? "#F87171" : "#DC2626",
    "--warning": dark ? "#FBBF24" : "#B7791F",
    "--success": dark ? "#4ADE80" : "#15803D",
    "--danger-soft": dark ? "rgba(248, 113, 113, 0.12)" : "rgba(220, 38, 38, 0.08)",
    "--success-soft": dark ? "rgba(74, 222, 128, 0.1)" : "rgba(21, 128, 61, 0.1)",
    "--warning-soft": dark ? "rgba(245, 158, 11, 0.12)" : "rgba(217, 119, 6, 0.1)",
    "--overlay": dark ? "rgba(0, 0, 0, 0.5)" : "rgba(15, 23, 42, 0.15)",
    "--shadow-sm": dark ? "0 1px 2px rgba(0,0,0,0.4)" : "0 1px 2px rgba(15,23,42,0.08)",
    "--shadow-md": dark ? "0 4px 12px rgba(0,0,0,0.45)" : "0 4px 12px rgba(15,23,42,0.12)",
    "--shadow-lg": dark ? "0 12px 32px rgba(0,0,0,0.55)" : "0 12px 32px rgba(15,23,42,0.18)",
    "--shadow-strong": dark ? "rgba(0, 0, 0, 0.6)" : "rgba(15, 23, 42, 0.16)",
    "--swatch-ring": dark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.12)",
    "--brand-gradient": `linear-gradient(135deg, ${accent}, ${mix(accent, "#000000", 0.25)})`,
    "--method-get": dark ? "#20c997" : "#087f5b",
    "--method-post": dark ? "#f59e0b" : "#b45309",
    "--method-put": dark ? "#60a5fa" : "#2563eb",
    "--method-patch": dark ? "#a78bfa" : "#7c3aed",
    "--method-delete": dark ? "#f87171" : "#dc2626",
    "--method-head": dark ? "#94a3b8" : "#64748b",
    "--method-options": dark ? "#22d3ee" : "#0891b2",
  };
}
