import { pgTable, serial, text, integer, timestamp, boolean, pgEnum, date } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Enums
export const applicationStatusEnum = pgEnum('application_status', ['applied', 'shortlisted', 'interview', 'rejected', 'accepted']);
export const eventTypeEnum = pgEnum('event_type', ['interview', 'deadline', 'meeting', 'other']);
export const jobTypeEnum = pgEnum('job_type', ['full-time', 'part-time', 'contract', 'temporary']);
export const jobCategoryEnum = pgEnum('job_category', ['primary', 'secondary', 'higher-secondary', 'college', 'university', 'special-education']);

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  email: text('email').notNull().unique(),
  fullName: text('full_name'),
  bio: text('bio'),
  avatar: text('avatar'),
  phone: text('phone'),
  address: text('address'),
  experience: text('experience'),
  education: text('education'),
  skills: text('skills').array(),
  preferredLocations: text('preferred_locations').array(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Job Listings table (matching existing database)
export const jobListings = pgTable('job_listings', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  organization: text('organization').notNull(),
  location: text('location').notNull(),
  description: text('description').notNull(),
  requirements: text('requirements'),
  salary: text('salary'),
  applicationDeadline: date('application_deadline'),
  jobType: text('job_type'),
  category: text('category'),
  tags: text('tags').array(),
  source: text('source'),
  sourceUrl: text('source_url'),
  aiSummary: text('ai_summary'),
  externalId: text('external_id').unique(), // For tracking scraped jobs
  isActive: boolean('is_active').default(true), // For job status
  applicationLink: text('application_link'), // Direct application link
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Applications table
export const applications = pgTable('applications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  jobId: integer('job_id').notNull().references(() => jobListings.id),
  status: text('status').notNull().default('Pending'),
  appliedAt: timestamp('applied_at').defaultNow(),
  coverLetter: text('cover_letter'),
  resumeUrl: text('resume_url'),
  interviewDate: timestamp('interview_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Documents table
export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  type: text('type').notNull(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  size: integer('size'),
  uploadedAt: timestamp('uploaded_at').defaultNow()
});

// Events table
export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  description: text('description'),
  date: timestamp('date').notNull(),
  type: text('type'),
  location: text('location'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Chat Messages table
export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  sessionId: text('session_id'),
  content: text('content').notNull(),
  isFromUser: boolean('is_from_user').notNull().default(true),
  timestamp: timestamp('timestamp').defaultNow(),
  metadata: text('metadata')
});

// Social Links table
export const socialLinks = pgTable('social_links', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  platform: text('platform').notNull(),
  url: text('url').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

// Create schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJobListingSchema = createInsertSchema(jobListings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApplicationSchema = createInsertSchema(applications).omit({ id: true, appliedAt: true, createdAt: true, updatedAt: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, uploadedAt: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, timestamp: true });
export const insertSocialLinkSchema = createInsertSchema(socialLinks).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type JobListing = typeof jobListings.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Event = typeof events.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type SocialLink = typeof socialLinks.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertJobListing = z.infer<typeof insertJobListingSchema>;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type InsertSocialLink = z.infer<typeof insertSocialLinkSchema>;