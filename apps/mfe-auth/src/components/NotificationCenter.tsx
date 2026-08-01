import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, Check, Syringe, CalendarClock, Info } from "lucide-react";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "../lib/notification-api";
import { t, useLanguageStore } from "../lib/language";

const POLL_INTERVAL_MS = 60_000;

function typeIcon(type: string) {
  if (type.includes("risk")) return <AlertTriangle className="h-4 w-4 text-danger-fg" />;
  if (type.includes("vacc")) return <Syringe className="h-4 w-4 text-info" />;
  if (type.includes("appointment")) return <CalendarClock className="h-4 w-4 text-primary" />;
  return <Info className="h-4 w-4 text-accent-subtle" />;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function NotificationCenter() {
  const language = useLanguageStore((state) => state.language);
  const tr = (key: string) => t(language, key);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  async function refresh() {
    try {
      const { items: notifications, unreadCount: unread } = await listNotifications(false, 30);
      setItems(notifications);
      setUnreadCount(unread);
    } catch {
      // notification service unreachable — keep last state
    }
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function onItemClick(notification: AppNotification) {
    if (!notification.read) {
      setItems((prev) => prev.map((item) => (item.id === notification.id ? { ...item, read: true } : item)));
      setUnreadCount((count) => Math.max(0, count - 1));
      markNotificationRead(notification.id).catch(() => undefined);
    }
  }

  async function onMarkAll() {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    markAllNotificationsRead().catch(() => undefined);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-accent transition hover:border-primary dark:border-neutral-700 dark:bg-neutral-900"
        aria-label={tr("notificationsLabel")}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-fg px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-surface shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5 dark:border-neutral-800">
            <p className="text-sm font-semibold text-accent">
              {language === "si" ? "දැනුම්දීම්" : language === "ta" ? "அறிவிப்புகள்" : "Notifications"}
            </p>
            {unreadCount > 0 && (
              <button onClick={onMarkAll} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <Check className="h-3 w-3" />
                {language === "si" ? "සියල්ල කියවූ ලෙස" : language === "ta" ? "அனைத்தும் படித்தது" : "Mark all read"}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-accent-subtle">
                {language === "si" ? "දැනුම්දීම් නොමැත" : language === "ta" ? "அறிவிப்புகள் இல்லை" : "No notifications yet"}
              </p>
            ) : (
              items.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => onItemClick(notification)}
                  className={`flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition hover:bg-surface-secondary dark:border-neutral-800 dark:hover:bg-neutral-800 ${notification.read ? "opacity-70" : ""}`}
                >
                  <span className="mt-0.5 shrink-0">{typeIcon(notification.type)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={`truncate text-[13px] ${notification.read ? "font-normal text-accent-muted" : "font-semibold text-accent"}`}>{notification.title}</span>
                      <span className="shrink-0 text-[11px] text-accent-faint">{relativeTime(notification.createdAt)}</span>
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-relaxed text-accent-subtle">{notification.body}</span>
                  </span>
                  {!notification.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
