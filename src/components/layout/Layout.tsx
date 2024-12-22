import React from 'react';
import Header from './Header';
import { ChatbotButton } from './ChatbotButton';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
      <ChatbotButton />
    </div>
  );
}
