export interface User {
  id: number;
  username: string;
  name: string | null;
  email: string | null;
  profilePicture: string | null;
  bio: string | null;
  qualifications: string | null;
}

export interface JobListing {
  id: number;
  title: string;
  organization: string;
  location: string;
  description: string;
  requirements: string | null;
  salary: string | null;
  applicationDeadline: string;
  jobType: string | null;
  category: string | null;
  tags: string[];
  source: string | null;
  sourceUrl: string | null;
  aiSummary: string | null;
  createdAt: string;
}

export interface Application {
  id: number;
  userId: number;
  jobId: number;
  status: string;
  resumeUrl: string | null;
  coverLetterUrl: string | null;
  notes: string | null;
  interviewDate: string | null;
  createdAt: string;
}

export interface SocialLink {
  id: number;
  userId: number;
  platform: string;
  url: string;
  displayName: string | null;
}

export interface Document {
  id: number;
  userId: number;
  type: string;
  name: string;
  url: string;
  size: number | null;
  mimeType: string | null;
  isDefault: boolean;
  parsedData: string | null;
  uploadedAt: string;
}

export interface Event {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  location: string | null;
  type: string | null;
  googleCalendarId: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: number;
  userId: number;
  content: string;
  isFromUser: boolean;
  timestamp: string;
}

export interface Stat {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  trend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
    label: string;
  };
}

export interface JobAnalysis {
  keyRequirements: string[];
  suggestedSkills: string[];
  applicationTips: string;
}

export interface ResumeAnalysis {
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

export interface DashboardData {
  user: User;
  stats: {
    availableJobs: number;
    applications: number;
    interviews: number;
    deadlines: number;
  };
  recentJobs: JobListing[];
  userApplications: Application[];
  upcomingEvents: Event[];
  socialLinks: SocialLink[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  location?: string;
  color: string;
}

export interface GoogleSheetData {
  range: string;
  values: any[][];
}
