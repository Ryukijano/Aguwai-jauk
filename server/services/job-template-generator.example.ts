// Example usage of JobTemplateGenerator
import { JobTemplateGenerator } from './job-template-generator';
import { storage } from '../storage';

// Example raw job data from various sources
const exampleRawJobs = [
  {
    // Minimal data - will be enriched by AI
    title: "Teacher vacancy",
    organization: "Government School",
    location: "Guwahati",
    description: "Teaching position available",
    source: "Web Scraper",
    sourceUrl: "https://example.com/job1"
  },
  {
    // More complete data
    title: "Assistant Teacher Lower Primary",
    organization: "DEE Assam",
    location: "Jorhat District",
    description: "Recruitment for assistant teacher positions in lower primary schools.",
    requirements: "HSSLC with D.El.Ed, TET qualified",
    salary: "14000-70000",
    deadline: "2025-02-15",
    jobType: "full-time",
    category: "Government",
    tags: ["TET", "Lower Primary"],
    source: "DEE Official",
    sourceUrl: "https://dee.assam.gov.in/recruitment",
    applicationLink: "https://dee.assam.gov.in/apply"
  },
  {
    // Data needing standardization
    title: "PGT Mathematics - 50 Posts",
    organization: "DSE",
    location: "All districts of Assam",
    description: "Post graduate teachers required for government schools",
    requirements: "Master's degree in Mathematics with B.Ed; Must have qualified TET",
    salary: "Pay Band 3 with Grade Pay",
    deadline: "January 30, 2025",
    jobType: "regular",
    source: "DSE Website"
  }
];

// Example: Using the JobTemplateGenerator
async function demonstrateJobTemplateGenerator() {
  const generator = new JobTemplateGenerator(storage);
  
  console.log('🔧 Processing raw job data with JobTemplateGenerator...\n');
  
  // Process individual jobs
  for (const rawJob of exampleRawJobs) {
    console.log(`📝 Processing: ${rawJob.title}`);
    const formattedJob = await generator.formatJobListing(rawJob);
    
    console.log('✅ Formatted Job:');
    console.log('  Title:', formattedJob.title);
    console.log('  Organization:', formattedJob.organization);
    console.log('  Location:', formattedJob.location);
    console.log('  Salary:', formattedJob.salary);
    console.log('  Category:', formattedJob.category);
    console.log('  Tags:', formattedJob.tags);
    console.log('  External ID:', formattedJob.externalId);
    console.log('---');
  }
  
  // Batch processing example
  console.log('\n📦 Batch processing all jobs...');
  const batchProcessed = await generator.processBatch(exampleRawJobs);
  console.log(`✅ Batch processed ${batchProcessed.length} jobs successfully`);
  
  // Example of individual methods
  console.log('\n🔍 Demonstrating individual methods:');
  
  // Standardize location
  const locations = ['guwahati', 'All Districts', 'Jorhat district', 'Kamrup'];
  for (const loc of locations) {
    const standardized = await generator.standardizeLocation(loc);
    console.log(`  Location: "${loc}" → "${standardized}"`);
  }
  
  // Parse salary ranges
  const salaries = ['14000-70000', 'Pay Band 2', '₹15,600 - ₹39,100', 'Level 7'];
  for (const salary of salaries) {
    const parsed = generator.parseSalaryRange(salary);
    console.log(`  Salary: "${salary}" → "${parsed}"`);
  }
  
  // Generate tags
  const sampleData = {
    title: 'TGT Science Teacher',
    description: 'Teaching position for B.Ed qualified candidates with TET certification',
    requirements: 'Must have CTET or ATET qualification',
    organization: 'KVS'
  };
  const tags = await generator.generateTags(sampleData);
  console.log(`  Generated tags for "${sampleData.title}":`, tags);
  
  // Infer category
  const category = await generator.inferCategory(sampleData);
  console.log(`  Inferred category:`, category);
}

// Uncomment to run the demonstration
// demonstrateJobTemplateGenerator().catch(console.error);

export { demonstrateJobTemplateGenerator };