import { ArrowLeft } from "lucide-react";

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
