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

export interface IStorage {
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
    
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Sample User
    const user: User = {
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
    this.users.set(user.id, user);
    
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
      },
      {
        title: "Assamese Language Teacher",
        organization: "Kendriya Vidyalaya, Jorhat",
        location: "Jorhat",
        description: "Teaching Assamese language and literature to students of various grades.",
        requirements: "M.A. in Assamese, B.Ed required",
        salary: "₹40,000 - ₹55,000",
        applicationDeadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
        jobType: "Full-time",
        category: "Government",
        tags: ["Language", "M.A. Assamese"],
        source: "Kendriya Vidyalaya Sangathan",
        sourceUrl: "https://kvsangathan.nic.in/",
        aiSummary: "Position for teaching Assamese language at a central government school.",
      }
    ];
    
    sampleJobs.forEach(job => {
      const jobWithId: JobListing = {
        ...job,
        id: this.jobListingIdCounter++,
        createdAt: new Date()
      };
      this.jobListings.set(jobWithId.id, jobWithId);
    });
    
    // Sample Applications
    const sampleApplications: InsertApplication[] = [
      {
        userId: user.id,
        jobId: 1,
        status: "Applied",
        resumeUrl: "https://drive.google.com/file/resume.pdf",
        coverLetterUrl: "https://drive.google.com/file/coverletter.pdf",
        notes: "Applied online through the portal",
        interviewDate: null,
      },
      {
        userId: user.id,
        jobId: 2,
        status: "Interview Scheduled",
        resumeUrl: "https://drive.google.com/file/resume.pdf",
        coverLetterUrl: "https://drive.google.com/file/coverletter.pdf",
        notes: "Phone screening completed, waiting for in-person interview",
        interviewDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      }
    ];
    
    sampleApplications.forEach(application => {
      const applicationWithId: Application = {
        ...application,
        id: this.applicationIdCounter++,
        createdAt: new Date()
      };
      this.applications.set(applicationWithId.id, applicationWithId);
    });
    
    // Sample Social Links
    const sampleSocialLinks: InsertSocialLink[] = [
      {
        userId: user.id,
        platform: "LinkedIn",
        url: "https://linkedin.com/in/rajdeepsharma",
        displayName: "LinkedIn",
      },
      {
        userId: user.id,
        platform: "YouTube",
        url: "https://youtube.com/@rajdeepsharma",
        displayName: "YouTube",
      },
      {
        userId: user.id,
        platform: "Instagram",
        url: "https://instagram.com/rajdeepsharma",
        displayName: "Instagram",
      },
      {
        userId: user.id,
        platform: "Website",
        url: "https://rajdeepsharma.com",
        displayName: "Website",
      }
    ];
    
    sampleSocialLinks.forEach(link => {
      const linkWithId: SocialLink = {
        ...link,
        id: this.socialLinkIdCounter++
      };
      this.socialLinks.set(linkWithId.id, linkWithId);
    });
    
    // Sample Events
    const interviewDate = new Date();
    interviewDate.setDate(interviewDate.getDate() + 7);
    interviewDate.setHours(10, 0, 0, 0);
    
    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + 9);
    
    const sampleEvents: InsertEvent[] = [
      {
        userId: user.id,
        title: "Interview with DPS Dibrugarh",
        description: "Virtual interview for Primary Teacher position",
        startTime: interviewDate,
        endTime: new Date(interviewDate.getTime() + 60 * 60 * 1000), // 1 hour later
        location: "Google Meet",
        type: "Interview",
        googleCalendarId: "event123",
      },
      {
        userId: user.id,
        title: "Document Submission Deadline",
        description: "Last day to submit documents for Government Higher Secondary School application",
        startTime: deadlineDate,
        endTime: deadlineDate,
        location: null,
        type: "Deadline",
        googleCalendarId: "event456",
      }
    ];
    
    sampleEvents.forEach(event => {
      const eventWithId: Event = {
        ...event,
        id: this.eventIdCounter++,
        createdAt: new Date()
      };
      this.events.set(eventWithId.id, eventWithId);
    });
    
    // Sample Chat Messages
    const sampleChatMessages: InsertChatMessage[] = [
      {
        userId: user.id,
        content: "Hello Rajdeep! How can I help you with your teaching job search today?",
        isFromUser: false,
      },
      {
        userId: user.id,
        content: "Can you help me prepare for my upcoming interview?",
        isFromUser: true,
      },
      {
        userId: user.id,
        content: "Of course! I see you have an interview with DPS Dibrugarh on May 24th. Would you like me to suggest some common interview questions for a mathematics teaching position, or help you prepare specific answers based on your resume?",
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
    const newUser: User = { ...user, id, createdAt: new Date() };
    this.users.set(id, newUser);
    return newUser;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = { ...user, ...updates };
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
    const newJob: JobListing = { ...jobListing, id, createdAt: new Date() };
    this.jobListings.set(id, newJob);
    return newJob;
  }

  async updateJobListing(id: number, updates: Partial<InsertJobListing>): Promise<JobListing | undefined> {
    const job = this.jobListings.get(id);
    if (!job) return undefined;
    
    const updatedJob: JobListing = { ...job, ...updates };
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
    const newApplication: Application = { ...application, id, createdAt: new Date() };
    this.applications.set(id, newApplication);
    return newApplication;
  }

  async updateApplication(id: number, updates: Partial<InsertApplication>): Promise<Application | undefined> {
    const application = this.applications.get(id);
    if (!application) return undefined;
    
    const updatedApplication: Application = { ...application, ...updates };
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
    const newLink: SocialLink = { ...socialLink, id };
    this.socialLinks.set(id, newLink);
    return newLink;
  }

  async updateSocialLink(id: number, updates: Partial<InsertSocialLink>): Promise<SocialLink | undefined> {
    const link = this.socialLinks.get(id);
    if (!link) return undefined;
    
    const updatedLink: SocialLink = { ...link, ...updates };
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
    const newDocument: Document = { ...document, id, createdAt: new Date() };
    this.documents.set(id, newDocument);
    return newDocument;
  }

  async updateDocument(id: number, updates: Partial<InsertDocument>): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (!document) return undefined;
    
    const updatedDocument: Document = { ...document, ...updates };
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
    const newEvent: Event = { ...event, id, createdAt: new Date() };
    this.events.set(id, newEvent);
    return newEvent;
  }

  async updateEvent(id: number, updates: Partial<InsertEvent>): Promise<Event | undefined> {
    const event = this.events.get(id);
    if (!event) return undefined;
    
    const updatedEvent: Event = { ...event, ...updates };
    this.events.set(id, updatedEvent);
    return updatedEvent;
  }

  async deleteEvent(id: number): Promise<boolean> {
    return this.events.delete(id);
  }

  // Chat message operations
  async getUserChatMessages(userId: number): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values())
      .filter(message => message.userId === userId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const id = this.chatMessageIdCounter++;
    const newMessage: ChatMessage = { ...message, id, timestamp: new Date() };
    this.chatMessages.set(id, newMessage);
    return newMessage;
  }
}

// Create and export the storage instance
export const storage = new MemStorage();
