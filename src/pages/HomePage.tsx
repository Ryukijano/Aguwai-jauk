import React from 'react';
import { HeroSection } from '../components/home/HeroSection';
import { FeaturesSection } from '../components/home/FeaturesSection';
import { StatsSection } from '../components/home/StatsSection';
import { JobList } from '../components/jobs/JobList';
import { useJobSearch } from '../hooks/useJobSearch';

export default function HomePage() {
  const { jobs, isLoading, searchJobs } = useJobSearch();

  const handleApply = (jobId: string) => {
    // TODO: Implement application logic
    console.log('Applying for job:', jobId);
  };

  return (
    <div className="space-y-12">
      <HeroSection onSearch={searchJobs} />
      <FeaturesSection />
      <StatsSection />
      <section className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Latest Teaching Opportunities</h2>
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading jobs...</p>
          </div>
        ) : (
          <JobList jobs={jobs} onApply={handleApply} />
        )}
      </section>
    </div>
  );
}