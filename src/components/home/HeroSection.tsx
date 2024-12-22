import React, { useState } from 'react';
import { SearchInput } from '../search/SearchInput';
import { JobFilters } from '../../types/job';
import { APP_NAME } from '../../config/constants';
import { useGeolocation } from '../../hooks/useGeolocation';
import { Chatbot } from '../chatbot/Chatbot'; // Import the Chatbot component

interface HeroSectionProps {
  onSearch: (filters: Partial<JobFilters>) => void;
}

export function HeroSection({ onSearch }: HeroSectionProps) {
  const { isInAssam, error } = useGeolocation();
  const [isChatbotOpen, setIsChatbotOpen] = useState(false); // State to manage chatbot visibility

  const toggleChatbot = () => {
    setIsChatbotOpen(!isChatbotOpen);
  };

  return (
    <div className="relative bg-indigo-700 py-20 px-4 sm:px-6 lg:px-8">
      <div className="relative max-w-4xl mx-auto">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-white sm:text-5xl sm:tracking-tight lg:text-6xl">
            {APP_NAME.ASSAMESE}
          </h1>
          <p className="mt-2 text-xl text-indigo-100">
            {APP_NAME.ENGLISH} - {APP_NAME.TAGLINE}
          </p>
          <p className="mt-6 text-xl text-indigo-100 max-w-2xl mx-auto">
            Connect with top educational institutions across Assam and discover opportunities that match your expertise.
          </p>
        </div>
        
        <div className="mt-10">
          <SearchInput onSearch={onSearch} />
          {isInAssam === false && (
            <p className="mt-4 text-sm text-white bg-indigo-800 p-3 rounded-md">
              This service is only available within Assam. Please ensure you're located in Assam to view job listings.
            </p>
          )}
          {error && (
            <p className="mt-4 text-sm text-white bg-indigo-800 p-3 rounded-md">
              {error}
            </p>
          )}
        </div>

        <div className="mt-8 flex justify-center space-x-6 text-sm text-indigo-100">
          <div>
            <span className="font-semibold text-white">1000+</span> Active Jobs
          </div>
          <div>
            <span className="font-semibold text-white">500+</span> Schools
          </div>
          <div>
            <span className="font-semibold text-white">10,000+</span> Teachers
          </div>
        </div>

        <div className="fixed bottom-4 right-4">
          <button
            onClick={toggleChatbot}
            className="bg-indigo-600 text-white p-3 rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
          >
            Chat with us
          </button>
          {isChatbotOpen && <Chatbot />}
        </div>
      </div>
    </div>
  );
}
