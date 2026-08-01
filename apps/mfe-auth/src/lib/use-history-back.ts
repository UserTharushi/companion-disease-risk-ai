import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * History-safe "go back", shared by the auth pages and the dashboards.
 *
 * An installed PWA has no browser chrome, and on iOS no system back control at
 * all, so screens need to offer their own. Two rules make that safe:
 *
 *  - Go back to wherever the user actually came from, not to a fixed page.
 *    Sign-in alone is reachable from the splash, role selection, register, a
 *    logout redirect and a protected-route redirect; any hardcoded destination
 *    would be wrong for most of them.
 *  - Only offer it when there is something to pop. After a logout (which uses
 *    `replace`) or a cold launch straight onto a URL, popping would close the
 *    app — precisely what the control exists to prevent.
 *
 * `fallback` is used when there is no history to pop but a sensible destination
 * exists anyway (the dashboards pass their root). Omit it on the auth pages,
 * where `canGoBack` then reports false and the caller renders nothing.
 */
export function useHistoryBack(fallback?: string) {
  const navigate = useNavigate();

  // react-router stamps an incrementing index onto history.state; anything
  // above zero means there is an entry behind this one within the app.
  const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0;
  const hasHistory = historyIndex > 0;

  const goBack = useCallback(() => {
    if (hasHistory) navigate(-1);
    else if (fallback) navigate(fallback, { replace: true });
  }, [hasHistory, navigate, fallback]);

  return { canGoBack: hasHistory || Boolean(fallback), goBack };
}
