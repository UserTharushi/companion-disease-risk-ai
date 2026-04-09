import { Sun, Moon, Monitor } from "lucide-react";
import { useThemeStore, type Theme } from "../lib/theme";
import { cn } from "../lib/utils";

const options: Array<{ value: Theme; icon: typeof Sun; label: string }> = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
];

export function ThemeSwitcher({ compact }: { compact?: boolean }) {
  const { theme, setTheme } = useThemeStore();

  if (compact) {
    return (
      <div className="inline-flex rounded-lg border border-border bg-surface-secondary p-0.5 dark:border-neutral-700 dark:bg-neutral-800">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            title={opt.label}
            aria-pressed={theme === opt.value}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-all",
              theme === opt.value
                ? "bg-surface text-accent shadow-xs dark:bg-neutral-700 dark:text-white"
                : "text-accent-faint hover:text-accent-muted dark:hover:text-neutral-300",
            )}
          >
            <opt.icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-accent-faint dark:text-accent-subtle px-2">Theme</p>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setTheme(opt.value)}
          aria-pressed={theme === opt.value}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-all duration-100",
            theme === opt.value
              ? "bg-surface-tertiary text-accent dark:bg-neutral-800 dark:text-white"
              : "text-accent-subtle hover:bg-surface-secondary hover:text-accent-muted dark:hover:bg-primary/50 dark:hover:text-neutral-300",
          )}
        >
          <opt.icon className="h-[15px] w-[15px]" />
          {opt.label}
        </button>
      ))}
    </div>
  );
}
