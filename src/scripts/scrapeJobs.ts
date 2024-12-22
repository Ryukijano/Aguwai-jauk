import { scrapeJobs } from '../lib/scrapers/jobScraper';

async function main() {
  try {
    console.log('Starting job scraping process...');
    const jobs = await scrapeJobs();
    console.log(`Job scraping completed. Processed ${jobs.length} jobs.`);
  } catch (error) {
    console.error('Error running job scraper:', error);
    process.exit(1);
  }
}

main();