import * as cheerio from 'cheerio';
import { ScrapedJob } from '../types';
import { getCoordinatesFromAddress } from '../../geo/geocoder';
import { DISTRICTS } from '../../constants';

export async function scrapeAssamGovJobs(): Promise<ScrapedJob[]> {
  try {
    const response = await fetch('https://assamgovtjob.com/category/teaching/');
    const html = await response.text();
    const $ = cheerio.load(html);
    const jobs: ScrapedJob[] = [];

    $('.job-post').each(async (_, element) => {
      const title = $(element).find('h2.entry-title').text().trim();
      const location = $(element).find('.job-location').text().trim();
      const district = DISTRICTS.find(d => location.includes(d)) || 'Unknown';
      
      const coordinates = await getCoordinatesFromAddress(location);
      
      if (coordinates) {
        const description = $(element).find('.entry-content').text().trim();
        const requirements = extractRequirements(description);
        const salary = extractSalary(description);
        
        jobs.push({
          title,
          school: extractSchoolName(description),
          description,
          requirements,
          salary_min: salary.min,
          salary_max: salary.max,
          type: extractJobType(description),
          experience: extractExperience(description),
          subject: extractSubject(title, description),
          location: {
            city: location,
            district,
            coordinates
          },
          deadline: $(element).find('.application-deadline').text().trim(),
          source_url: $(element).find('.entry-title a').attr('href') || ''
        });
      }
    });

    return jobs;
  } catch (error) {
    console.error('Error scraping Assam Govt Jobs:', error);
    return [];
  }
}

function extractRequirements(text: string): string[] {
  const requirements: string[] = [];
  const lines = text.split('\n');
  let inRequirements = false;

  for (const line of lines) {
    if (line.toLowerCase().includes('eligibility') || line.toLowerCase().includes('qualification')) {
      inRequirements = true;
      continue;
    }
    if (inRequirements && line.trim()) {
      if (line.toLowerCase().includes('how to apply')) {
        break;
      }
      requirements.push(line.trim());
    }
  }

  return requirements;
}

function extractSalary(text: string): { min: number; max: number } {
  const salaryMatch = text.match(/(?:salary|pay).{0,20}(?:Rs|₹)\s*(\d[\d,]*)/i);
  if (salaryMatch) {
    const amount = parseInt(salaryMatch[1].replace(/,/g, ''));
    return { min: amount, max: amount };
  }
  return { min: 0, max: 0 };
}

function extractSchoolName(text: string): string {
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.toLowerCase().includes('school') || line.toLowerCase().includes('college')) {
      return line.trim();
    }
  }
  return 'Unknown Institution';
}

function extractJobType(text: string): string {
  if (text.toLowerCase().includes('temporary')) return 'Temporary';
  if (text.toLowerCase().includes('contract')) return 'Contract';
  if (text.toLowerCase().includes('part time')) return 'Part-time';
  return 'Full-time';
}

function extractExperience(text: string): string {
  const expMatch = text.match(/(\d+)(?:\s*-\s*\d+)?\s*years?\s+(?:of\s+)?experience/i);
  return expMatch ? `${expMatch[1]}+ years` : 'Not specified';
}

function extractSubject(title: string, description: string): string {
  const subjects = [
    'Mathematics', 'Science', 'English', 'Assamese',
    'Social Studies', 'Physics', 'Chemistry', 'Biology'
  ];
  
  const fullText = `${title} ${description}`.toLowerCase();
  return subjects.find(subject => fullText.includes(subject.toLowerCase())) || 'General';
}