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
 * Renders nothing when there is no history to pop — arriving at sign-in from a
 * logout redirect or a cold launch leaves nowhere to go, and a control that
 * sometimes does nothing teaches people to stop trusting it.
 */
export function AuthBackLink({ className = "" }: { className?: string }) {
  const language = useLanguageStore((state) => state.language);
  const { canGoBack, goBack } = useHistoryBack();

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
