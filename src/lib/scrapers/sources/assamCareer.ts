import * as cheerio from 'cheerio';
import { ScrapedJob } from '../types';
import { getCoordinatesFromAddress } from '../../geo/geocoder';
import { DISTRICTS } from '../../constants';

export async function scrapeAssamCareer(): Promise<ScrapedJob[]> {
  try {
    const response = await fetch('https://assam.gov.in/career');
    const html = await response.text();
    const $ = cheerio.load(html);
    const jobs: ScrapedJob[] = [];

    $('.job-listing').each(async (_, element) => {
      const title = $(element).find('.job-title').text().trim();
      const location = $(element).find('.job-location').text().trim();
      const district = DISTRICTS.find(d => location.includes(d)) || 'Unknown';
      
      const coordinates = await getCoordinatesFromAddress(location);
      
      if (coordinates) {
        jobs.push({
          title,
          school: $(element).find('.school-name').text().trim(),
          description: $(element).find('.job-description').text().trim(),
          requirements: $(element)
            .find('.requirements li')
            .map((_, el) => $(el).text().trim())
            .get(),
          salary_min: parseSalary($(element).find('.salary').text(), 'min'),
          salary_max: parseSalary($(element).find('.salary').text(), 'max'),
          type: $(element).find('.job-type').text().trim(),
          experience: $(element).find('.experience').text().trim(),
          subject: parseSubject(title),
          location: {
            city: location,
            district,
            coordinates
          },
          deadline: $(element).find('.deadline').text().trim(),
          source_url: $(element).find('a').attr('href') || ''
        });
      }
    });

    return jobs;
  } catch (error) {
    console.error('Error scraping Assam Career:', error);
    return [];
  }
}

function parseSalary(salaryText: string, type: 'min' | 'max'): number {
  // Example: "₹30,000 - ₹45,000"
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