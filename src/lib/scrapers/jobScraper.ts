import { ScrapedJob } from './types';
import { scrapeAssamCareer } from './sources/assamCareer';
import { scrapeSarkariResult } from './sources/sarkariResult';
import { scrapeAssamGovJobs } from './sources/assamGovJobs';
import { isWithinAssam } from '../utils/geo';
import { storeScrapedJobs } from './storage';

export async function scrapeJobs(): Promise<ScrapedJob[]> {
  try {
    console.log('Starting job scraping from multiple sources...');
    
    const [assamCareerJobs, sarkariResultJobs, assamGovJobs] = await Promise.all([
      scrapeAssamCareer().catch(err => {
        console.error('Error scraping Assam Career:', err);
        return [];
      }),
      scrapeSarkariResult().catch(err => {
        console.error('Error scraping Sarkari Result:', err);
        return [];
      }),
      scrapeAssamGovJobs().catch(err => {
        console.error('Error scraping Assam Govt Jobs:', err);
        return [];
      })
    ]);

    // Combine and filter jobs within Assam
    const allJobs = [...assamCareerJobs, ...sarkariResultJobs, ...assamGovJobs];
    const validJobs = allJobs.filter(job => 
      job.location.coordinates ? isWithinAssam(job.location.coordinates) : false
    );

    console.log(`Found ${validJobs.length} valid jobs within Assam`);
    
    // Store the jobs in Supabase
    await storeScrapedJobs(validJobs);
    console.log('Jobs successfully stored in database');

    return validJobs;
  } catch (error) {
    console.error('Error in job scraping process:', error);
    return [];
  }
}