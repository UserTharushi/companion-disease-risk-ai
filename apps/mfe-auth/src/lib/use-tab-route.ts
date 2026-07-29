import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Keeps a dashboard's active section in the URL as `?tab=<id>`.
 *
 * Sections used to be plain React state, so switching them never created a
 * history entry. In an installed PWA that is actively harmful: Android's system
 * back button and iOS's edge-swipe skip straight past every section and drop
 * the user out of the dashboard entirely, back to the splash screen. Putting
 * the section in the URL makes the platform back gesture walk sections the way
 * users expect, and as a side effect makes sections deep-linkable and
 * refresh-safe.
 *
 * The URL is the single source of truth: `selectTab` writes to it and the
 * effect reads back from it. Keeping the flow one-way means the two cannot
 * fight each other into a navigation loop.
 */
export function useTabRoute<T extends string>(params: {
  /** Dashboard root, e.g. "/pets". The default tab lives here with no query. */
  basePath: string;
  tabs: readonly T[];
  defaultTab: T;
  activeTab: T;
  setActiveTab: (tab: T) => void;
}) {
  const { basePath, tabs, defaultTab, activeTab, setActiveTab } = params;
  const navigate = useNavigate();
  const location = useLocation();

  const onBasePath = location.pathname === basePath;
  const requestedTab = new URLSearchParams(location.search).get("tab");

  useEffect(() => {
    // Sub-routes (pet details, clinic details, …) render over the dashboard and
    // carry no ?tab of their own — leave the section behind them untouched so
    // returning from one lands back where the user started.
    if (!onBasePath) return;
    const next = tabs.includes(requestedTab as T) ? (requestedTab as T) : defaultTab;
    if (next !== activeTab) setActiveTab(next);
    // activeTab/setActiveTab deliberately excluded: this effect follows the URL,
    // it must not re-run when the state it just set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onBasePath, requestedTab]);

  const selectTab = useCallback(
    (tab: T) => {
      // Re-tapping the current tab must not stack duplicate history entries,
      // or back appears to do nothing for as many taps as the user made.
      if (tab === activeTab && onBasePath) return;
      navigate(tab === defaultTab ? basePath : `${basePath}?tab=${encodeURIComponent(tab)}`);
    },
    [activeTab, onBasePath, navigate, basePath, defaultTab]
  );

  /** True when there is somewhere sensible to go back to. */
  const canGoBack = !onBasePath || activeTab !== defaultTab;

  const goBack = useCallback(() => {
    // A deep link or a cold PWA launch has nothing to pop; popping anyway would
    // close the app, which is exactly the behaviour the back arrow exists to
    // prevent. Fall back to the dashboard root instead.
    const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (historyIndex > 0) navigate(-1);
    else navigate(basePath, { replace: true });
  }, [navigate, basePath]);

  return { selectTab, canGoBack, goBack };
}
