import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Deferred init — never runs at module-evaluation time, only on first use
function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

// auth proxy: callers keep `auth.currentUser` etc. but init is lazy
export const auth = new Proxy(
  {} as ReturnType<typeof getAuth>,
  { get(_t, prop) { return (getFirebaseAuth() as never)[prop as never]; } }
);

export const googleProvider = new GoogleAuthProvider();

