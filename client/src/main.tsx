

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import DashboardSafe from '@/pages/DashboardSafe';
import './index.css';

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

// Simple test component
const TestApp = () => {
  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#f0f0f0', 
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ color: '#333' }}>Teacher Job Portal - Loading...</h1>
      <p>React is working correctly!</p>
    </div>
  );
};

// Render the app
const rootElement = document.getElementById('root');
if (rootElement) {
  console.log('Root element found, rendering app...');
  
  try {
    createRoot(rootElement).render(<TestApp />);
    console.log('App rendered successfully');
  } catch (error) {
    console.error('Error rendering app:', error);
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h1>Error Loading Application</h1>
        <pre>${error}</pre>
      </div>
    `;
  }
} else {
  console.error('Root element not found');
}