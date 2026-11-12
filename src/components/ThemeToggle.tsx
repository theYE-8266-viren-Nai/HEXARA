import { Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/theme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const Icon = theme === "dark" ? Sun : Moon;
  const nextMode = theme === "dark" ? "light" : "dark";
  return <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${nextMode} mode`} title={`Switch to ${nextMode} mode`}><Icon size={16} strokeWidth={1.6} aria-hidden="true" /><span>{nextMode === "light" ? "Light mode" : "Dark mode"}</span></button>;
}
