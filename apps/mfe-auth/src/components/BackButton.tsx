import { ArrowLeft } from "lucide-react";
import { t, useLanguageStore } from "../lib/language";
import { useHistoryBack } from "../lib/use-history-back";

/**
 * Header back arrow for the dashboards.
 *
 * An installed PWA has no browser chrome, and on iOS no system back control at
 * all — the left-edge swipe is undiscoverable and fights horizontal scrolling.
 * Render this only when there is somewhere to go back to (see `canGoBack` in
 * useTabRoute); a permanently visible arrow becomes decoration users stop
 * reading, and on the home section it would have nothing to do.
 */
export function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-md p-1.5 text-accent-subtle transition hover:bg-surface-tertiary hover:text-accent dark:hover:bg-primary"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}

/**
 * Back link for the auth flow, matching the arrow-plus-label style the password
 * pages already use.
 *
 * `fallback` is the page this one logically sits under. When there is history
 * to pop it goes back to wherever the user actually came from; when there is
 * not — a refresh, a cold PWA launch, a pasted URL — it goes to the fallback
 * instead. Pages that pass one therefore always show the control.
 *
 * Without a fallback the link hides itself, which is right on a screen with
 * genuinely nowhere to go (sign-in reached from a logout redirect) but reads as
 * a missing button anywhere else. Prefer to pass one.
 */
export function AuthBackLink({ fallback, className = "" }: { fallback?: string; className?: string }) {
  const language = useLanguageStore((state) => state.language);
  const { canGoBack, goBack } = useHistoryBack(fallback);

  if (!canGoBack) return null;

  return (
    <button
      type="button"
      onClick={goBack}
      className={`mb-6 inline-flex items-center gap-1.5 text-sm text-accent-subtle transition hover:text-accent ${className}`}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {t(language, "goBack")}
    </button>
  );
}
