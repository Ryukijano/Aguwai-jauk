

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AIPageContextProvider } from './contexts/AIPageContext';

// Simple rendering without service worker or complex state management
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <AIPageContextProvider>
    <App />
  </AIPageContextProvider>
);