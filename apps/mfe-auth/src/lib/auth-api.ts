const API_BASE_URL = import.meta.env.VITE_API_GATEWAY_URL || "http://localhost:4000";

type RegisterPayload = {
  email: string;
  password: string;
  displayName: string;
  phoneNumber?: string;
  role: "pet-owner" | "veterinarian" | "admin";
};

type LoginPayload = {
  email: string;
  password: string;
};

type AuthResponse = {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  token: string;
};

async function authFetch<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/auth${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Request failed");
  }
  return data.data as T;
}

export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  return authFetch<AuthResponse>("/register", payload);
}

export async function loginUser(payload: LoginPayload): Promise<AuthResponse> {
  return authFetch<AuthResponse>("/login", payload);
}

export async function verifyToken(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Token verification failed");
  }
  return data.data;
}
