const API_BASE_URL = import.meta.env.VITE_API_GATEWAY_URL || "http://localhost:4000";

type RegisterPayload = {
  email: string;
  password: string;
  displayName: string;
  role: "pet-owner" | "veterinarian" | "admin";
};

export async function registerUser(payload: RegisterPayload) {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Registration failed");
  }
  return data.data;
}

export async function loginWithIdToken(idToken: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Login failed");
  }
  return data.data as { uid: string; token: string };
}
