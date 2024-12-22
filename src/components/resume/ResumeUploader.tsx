import React, { useState } from 'react';

export function ResumeUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Simulate file upload
      await new Promise((resolve) => setTimeout(resolve, 2000));
      alert('File uploaded successfully!');
    } catch (err) {
      setError('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900">Upload Your Resume</h3>
      <p className="text-gray-600 mt-2">Upload your resume in PDF format to get personalized feedback.</p>
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        className="mt-4"
      />
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
      <button
        onClick={handleUpload}
        className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        disabled={uploading}
      >
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
    </div>
  );
}
