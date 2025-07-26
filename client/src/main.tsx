import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// Direct imports - no lazy loading to avoid HMR issues
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import DashboardSafe from '@/pages/DashboardSafe';

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => console.log('SW registered:', registration))
      .catch(error => console.log('SW registration failed:', error));
  });
}

// Create QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: Infinity,
    },
  },
});

// Main App Component
function App() {
  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <DashboardSafe />
        <Toaster />
      </QueryClientProvider>
    </React.StrictMode>
  );
}

// Mount the app
const container = document.getElementById('root');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(<App />);
}