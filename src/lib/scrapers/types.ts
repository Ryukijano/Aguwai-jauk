export interface ScrapedJob {
  title: string;
  school: string;
  description: string;
  requirements: string[];
  salary_min: number;
  salary_max: number;
  type: string;
  experience: string;
  subject: string;
  location: {
    city: string;
    district: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    }
  };
  deadline: string;
  source_url: string;
}