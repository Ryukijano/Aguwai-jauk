import { createRoot } from "react-dom/client";
import AppSafe from "./App-Safe";
import "./index.css";

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => console.log('SW registered:', registration))
      .catch(error => console.log('SW registration failed:', error));
  });
}

// Simple render without extra wrappers
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<AppSafe />);
}
