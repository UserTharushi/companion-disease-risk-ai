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

  // Token exists but role is not in allowed list
  if (!userRole || !allowedRoles.includes(userRole)) {
    console.warn(`Access denied. User role "${userRole}" not in allowed roles: ${allowedRoles.join(", ")}`);
    
    // Redirect to appropriate dashboard based on actual role
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
