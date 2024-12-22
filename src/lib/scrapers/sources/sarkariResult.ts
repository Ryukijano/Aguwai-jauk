import * as cheerio from 'cheerio';
import { ScrapedJob } from '../types';
import { getCoordinatesFromAddress } from '../../geo/geocoder';
import { DISTRICTS } from '../../constants';

export async function scrapeSarkariResult(): Promise<ScrapedJob[]> {
  try {
    const response = await fetch('https://www.sarkariresult.com/assam/');
    const html = await response.text();
    const $ = cheerio.load(html);
    const jobs: ScrapedJob[] = [];

    $('.result-list').each(async (_, element) => {
      const title = $(element).find('h2').text().trim();
      const location = $(element).find('.location').text().trim();
      const district = DISTRICTS.find(d => location.includes(d)) || 'Unknown';
      
      const coordinates = await getCoordinatesFromAddress(location);
      
      if (coordinates) {
        jobs.push({
          title,
          school: $(element).find('.organization').text().trim(),
          description: $(element).find('.description').text().trim(),
          requirements: $(element)
            .find('.eligibility li')
            .map((_, el) => $(el).text().trim())
            .get(),
          salary_min: parseSalary($(element).find('.salary').text(), 'min'),
          salary_max: parseSalary($(element).find('.salary').text(), 'max'),
          type: parseJobType(title),
          experience: $(element).find('.experience').text().trim() || 'Not specified',
          subject: parseSubject(title),
          location: {
            city: location,
            district,
            coordinates
          },
          deadline: $(element).find('.last-date').text().trim(),
          source_url: $(element).find('.detail-link').attr('href') || ''
        });
      }
    });

    return jobs;
  } catch (error) {
    console.error('Error scraping Sarkari Result:', error);
    return [];
  }
}

function parseJobType(title: string): string {
  if (title.toLowerCase().includes('temporary')) return 'Temporary';
  if (title.toLowerCase().includes('contract')) return 'Contract';
  if (title.toLowerCase().includes('part-time')) return 'Part-time';
  return 'Full-time';
}

// Reuse the same salary and subject parsing functions as assamCareer.ts
function parseSalary(salaryText: string, type: 'min' | 'max'): number {
  const match = salaryText.match(/₹([\d,]+)/g);
  if (match && match.length === 2) {
    const [min, max] = match.map(s => parseInt(s.replace(/[₹,]/g, '')));
    return type === 'min' ? min : max;
  }
  return 0;
}

function parseSubject(title: string): string {
  const subjects = [
    'Mathematics', 'Science', 'English', 'Assamese',
    'Social Studies', 'Physics', 'Chemistry', 'Biology'
  ];
  
  return subjects.find(subject => 
    title.toLowerCase().includes(subject.toLowerCase())
  ) || 'General';
}