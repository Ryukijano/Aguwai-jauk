import { createContext, ReactNode, useContext } from "react";

interface User {
  id: number;
  username: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  login: (credentials: { username: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Removed useState to prevent React hooks error - using class component approach
  
  const showToast = async (toastOptions: any) => {
    // Simple console log instead of toast for now
    console.log("Auth notification:", toastOptions.title, toastOptions.description);
  };

  // Simple state without React hooks for now
  const user = null;
  const isLoading = false;
  const error = null;

  const login = async (credentials: { username: string; password: string }) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials)
      });
      if (response.ok) {
        const userData = await response.json();
        showToast({
          title: "Login successful",
          description: "Welcome back to Aguwai Jauk!",
        });
        // Redirect to dashboard after login
        window.location.href = "/";
        return userData;
      } else {
        throw new Error("Login failed");
      }
    } catch (error: any) {
      showToast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (response.ok) {
        showToast({
          title: "Logged out",
          description: "You have been successfully logged out",
        });
        // Redirect to login after logout
        window.location.href = "/login";
      } else {
        throw new Error("Logout failed");
      }
    } catch (error: any) {
      showToast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
