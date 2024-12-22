import React from 'react';
import { JobList } from '../components/jobs/JobList';
import { SearchInput } from '../components/search/SearchInput';
import { useJobSearch } from '../hooks/useJobSearch';

export default function JobsPage() {
  const { jobs, isLoading, searchJobs } = useJobSearch();

  const handleApply = (jobId: string) => {
    // TODO: Implement application logic
    console.log('Applying for job:', jobId);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Teaching Jobs in Assam</h1>
      
      <div className="mb-8">
        <SearchInput onSearch={searchJobs} />
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading jobs...</p>
        </div>
      ) : (
        <JobList jobs={jobs} onApply={handleApply} />
      )}
    </div>
  );
}