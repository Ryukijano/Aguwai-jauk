import React from 'react';
import { Job } from '../../types/job';
import { JobListItem } from './JobListItem';

interface JobListProps {
  jobs: Job[];
  onApply: (jobId: string) => void;
}

export function JobList({ jobs, onApply }: JobListProps) {
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
    </div>
  );
}