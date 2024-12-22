import React, { useState } from 'react';
import { FeatureCard } from './FeatureCard';
import { 
  Search, 
  GraduationCap, 
  Bell, 
  FileCheck, 
  MessageSquare, 
  Brain 
} from 'lucide-react';
import { Chatbot } from '../chatbot/Chatbot'; // Import the Chatbot component

export function FeaturesSection() {
  const [isChatbotOpen, setIsChatbotOpen] = useState(false); // State to manage chatbot visibility

  const toggleChatbot = () => {
    setIsChatbotOpen(!isChatbotOpen);
  };

  const features = [
    {
      icon: Search,
      title: 'Smart Job Matching',
      description: 'Our AI-powered system matches you with teaching positions that perfectly align with your qualifications and preferences.'
    },
    {
      icon: GraduationCap,
      title: 'Verified Institutions',
      description: 'All schools and educational institutions on our platform are thoroughly verified and accredited.'
    },
    {
      icon: Bell,
      title: 'Real-time Alerts',
      description: 'Get instant notifications about new job postings, application updates, and interview schedules.'
    },
    {
      icon: FileCheck,
      title: 'Document Management',
      description: 'Securely store and manage your certificates, credentials, and other important documents.'
    },
    {
      icon: MessageSquare,
      title: 'Interview Preparation',
      description: 'Access resources and AI-powered tools to help you prepare for teaching interviews.'
    },
    {
      icon: Brain,
      title: 'AI Resume Analysis',
      description: 'Get personalized suggestions to optimize your resume and increase your chances of landing interviews.'
    }
  ];

  return (
    <section className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Everything You Need to Succeed
          </h2>
          <p className="mt-4 text-xl text-gray-600">
            Comprehensive tools and features to support your teaching career journey
          </p>
        </div>

        <div className="mt-12 grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <FeatureCard key={index} {...feature} />
          ))}
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
    </section>
  );
}
