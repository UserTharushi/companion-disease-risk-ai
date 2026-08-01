import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useHistoryBack } from "./use-history-back";

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

  // Popping is shared with the auth pages so both use one definition of "back";
  // the dashboard root is the fallback when there is no history to pop.
  const { goBack } = useHistoryBack(basePath);

  /** True when there is somewhere sensible to go back to. */
  const canGoBack = !onBasePath || activeTab !== defaultTab;

  return { selectTab, canGoBack, goBack };
}
