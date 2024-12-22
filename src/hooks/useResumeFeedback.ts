import { useState } from 'react';
import axios from 'axios';

export function useResumeFeedback() {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const getResumeFeedback = async (file: File) => {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(
        'https://api.gemini.com/v1/resume-feedback',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${import.meta.env.VITE_GEMINI_API_KEY}`
          }
        }
      );

      setFeedback(response.data.feedback);
    } catch (err) {
      setError('Failed to get resume feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return {
    feedback,
    error,
    loading,
    getResumeFeedback
  };
}
