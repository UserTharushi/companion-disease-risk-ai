import type { NavigateFunction } from "react-router-dom";
import { getVerifiedRole, getSelectedRole } from "./session";

export function redirectToPets(navigate: NavigateFunction) {
  const role = getVerifiedRole() || getSelectedRole();

  if (role === "veterinarian") {
    navigate("/vet-dashboard", { replace: true });
  } else if (role === "admin") {
    navigate("/admin-dashboard", { replace: true });
  } else {
    navigate("/pets", { replace: true });
  }
}
