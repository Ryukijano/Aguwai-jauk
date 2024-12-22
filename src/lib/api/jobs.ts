import { supabase } from '../supabase/client';
import { Job, JobFilters } from '../../types';
import { isWithinAssam } from '../utils/geo';
import { processNaturalLanguageQuery } from '../utils/langChain'; // Import LangChain utility

export async function searchJobs(filters: Partial<JobFilters>): Promise<Job[]> {
  let query = supabase
    .from('jobs')
    .select(`
      *,
      school:schools(*)
    `)
    .order('posted_date', { ascending: false });

  // Apply filters
  if (filters.search) {
    const processedSearch = await processNaturalLanguageQuery(filters.search); // Process natural language query
    query = query.ilike('title', `%${processedSearch}%`);
  }
  
  if (filters.location) {
    query = query.contains('location', { district: filters.location });
  }
  
  if (filters.subject) {
    query = query.eq('subject', filters.subject);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching jobs:', error);
    return [];
  }

  // Filter jobs by Assam location
  return data.filter(job => {
    const coordinates = job.location?.coordinates;
    return coordinates ? isWithinAssam(coordinates) : true;
  });
}
