import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import DashboardSafe from '@/pages/DashboardSafe';
import './index.css';

// Ensure React global is available for HMR
if (typeof window !== 'undefined') {
  window.React = React;
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => console.log('SW registered:', registration))
      .catch(error => console.log('SW registration failed:', error));
  });
}

// Create QueryClient outside of component to avoid re-creation
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: Infinity,
    },
  },
});

// Delay initial render to ensure React is properly loaded
setTimeout(() => {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    createRoot(rootElement).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <DashboardSafe />
          <Toaster />
        </QueryClientProvider>
      </StrictMode>
    );
  }
}, 100);