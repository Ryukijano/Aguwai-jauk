import { useAuth } from "./auth-provider";
import { Route, Redirect } from "wouter";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType;
}

export function ProtectedRoute({ path, component: Component }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  console.log("ProtectedRoute:", { path, isLoading, user });

  return (
    <Route path={path}>
      {() => {
        console.log("Rendering ProtectedRoute:", { path, isLoading, user });

        if (isLoading) {
          return (
            <div className="min-h-screen flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          );
        }

        if (!user) {
          console.log("User not authenticated, redirecting to login");
          return <Redirect to="/login" />;
        }

        console.log("User authenticated, rendering component");
        return <Component />;
      }}
    </Route>
  );
}