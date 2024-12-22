export interface Job {
  id: string;
  title: string;
  school: string;
  location: {
    city: string;
    district: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  salary: {
    min: number;
    max: number;
  };
  type: string;
  experience: string;
  subject: string;
  description: string;
  requirements: string[];
  postedDate: string;
  deadline: string;
}

export interface JobFilters {
  search: string;
  location: string;
  subject: string;
  experienceLevel: string;
  jobType: string;
  salary?: {
    min: number;
    max: number;
  };
}