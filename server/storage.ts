import { 
  users, 
  jobListings, 
  applications, 
  socialLinks, 
  documents, 
  events, 
  chatMessages,
  type User, 
  type InsertUser, 
  type JobListing, 
  type InsertJobListing, 
  type Application, 
  type InsertApplication, 
  type SocialLink, 
  type InsertSocialLink, 
  type Document, 
  type InsertDocument, 
  type Event, 
  type InsertEvent, 
  type ChatMessage, 
  type InsertChatMessage 
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  sessionStore: session.Store;

  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;

  // Job listing operations
  getJobListing(id: number): Promise<JobListing | undefined>;
  getJobListings(filters?: Partial<JobListing>): Promise<JobListing[]>;
  createJobListing(jobListing: InsertJobListing): Promise<JobListing>;
  updateJobListing(id: number, updates: Partial<InsertJobListing>): Promise<JobListing | undefined>;

  // Application operations
  getApplication(id: number): Promise<Application | undefined>;
  getUserApplications(userId: number): Promise<Application[]>;
  createApplication(application: InsertApplication): Promise<Application>;
  updateApplication(id: number, updates: Partial<InsertApplication>): Promise<Application | undefined>;

  // Social link operations
  getUserSocialLinks(userId: number): Promise<SocialLink[]>;
  createSocialLink(socialLink: InsertSocialLink): Promise<SocialLink>;
  updateSocialLink(id: number, updates: Partial<InsertSocialLink>): Promise<SocialLink | undefined>;
  deleteSocialLink(id: number): Promise<boolean>;

  // Document operations
  getUserDocuments(userId: number): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: number, updates: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<boolean>;

  // Event operations
  getUserEvents(userId: number): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, updates: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: number): Promise<boolean>;

  // Chat message operations
  getUserChatMessages(userId: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private jobListings: Map<number, JobListing>;
  private applications: Map<number, Application>;
  private socialLinks: Map<number, SocialLink>;
  private documents: Map<number, Document>;
  private events: Map<number, Event>;
  private chatMessages: Map<number, ChatMessage>;

  private userIdCounter: number;
  private jobListingIdCounter: number;
  private applicationIdCounter: number;
  private socialLinkIdCounter: number;
  private documentIdCounter: number;
  private eventIdCounter: number;
  private chatMessageIdCounter: number;

  public sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.jobListings = new Map();
    this.applications = new Map();
    this.socialLinks = new Map();
    this.documents = new Map();
    this.events = new Map();
    this.chatMessages = new Map();

    this.userIdCounter = 1;
    this.jobListingIdCounter = 1;
    this.applicationIdCounter = 1;
    this.socialLinkIdCounter = 1;
    this.documentIdCounter = 1;
    this.eventIdCounter = 1;
    this.chatMessageIdCounter = 1;

    // Initialize session store
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // Prune expired entries every 24h
    });

    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Sample Users
    const user1: User = {
      id: this.userIdCounter++,
      username: "rajdeep",
      password: "password",
      name: "Rajdeep Sharma",
      email: "rajdeep@example.com",
      profilePicture: null,
      bio: "Mathematics Teacher | M.Sc Mathematics | B.Ed",
      qualifications: "M.Sc Mathematics, B.Ed",
      createdAt: new Date(),
    };
    this.users.set(user1.id, user1);

    // Add another test user with simpler credentials
    const user2: User = {
      id: this.userIdCounter++,
      username: "test",
      password: "test123",
      name: "Test User",
      email: "test@example.com", 
      profilePicture: null,
      bio: "Test user account for demonstration purposes",
      qualifications: "B.Ed, English",
      createdAt: new Date(),
    };
    this.users.set(user2.id, user2);

    // Sample Jobs
    const sampleJobs: InsertJobListing[] = [
      {
        title: "Assistant Teacher (Mathematics)",
        organization: "Government Higher Secondary School, Guwahati",
        location: "Guwahati",
        description: "We are looking for a qualified mathematics teacher for our secondary school.",
        requirements: "B.Ed required, M.Sc in Mathematics preferred",
        salary: "₹45,000 - ₹60,000",
        applicationDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        jobType: "Full-time",
        category: "Government",
        tags: ["Mathematics", "B.Ed Required"],
        source: "Assam Public Service Commission",
        sourceUrl: "https://apsc.nic.in/",
        aiSummary: "This is a government position requiring a B.Ed degree and mathematics expertise.",
      },
      {
        title: "Primary School Teacher",
        organization: "Delhi Public School, Dibrugarh",
        location: "Dibrugarh",
        description: "Teaching position for primary classes at Delhi Public School.",
        requirements: "D.El.Ed required, experience with young learners preferred",
        salary: "₹35,000 - ₹45,000",
        applicationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        jobType: "Full-time",
        category: "Private",
        tags: ["Primary", "D.El.Ed Required"],
        source: "DPS Careers",
        sourceUrl: "https://dpsindia.org/careers",
        aiSummary: "Primary teaching role at a prestigious private school in Dibrugarh.",
      }
    ];

    sampleJobs.forEach(job => {
      const jobWithId: JobListing = {
        ...job,
        id: this.jobListingIdCounter++,
        createdAt: new Date(),
        source: job.source || null,
        requirements: job.requirements || null,
        salary: job.salary || null,
        applicationDeadline: job.applicationDeadline || null,
        sourceUrl: job.sourceUrl || null,
        aiSummary: job.aiSummary || null
      };
      this.jobListings.set(jobWithId.id, jobWithId);
    });

    // Sample Applications
    const sampleApplications: InsertApplication[] = [
      {
        userId: user1.id,
        jobId: 1,
        status: "Applied",
        resumeUrl: "https://drive.google.com/file/resume.pdf",
        coverLetterUrl: "https://drive.google.com/file/coverletter.pdf",
        notes: "Applied online through the portal",
        interviewDate: null,
      }
    ];

    sampleApplications.forEach(application => {
      const applicationWithId: Application = {
        ...application,
        id: this.applicationIdCounter++,
        createdAt: new Date(),
        resumeUrl: application.resumeUrl || null,
        coverLetterUrl: application.coverLetterUrl || null,
        notes: application.notes || null,
        interviewDate: application.interviewDate || null
      };
      this.applications.set(applicationWithId.id, applicationWithId);
    });

    // Sample Social Links
    const sampleSocialLinks: InsertSocialLink[] = [
      {
        userId: user1.id,
        platform: "LinkedIn",
        url: "https://linkedin.com/in/rajdeepsharma",
        displayName: "LinkedIn",
      }
    ];

    sampleSocialLinks.forEach(link => {
      const linkWithId: SocialLink = {
        ...link,
        id: this.socialLinkIdCounter++,
        displayName: link.displayName || null
      };
      this.socialLinks.set(linkWithId.id, linkWithId);
    });

    // Sample Events
    const interviewDate = new Date();
    interviewDate.setDate(interviewDate.getDate() + 7);
    interviewDate.setHours(10, 0, 0, 0);

    const sampleEvents: InsertEvent[] = [
      {
        userId: user1.id,
        title: "Interview with DPS Dibrugarh",
        description: "Virtual interview for Primary Teacher position",
        startTime: interviewDate,
        endTime: new Date(interviewDate.getTime() + 60 * 60 * 1000), // 1 hour later
        location: "Google Meet",
        type: "Interview",
        googleCalendarId: "event123",
      }
    ];

    sampleEvents.forEach(event => {
      const eventWithId: Event = {
        ...event,
        id: this.eventIdCounter++,
        createdAt: new Date(),
        type: event.type || null,
        location: event.location || null,
        description: event.description || null,
        endTime: event.endTime || null,
        googleCalendarId: event.googleCalendarId || null
      };
      this.events.set(eventWithId.id, eventWithId);
    });

    // Sample Chat Messages
    const sampleChatMessages: InsertChatMessage[] = [
      {
        userId: user1.id,
        content: "Hello Rajdeep! How can I help you with your teaching job search today?",
        isFromUser: false,
      }
    ];

    sampleChatMessages.forEach(message => {
      const messageWithId: ChatMessage = {
        ...message,
        id: this.chatMessageIdCounter++,
        timestamp: new Date()
      };
      this.chatMessages.set(messageWithId.id, messageWithId);
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const newUser: User = {
      ...user,
      id,
      createdAt: new Date(),
      name: user.name || null,
      email: user.email || null,
      profilePicture: user.profilePicture || null,
      bio: user.bio || null,
      qualifications: user.qualifications || null
    };
    this.users.set(id, newUser);
    return newUser;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updatedUser: User = {
      ...user,
      ...updates,
      name: updates.name ?? user.name,
      email: updates.email ?? user.email,
      profilePicture: updates.profilePicture ?? user.profilePicture,
      bio: updates.bio ?? user.bio,
      qualifications: updates.qualifications ?? user.qualifications
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Job listing operations
  async getJobListing(id: number): Promise<JobListing | undefined> {
    return this.jobListings.get(id);
  }

  async getJobListings(filters?: Partial<JobListing>): Promise<JobListing[]> {
    let jobs = Array.from(this.jobListings.values());

    if (filters) {
      jobs = jobs.filter(job => {
        return Object.entries(filters).every(([key, value]) => {
          // Handle array filters like tags
          if (Array.isArray(job[key as keyof JobListing]) && Array.isArray(value)) {
            return (job[key as keyof JobListing] as unknown as any[]).some(item => 
              (value as any[]).includes(item)
            );
          }

          // Handle simple equality
          return job[key as keyof JobListing] === value;
        });
      });
    }

    return jobs;
  }

  async createJobListing(jobListing: InsertJobListing): Promise<JobListing> {
    const id = this.jobListingIdCounter++;
    const newJob: JobListing = {
      ...jobListing,
      id,
      createdAt: new Date(),
      source: jobListing.source || null,
      requirements: jobListing.requirements || null,
      salary: jobListing.salary || null,
      applicationDeadline: jobListing.applicationDeadline || null,
      sourceUrl: jobListing.sourceUrl || null,
      aiSummary: jobListing.aiSummary || null
    };
    this.jobListings.set(id, newJob);
    return newJob;
  }

  async updateJobListing(id: number, updates: Partial<InsertJobListing>): Promise<JobListing | undefined> {
    const job = this.jobListings.get(id);
    if (!job) return undefined;

    const updatedJob: JobListing = {
      ...job,
      ...updates,
      source: updates.source ?? job.source,
      requirements: updates.requirements ?? job.requirements,
      salary: updates.salary ?? job.salary,
      applicationDeadline: updates.applicationDeadline ?? job.applicationDeadline,
      sourceUrl: updates.sourceUrl ?? job.sourceUrl,
      aiSummary: updates.aiSummary ?? job.aiSummary
    };
    this.jobListings.set(id, updatedJob);
    return updatedJob;
  }

  // Application operations
  async getApplication(id: number): Promise<Application | undefined> {
    return this.applications.get(id);
  }

  async getUserApplications(userId: number): Promise<Application[]> {
    return Array.from(this.applications.values()).filter(
      application => application.userId === userId
    );
  }

  async createApplication(application: InsertApplication): Promise<Application> {
    const id = this.applicationIdCounter++;
    const newApplication: Application = {
      ...application,
      id,
      createdAt: new Date(),
      resumeUrl: application.resumeUrl || null,
      coverLetterUrl: application.coverLetterUrl || null,
      notes: application.notes || null,
      interviewDate: application.interviewDate || null
    };
    this.applications.set(id, newApplication);
    return newApplication;
  }

  async updateApplication(id: number, updates: Partial<InsertApplication>): Promise<Application | undefined> {
    const application = this.applications.get(id);
    if (!application) return undefined;

    const updatedApplication: Application = {
      ...application,
      ...updates,
      resumeUrl: updates.resumeUrl ?? application.resumeUrl,
      coverLetterUrl: updates.coverLetterUrl ?? application.coverLetterUrl,
      notes: updates.notes ?? application.notes,
      interviewDate: updates.interviewDate ?? application.interviewDate
    };
    this.applications.set(id, updatedApplication);
    return updatedApplication;
  }

  // Social link operations
  async getUserSocialLinks(userId: number): Promise<SocialLink[]> {
    return Array.from(this.socialLinks.values()).filter(
      link => link.userId === userId
    );
  }

  async createSocialLink(socialLink: InsertSocialLink): Promise<SocialLink> {
    const id = this.socialLinkIdCounter++;
    const newLink: SocialLink = {
      ...socialLink,
      id,
      displayName: socialLink.displayName || null
    };
    this.socialLinks.set(id, newLink);
    return newLink;
  }

  async updateSocialLink(id: number, updates: Partial<InsertSocialLink>): Promise<SocialLink | undefined> {
    const link = this.socialLinks.get(id);
    if (!link) return undefined;

    const updatedLink: SocialLink = {
      ...link,
      ...updates,
      displayName: updates.displayName ?? link.displayName
    };
    this.socialLinks.set(id, updatedLink);
    return updatedLink;
  }

  async deleteSocialLink(id: number): Promise<boolean> {
    return this.socialLinks.delete(id);
  }

  // Document operations
  async getUserDocuments(userId: number): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(
      document => document.userId === userId
    );
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const id = this.documentIdCounter++;
    const newDocument: Document = {
      ...document,
      id,
      createdAt: new Date(),
      name: document.name || null,
      url: document.url || null
    };
    this.documents.set(id, newDocument);
    return newDocument;
  }

  async updateDocument(id: number, updates: Partial<InsertDocument>): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (!document) return undefined;

    const updatedDocument: Document = {
      ...document,
      ...updates,
      name: updates.name ?? document.name,
      url: updates.url ?? document.url
    };
    this.documents.set(id, updatedDocument);
    return updatedDocument;
  }

  async deleteDocument(id: number): Promise<boolean> {
    return this.documents.delete(id);
  }

  // Event operations
  async getUserEvents(userId: number): Promise<Event[]> {
    return Array.from(this.events.values()).filter(
      event => event.userId === userId
    );
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const id = this.eventIdCounter++;
    const newEvent: Event = {
      ...event,
      id,
      createdAt: new Date(),
      type: event.type || null,
      location: event.location || null,
      description: event.description || null,
      endTime: event.endTime || null,
      googleCalendarId: event.googleCalendarId || null
    };
    this.events.set(id, newEvent);
    return newEvent;
  }

  async updateEvent(id: number, updates: Partial<InsertEvent>): Promise<Event | undefined> {
    const event = this.events.get(id);
    if (!event) return undefined;

    const updatedEvent: Event = {
      ...event,
      ...updates,
      type: updates.type ?? event.type,
      location: updates.location ?? event.location,
      description: updates.description ?? event.description,
      endTime: updates.endTime ?? event.endTime,
      googleCalendarId: updates.googleCalendarId ?? event.googleCalendarId
    };
    this.events.set(id, updatedEvent);
    return updatedEvent;
  }

  async deleteEvent(id: number): Promise<boolean> {
    return this.events.delete(id);
  }

  // Chat message operations - fixing the timestamp sort
  async getUserChatMessages(userId: number): Promise<ChatMessage[]> {
    const messages = Array.from(this.chatMessages.values())
      .filter(message => message.userId === userId);

    // Sort by timestamp, handling potential null values
    return messages.sort((a, b) => {
      const timeA = a.timestamp?.getTime() || 0;
      const timeB = b.timestamp?.getTime() || 0;
      return timeA - timeB;
    });
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const id = this.chatMessageIdCounter++;
    const newMessage: ChatMessage = {
      ...message,
      id,
      timestamp: new Date()
    };
    this.chatMessages.set(id, newMessage);
    return newMessage;
  }
}

// Create and export the storage instance
export const storage = new MemStorage();