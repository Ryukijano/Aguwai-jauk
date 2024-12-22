import React from 'react';
import { Job } from '../../types/job';
import { JobListItem } from './JobListItem';
import { useLangGraph } from '../../hooks/useLangGraph';

interface JobListProps {
  jobs: Job[];
  onApply: (jobId: string) => void;
}

export function JobList({ jobs, onApply }: JobListProps) {
  const { visualizeJobListings } = useLangGraph();

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No jobs found matching your criteria.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <JobListItem key={job.id} job={job} onApply={onApply} />
      ))}
      <div className="mt-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Job Listings Visualization</h3>
        {visualizeJobListings(jobs)}
      </div>
    </div>
  );
}
