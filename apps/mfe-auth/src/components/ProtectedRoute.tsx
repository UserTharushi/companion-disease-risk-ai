import { Navigate, useLocation } from "react-router-dom";
import { getVerifiedRole, getAccessToken } from "../lib/session";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

/**
 * ProtectedRoute component that enforces role-based access control.
 * Redirects to splash/login if unauthorized.
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const location = useLocation();
  const token = getAccessToken();
  const userRole = getVerifiedRole();

  // No token = not logged in
  if (!token) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // No verified role — session is stale, send to login
  if (!userRole) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Role doesn't match this route — redirect to correct dashboard
  if (!allowedRoles.includes(userRole)) {
    if (userRole === "veterinarian") {
      return <Navigate to="/vet-dashboard" replace />;
    } else if (userRole === "admin") {
      return <Navigate to="/admin-dashboard" replace />;
    } else {
      return <Navigate to="/pets" replace />;
    }
  }

  // User is authorized
  return <>{children}</>;
}
