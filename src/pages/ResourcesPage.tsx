import React from 'react';
import { ResumeUploader } from '../components/resume/ResumeUploader';
import { ResumeFeedback } from '../components/resume/ResumeFeedback';

export default function ResourcesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Teaching Resources</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Interview Preparation</h3>
          <p className="text-gray-600 mt-2">Tips and guides for teaching interviews</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Resume Templates</h3>
          <p className="text-gray-600 mt-2">Professional resume templates for teachers</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Teaching Certifications</h3>
          <p className="text-gray-600 mt-2">Information about required certifications</p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Upload Your Resume for Feedback</h2>
        <ResumeUploader />
        <ResumeFeedback />
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Upload Your Resume for Feedback in Assamese</h2>
        <ResumeUploader />
        <ResumeFeedback />
      </div>
    </div>
  );
}
