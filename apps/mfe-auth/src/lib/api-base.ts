/**
 * Where the API gateway is, as seen from the device running the browser.
 *
 * Every request used to go to a hardcoded http://localhost:4000. That is right
 * on the development machine and wrong on every other device: opening the app
 * on a phone makes "localhost" mean the phone, which has no gateway, so every
 * call failed instantly ("Load failed" on iOS, "Failed to fetch" elsewhere).
 *
 * The gateway is always served from the same host as the app, just on a
 * different port, so the host is taken from the address the page was actually
 * loaded from:
 *
 *   laptop   http://localhost:3001      -> http://localhost:4000
 *   phone    http://192.168.1.11:3001   -> http://192.168.1.11:4000
 *
 * A deployment can still override this by setting VITE_API_GATEWAY_URL to a
 * real address; only localhost values are ignored, since those are the ones
 * that cannot be right anywhere but the development machine.
 */
const GATEWAY_PORT = "4000";

function isLocalhost(value: string): boolean {
  return /(^|\/\/)(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(value);
}

export const API_BASE_URL: string = (() => {
  const configured = (import.meta.env.VITE_API_GATEWAY_URL as string | undefined)?.trim();

  // A real deployment address wins.
  if (configured && !isLocalhost(configured)) return configured.replace(/\/+$/, "");

  // Server-side rendering or tests: nothing to derive from.
  if (typeof window === "undefined") return `http://localhost:${GATEWAY_PORT}`;

  return `${window.location.protocol}//${window.location.hostname}:${GATEWAY_PORT}`;
})();
