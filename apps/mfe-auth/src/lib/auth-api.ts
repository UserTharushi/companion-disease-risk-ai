const API_BASE_URL = import.meta.env.VITE_API_GATEWAY_URL || "http://localhost:4000";

type RegisterPayload = {
  email: string;
  password: string;
  displayName: string;
  phoneNumber?: string;
  role: "pet-owner" | "veterinarian" | "admin";
  mustChangePassword?: boolean;
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
  mustChangePassword?: boolean;
};

export type AuthProfile = {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  phoneNumber?: string;
  address?: string;
  photoURL?: string;
  dateOfBirth?: string;
  specialization?: string;
  bio?: string;
};

export type UpdateAuthProfilePayload = {
  displayName?: string;
  phoneNumber?: string;
  address?: string;
  photoURL?: string;
  dateOfBirth?: string;
  specialization?: string;
  bio?: string;
  preferredLanguage?: "en" | "si" | "ta";
};

export type ResetPasswordPayload = {
  token: string;
  password: string;
};

export type ForgotPasswordPayload = {
  email: string;
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
  // Admin-provisioned accounts (veterinarians) require the admin's token
  const { getAccessToken } = await import("./session");
  const callerToken = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(callerToken ? { Authorization: `Bearer ${callerToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Request failed");
  }
  return data.data as AuthResponse;
}

export async function changePassword(token: string, currentPassword: string, newPassword: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Password change failed");
  }
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

export async function getMyProfile(token: string): Promise<AuthProfile> {
  const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Failed to fetch profile");
  }
  return data.data as AuthProfile;
}

export async function updateMyProfile(token: string, payload: UpdateAuthProfilePayload): Promise<AuthProfile> {
  const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Failed to update profile");
  }
  return data.data as AuthProfile;
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Failed to reset password");
  }
}

export async function forgotPassword(payload: ForgotPasswordPayload): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Failed to request password reset");
  }
}
