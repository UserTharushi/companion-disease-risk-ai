import { Globe } from "lucide-react";
import { AppLanguage, t, useLanguageStore } from "../lib/language";
import { cn } from "../lib/utils";

const options: Array<{ value: AppLanguage; label: string }> = [
  { value: "en", label: "English" },
  { value: "si", label: "සිංහල" },
  { value: "ta", label: "தமிழ்" },
];

export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguageStore();

  if (compact) {
    return (
      <div className="inline-flex items-center rounded-lg border border-border bg-surface-secondary p-0.5 dark:border-neutral-700 dark:bg-neutral-800">
        <Globe className="ml-2 h-3.5 w-3.5 text-accent-faint" />
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLanguage(opt.value)}
            aria-pressed={language === opt.value}
            title={t(language, "language")}
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-medium transition-all",
              language === opt.value
                ? "bg-surface text-accent shadow-xs dark:bg-neutral-700 dark:text-white"
                : "text-accent-faint hover:text-accent-muted dark:hover:text-neutral-300",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-accent-faint dark:text-accent-subtle">{t(language, "language")}</p>
      <div className="space-y-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLanguage(opt.value)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-all duration-100",
              language === opt.value
                ? "bg-surface-tertiary text-accent dark:bg-neutral-800 dark:text-white"
                : "text-accent-subtle hover:bg-surface-secondary hover:text-accent-muted dark:hover:bg-primary/50 dark:hover:text-neutral-300",
            )}
          >
            <Globe className="h-[15px] w-[15px]" />
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
