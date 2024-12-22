import { useState, useCallback } from 'react';
import { JobFilters, Job } from '../types';
import { searchJobs } from '../lib/api/jobs';
import { useGeolocation } from './useGeolocation';

export function useJobSearch() {
  const [filters, setFilters] = useState<JobFilters>({
    search: '',
    location: '',
    subject: '',
    experienceLevel: '',
    jobType: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const { isInAssam } = useGeolocation();

  const searchJobsInAssam = useCallback(async (newFilters: Partial<JobFilters>) => {
    setIsLoading(true);
    try {
      const updatedFilters = { ...filters, ...newFilters };
      setFilters(updatedFilters);
      
      // Only search if user is in Assam or location couldn't be determined
      if (isInAssam !== false) {
        const results = await searchJobs(updatedFilters);
        setJobs(results);
      } else {
        setJobs([]);
      }
    } catch (error) {
      console.error('Failed to search jobs:', error);
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters, isInAssam]);

  return {
    filters,
    jobs,
    isLoading,
    searchJobs: searchJobsInAssam
  };
}