import React, { useState } from 'react';
import { useResumeFeedback } from '../../hooks/useResumeFeedback';

export function ResumeFeedback() {
  const [feedback, setFeedback] = useState<string | null>(null);
  const { getResumeFeedback } = useResumeFeedback();

  const handleGetFeedback = async (file: File) => {
    const resumeFeedback = await getResumeFeedback(file);
    setFeedback(resumeFeedback);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900">Resume Feedback</h3>
      <p className="text-gray-600 mt-2">Get personalized feedback on your resume using AI.</p>
      <input
        type="file"
        accept=".pdf"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleGetFeedback(e.target.files[0]);
          }
        }}
        className="mt-4"
      />
      {feedback && (
        <div className="mt-4 bg-gray-100 p-4 rounded-md">
          <h4 className="text-md font-semibold text-gray-900">Feedback:</h4>
          <p className="text-gray-600 mt-2">{feedback}</p>
        </div>
      )}
    </div>
  );
}
