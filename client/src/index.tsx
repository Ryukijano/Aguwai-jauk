import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";

// Import the safe dashboard directly
import DashboardSafe from "./pages/DashboardSafe";
import MainLayout from "./components/layout/MainLayout";
import { Toaster } from "./components/ui/toaster";

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: Infinity,
    },
  },
});

// Simple App component without routing for now
function SimpleApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardSafe />
      <Toaster />
    </QueryClientProvider>
  );
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => console.log('SW registered:', registration))
      .catch(error => console.log('SW registration failed:', error));
  });
}

// Render the app
const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <SimpleApp />
    </React.StrictMode>
  );
}