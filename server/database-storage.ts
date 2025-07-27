import { Pool } from 'pg';
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import {
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
import { IStorage } from "./storage";

const PostgresSessionStore = connectPgSimple(session);

export class DatabaseStorage implements IStorage {
  private pool: Pool;
  public sessionStore: Express.SessionStore;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    this.sessionStore = new PostgresSessionStore({
      pool: this.pool,
      createTableIfMissing: true,
      tableName: 'session'
    }) as unknown as Express.SessionStore;

    // Initialize database schema
    this.initializeDatabase().catch(console.error);
  }

  private async initializeDatabase() {
    try {
      // Execute schema.sql to create tables
      const fs = await import('fs/promises');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
      
      const schema = await fs.readFile(schemaPath, 'utf-8');
      await this.pool.query(schema);
      
      console.log('Database schema initialized successfully');
      
      // Insert sample data if no jobs exist
      const jobsResult = await this.pool.query('SELECT COUNT(*) FROM job_listings');
      if (jobsResult.rows[0].count === '0') {
        await this.insertSampleData();
      }
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  }

  private async insertSampleData() {
    const sampleJobs = [
      {
        title: "Senior Mathematics Teacher",
        organization: "Assam Valley School, Tezpur",
        location: "Tezpur",
        description: "We are seeking an experienced mathematics teacher for senior secondary classes.",
        requirements: "M.Sc in Mathematics, B.Ed required, minimum 5 years experience",
        salary: "₹60,000 - ₹80,000",
        application_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        job_type: "Full-time",
        category: "Private",
        tags: ["Mathematics", "Senior Level", "B.Ed Required"],
        source: "School Website",
        source_url: "https://assamvalleyschool.com/careers",
        ai_summary: "Senior position at prestigious boarding school with excellent facilities."
      },
      {
        title: "Primary English Teacher",
        organization: "Kendriya Vidyalaya, Guwahati",
        location: "Guwahati",
        description: "Teaching position for primary English classes at KV Guwahati.",
        requirements: "B.Ed with English specialization, TET qualified",
        salary: "₹40,000 - ₹55,000",
        application_deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        job_type: "Full-time",
        category: "Government",
        tags: ["English", "Primary", "TET Required"],
        source: "KVS Official",
        source_url: "https://kvsangathan.nic.in",
        ai_summary: "Government position with job security and benefits."
      },
      {
        title: "Science Teacher (Physics)",
        organization: "Don Bosco School, Dibrugarh",
        location: "Dibrugarh",
        description: "Physics teacher needed for classes 9-12 at Don Bosco School.",
        requirements: "M.Sc Physics, B.Ed, experience with CBSE curriculum",
        salary: "₹45,000 - ₹65,000",
        application_deadline: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        job_type: "Full-time",
        category: "Private",
        tags: ["Physics", "CBSE", "Secondary"],
        source: "School Recruitment",
        source_url: "https://donboscodibrugarh.edu.in",
        ai_summary: "Well-established school with modern lab facilities."
      }
    ];

    for (const job of sampleJobs) {
      await this.createJobListing(job);
    }
  }

  // User operations (implement IStorage interface)
  async getUser(username: string): Promise<User | null> {
    const result = await this.pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0] || null;
  }

  async getUserById(id: number): Promise<User | null> {
    const result = await this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const { username, password, email, fullName, bio, avatar, phone, address, experience, education, skills, preferredLocations } = user;
    const result = await this.pool.query(
      `INSERT INTO users (username, password, email, full_name, bio, avatar, phone, address, experience, education, skills, preferred_locations) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       RETURNING *`,
      [username, password, email, fullName, bio, avatar, phone, address, experience, education, skills, preferredLocations]
    );
    return result.rows[0];
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | null> {
    const fields = [];
    const values = [];
    let index = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        fields.push(`${snakeKey} = $${index}`);
        values.push(value);
        index++;
      }
    }

    if (fields.length === 0) return this.getUserById(id);

    values.push(id);
    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`;
    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  // Job listing operations
  async getJobListing(id: number): Promise<JobListing | null> {
    const result = await this.pool.query('SELECT * FROM job_listings WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async getAllJobs(): Promise<JobListing[]> {
    const result = await this.pool.query('SELECT * FROM job_listings ORDER BY created_at DESC');
    return result.rows;
  }

  async getJobListings(filters?: { category?: string; location?: string; search?: string }): Promise<JobListing[]> {
    let query = 'SELECT * FROM job_listings WHERE 1=1';
    const values = [];
    let index = 1;

    if (filters) {
      if (filters.category) {
        query += ` AND category = $${index}`;
        values.push(filters.category);
        index++;
      }
      if (filters.location) {
        query += ` AND location ILIKE $${index}`;
        values.push(`%${filters.location}%`);
        index++;
      }
      if (filters.search) {
        query += ` AND (title ILIKE $${index} OR description ILIKE $${index})`;
        values.push(`%${filters.search}%`);
        index++;
      }
    }

    query += ' ORDER BY created_at DESC';
    const result = await this.pool.query(query, values);
    return result.rows;
  }

  async createJobListing(jobListing: InsertJobListing): Promise<JobListing> {
    const { title, organization, location, description, requirements, salary, applicationDeadline, jobType, category, tags, source, sourceUrl, aiSummary } = jobListing;
    const result = await this.pool.query(
      `INSERT INTO job_listings (title, organization, location, description, requirements, salary, application_deadline, job_type, category, tags, source, source_url, ai_summary) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
       RETURNING *`,
      [title, organization, location, description, requirements, salary, applicationDeadline, jobType, category, tags, source, sourceUrl, aiSummary]
    );
    return result.rows[0];
  }

  async updateJobListing(id: number, updates: Partial<InsertJobListing>): Promise<JobListing | null> {
    const fields = [];
    const values = [];
    let index = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        fields.push(`${snakeKey} = $${index}`);
        values.push(value);
        index++;
      }
    }

    if (fields.length === 0) return this.getJobListing(id);

    values.push(id);
    const query = `UPDATE job_listings SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`;
    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  // Application operations (implement IStorage interface)
  async getApplications(userId: number): Promise<Application[]> {
    const result = await this.pool.query('SELECT * FROM applications WHERE user_id = $1 ORDER BY applied_at DESC', [userId]);
    return result.rows;
  }
  
  async getApplication(id: number): Promise<Application | null> {
    const result = await this.pool.query('SELECT * FROM applications WHERE id = $1', [id]);
    return result.rows[0] || null;
  }
  
  async getApplicationByUserAndJob(userId: number, jobId: number): Promise<Application | null> {
    const result = await this.pool.query('SELECT * FROM applications WHERE user_id = $1 AND job_id = $2', [userId, jobId]);
    return result.rows[0] || null;
  }

  async getUserApplications(userId: number): Promise<Application[]> {
    const result = await this.pool.query('SELECT * FROM applications WHERE user_id = $1 ORDER BY applied_at DESC', [userId]);
    return result.rows;
  }

  async createApplication(application: InsertApplication): Promise<Application> {
    const { userId, jobId, status, coverLetter, resumeUrl, interviewDate, notes } = application;
    const result = await this.pool.query(
      `INSERT INTO applications (user_id, job_id, status, cover_letter, resume_url, interview_date, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [userId, jobId, status || 'Pending', coverLetter, resumeUrl, interviewDate, notes]
    );
    return result.rows[0];
  }

  async updateApplication(id: number, updates: Partial<InsertApplication>): Promise<Application | null> {
    const fields = [];
    const values = [];
    let index = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        fields.push(`${snakeKey} = $${index}`);
        values.push(value);
        index++;
      }
    }

    if (fields.length === 0) return this.getApplication(id);

    values.push(id);
    const query = `UPDATE applications SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`;
    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  // Social link operations (implement IStorage interface)
  async getSocialLinks(userId: number): Promise<SocialLink[]> {
    const result = await this.pool.query('SELECT * FROM social_links WHERE user_id = $1', [userId]);
    return result.rows;
  }

  async createSocialLink(socialLink: InsertSocialLink): Promise<SocialLink> {
    const { userId, platform, url } = socialLink;
    const result = await this.pool.query(
      'INSERT INTO social_links (user_id, platform, url) VALUES ($1, $2, $3) RETURNING *',
      [userId, platform, url]
    );
    return result.rows[0];
  }

  async updateSocialLink(id: number, updates: Partial<InsertSocialLink>): Promise<SocialLink | undefined> {
    const fields = [];
    const values = [];
    let index = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fields.push(`${key} = $${index}`);
        values.push(value);
        index++;
      }
    }

    if (fields.length === 0) return undefined;

    values.push(id);
    const query = `UPDATE social_links SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`;
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async deleteSocialLink(id: number): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM social_links WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Document operations (implement IStorage interface)
  async getDocuments(userId: number): Promise<Document[]> {
    const result = await this.pool.query('SELECT * FROM documents WHERE user_id = $1', [userId]);
    return result.rows;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const { userId, type, name, url, size } = document;
    const result = await this.pool.query(
      'INSERT INTO documents (user_id, type, name, url, size) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, type, name, url, size]
    );
    return result.rows[0];
  }

  async updateDocument(id: number, updates: Partial<InsertDocument>): Promise<Document | undefined> {
    const fields = [];
    const values = [];
    let index = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fields.push(`${key} = $${index}`);
        values.push(value);
        index++;
      }
    }

    if (fields.length === 0) return undefined;

    values.push(id);
    const query = `UPDATE documents SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`;
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async deleteDocument(id: number): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM documents WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Event operations (implement IStorage interface)
  async getEvents(userId: number): Promise<Event[]> {
    const result = await this.pool.query('SELECT * FROM events WHERE user_id = $1 ORDER BY date ASC', [userId]);
    return result.rows;
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const { userId, title, description, date, type, location } = event;
    const result = await this.pool.query(
      'INSERT INTO events (user_id, title, description, date, type, location) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [userId, title, description, date, type, location]
    );
    return result.rows[0];
  }

  async updateEvent(id: number, updates: Partial<InsertEvent>): Promise<Event | null> {
    const fields = [];
    const values = [];
    let index = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fields.push(`${key} = $${index}`);
        values.push(value);
        index++;
      }
    }

    if (fields.length === 0) return null;

    values.push(id);
    const query = `UPDATE events SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`;
    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  async deleteEvent(id: number): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM events WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Chat message operations (implement IStorage interface)
  async getChatMessages(userId: number | null, sessionId?: string): Promise<ChatMessage[]> {
    let query = 'SELECT * FROM chat_messages WHERE ';
    const params = [];
    
    if (userId !== null) {
      query += 'user_id = $1';
      params.push(userId);
    } else if (sessionId) {
      query += 'session_id = $1';
      params.push(sessionId);
    } else {
      return [];
    }
    
    query += ' ORDER BY timestamp ASC';
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const { userId, sessionId, content, isFromUser, metadata } = message;
    const result = await this.pool.query(
      'INSERT INTO chat_messages (user_id, session_id, content, is_from_user, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, sessionId, content, isFromUser, metadata]
    );
    return result.rows[0];
  }
}