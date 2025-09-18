import type { Express } from "express";
import type {
  User,
  InsertUser,
  JobListing,
  InsertJobListing,
  Application,
  InsertApplication,
  SocialLink,
  InsertSocialLink,
  Document,
  InsertDocument,
  Event,
  InsertEvent,
  ChatMessage,
  InsertChatMessage,
  JobExternalClick,
  InsertJobExternalClick,
  ApplicationStatusHistory,
  InsertApplicationStatusHistory,
  Notification,
  InsertNotification,
} from "@shared/schema";
import { DatabaseStorage } from "./database-storage";

export interface IStorage {
  // User methods
  getUser(username: string): Promise<User | null>;
  getUserById(id: number): Promise<User | null>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | null>;
  
  // Job listing methods
  getJobListings(filters?: { category?: string; location?: string; search?: string }): Promise<JobListing[]>;
  getJobListing(id: number): Promise<JobListing | null>;
  getJobs(): Promise<JobListing[]>; // Alias for scraper compatibility
  createJobListing(job: InsertJobListing): Promise<JobListing>;
  createJob(job: InsertJobListing): Promise<JobListing>; // Alias for scraper compatibility
  updateJobListing(id: number, updates: Partial<InsertJobListing>): Promise<JobListing | null>;
  getJobByExternalId(externalId: string): Promise<JobListing | null>;
  
  // Application methods
  getApplications(userId: number): Promise<Application[]>;
  getApplication(id: number): Promise<Application | null>;
  getApplicationByUserAndJob(userId: number, jobId: number): Promise<Application | null>;
  createApplication(application: InsertApplication): Promise<Application>;
  updateApplication(id: number, updates: Partial<InsertApplication>): Promise<Application | null>;
  
  // Bulk application methods
  bulkCreateApplications(applications: InsertApplication[]): Promise<{
    successes: Application[];
    failures: Array<{ jobId: number; error: string }>;
    skipped: Array<{ jobId: number; reason: string }>;
  }>;
  checkExistingApplications(userId: number, jobIds: number[]): Promise<number[]>;
  
  // Social link methods
  getSocialLinks(userId: number): Promise<SocialLink[]>;
  createSocialLink(link: InsertSocialLink): Promise<SocialLink>;
  deleteSocialLink(id: number): Promise<boolean>;
  
  // Document methods
  getDocuments(userId: number): Promise<Document[]>;
  getDocumentById(id: number): Promise<Document | null>;
  getUserResumes(userId: number): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  deleteDocument(id: number): Promise<boolean>;
  deleteUserDocument(userId: number, documentId: number): Promise<boolean>;
  setDefaultResume(userId: number, documentId: number): Promise<boolean>;
  
  // Event methods
  getEvents(userId: number): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, updates: Partial<InsertEvent>): Promise<Event | null>;
  deleteEvent(id: number): Promise<boolean>;
  
  // Chat message methods
  getChatMessages(userId: number | null, sessionId?: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  
  // Job external click methods
  trackJobExternalClick(click: InsertJobExternalClick): Promise<JobExternalClick>;
  getJobExternalClicks(jobId: number): Promise<JobExternalClick[]>;
  
  // Application status history methods
  createStatusHistory(history: InsertApplicationStatusHistory): Promise<ApplicationStatusHistory>;
  getApplicationStatusHistory(applicationId: number): Promise<ApplicationStatusHistory[]>;
  updateApplicationStatus(applicationId: number, status: string, userId?: number, note?: string): Promise<Application | null>;
  
  // Notification methods
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotifications(userId: number): Promise<Notification[]>;
  updateNotificationStatus(id: number, status: string, sentAt?: Date, error?: string): Promise<Notification | null>;
  
  // Email preferences methods
  getUserEmailPreferences(userId: number): Promise<any>;
  updateUserEmailPreferences(userId: number, preferences: any): Promise<boolean>;
  
  // Job match methods
  saveJobMatches(userId: number, resumeId: number | null, matches: any[]): Promise<void>;
  getJobMatches(userId: number): Promise<any[]>;
  getJobMatchByUserAndJob(userId: number, jobId: number): Promise<any | null>;
  clearUserJobMatches(userId: number): Promise<void>;
  
  // Session store
  sessionStore: Express.SessionStore;
}

// Export storage instance
export const storage = new DatabaseStorage();