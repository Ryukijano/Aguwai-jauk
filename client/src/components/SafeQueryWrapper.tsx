import { ReactNode, useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

interface SafeQueryWrapperProps {
  children: ReactNode;
}

// This wrapper ensures QueryClient is ready before rendering children
export function SafeQueryWrapper({ children }: SafeQueryWrapperProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Give React time to properly initialize context
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading application...</div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}