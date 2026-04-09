import { format, differenceInCalendarDays, addDays } from "date-fns";
import type { RiskLevel, RiskPrediction } from "@companion-ai/shared-types";

// ── Risk Level Helpers ────────────────────────
export const RISK_COLORS: Record<RiskLevel, string> = {
  low:    "#22c55e",
  medium: "#f59e0b",
  high:   "#ef4444",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low:    "Low Risk",
  medium: "Medium Risk",
  high:   "High Risk — Urgent",
};

export const RISK_URGENCY_HOURS: Record<RiskLevel, number | null> = {
  low:    null,
  medium: 48,
  high:   24,
};

export function getRiskBadgeClass(risk: RiskLevel): string {
  switch (risk) {
    case "low":    return "risk-badge-low";
    case "medium": return "risk-badge-medium";
    case "high":   return "risk-badge-high";
  }
}

// ── Date Helpers ──────────────────────────────
export function formatDate(date: string | Date): string {
  return format(new Date(date), "dd MMM yyyy");
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "dd MMM yyyy, HH:mm");
}

export function daysUntil(date: string | Date): number {
  return differenceInCalendarDays(new Date(date), new Date());
}

export function addDaysToDate(date: string | Date, days: number): Date {
  return addDays(new Date(date), days);
}

export function isOverdue(date: string | Date): boolean {
  return daysUntil(date) < 0;
}

// ── Prediction Helpers ────────────────────────
export function getTopDisease(prediction: RiskPrediction): string {
  if (!prediction.predictedDiseases.length) return "Unknown";
  return [...prediction.predictedDiseases]
    .sort((a, b) => b.probability - a.probability)[0].disease;
}

export function formatConfidence(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

// ── Validation Helpers ────────────────────────
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isStrongPassword(password: string): boolean {
  return password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
}

// ── String Helpers ────────────────────────────
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function truncate(str: string, maxLength: number): string {
  return str.length > maxLength ? str.slice(0, maxLength) + "…" : str;
}

// ── Pet Age ───────────────────────────────────
export function humanPetAge(ageYears: number): string {
  if (ageYears < 1) return "< 1 year";
  return ageYears === 1 ? "1 year" : `${ageYears} years`;
}
