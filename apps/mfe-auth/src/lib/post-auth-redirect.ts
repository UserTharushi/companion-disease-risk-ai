import type { NavigateFunction } from "react-router-dom";
import { getVerifiedRole, getSelectedRole } from "./session";

export function redirectToPets(_navigate: NavigateFunction) {
  const role = getVerifiedRole() || getSelectedRole();
  
  // Route based on user role
  if (role === "veterinarian") {
    window.location.href = "http://localhost:3001/vet-dashboard";
  } else if (role === "admin") {
    window.location.href = "http://localhost:3001/admin-dashboard";
  } else {
    // Default to pet owner dashboard
    window.location.href = "http://localhost:3001/pets";
  }
}
