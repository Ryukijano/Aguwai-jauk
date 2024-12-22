import { supabase } from '../supabase/client';
import { ScrapedJob } from './types';

export async function storeScrapedJobs(jobs: ScrapedJob[]) {
  for (const job of jobs) {
    // First, check if school exists
    const { data: school } = await supabase
      .from('schools')
      .select('id')
      .eq('name', job.school)
      .single();
    
    let schoolId;
    
    if (!school) {
      // Create new school
      const { data: newSchool } = await supabase
        .from('schools')
        .insert({
          name: job.school,
          type: 'unknown',
          contact: {},
          location: job.location
        })
        .select('id')
        .single();
        
      schoolId = newSchool?.id;
    } else {
      schoolId = school.id;
    }
    
    // Store job
    await supabase
      .from('jobs')
      .insert({
        title: job.title,
        school_id: schoolId,
        description: job.description,
        requirements: job.requirements,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        type: job.type,
        experience: job.experience,
        subject: job.subject,
        location: job.location,
        deadline: job.deadline,
        source_url: job.source_url
      });
  }
}