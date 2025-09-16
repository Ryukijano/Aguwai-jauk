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
    // Real job listings from Assam teacher recruitment
    const sampleJobs = [
      {
        title: "Assistant Teacher - Lower Primary (2900 Posts)",
        organization: "Directorate of Elementary Education (DEE), Assam",
        location: "Various Districts",
        description: "DEE Assam is recruiting 2900 Assistant Teachers for Lower Primary Schools across various districts. This is a large-scale government recruitment drive for teachers with TET qualification.",
        requirements: "Age: 18-40 years as of 01.01.2025\nQualification: HSSLC + D.El.Ed (2 years) or equivalent\nMust have qualified ATET or CTET\nPermanent resident of Assam\nSmall Family Norm applicable",
        salary: "₹14,000 - ₹70,000 (Pay Band-2) + Grade Pay",
        application_deadline: new Date("2025-04-08"),
        job_type: "Full-time",
        category: "Government",
        tags: ["Lower Primary", "TET Required", "D.El.Ed", "Government Job", "Mass Recruitment"],
        source: "DEE Assam Official",
        source_url: "https://dee.assam.gov.in/",
        ai_summary: "Major government recruitment for 2900 LP teacher positions. Excellent opportunity for TET-qualified candidates with job security and government benefits."
      },
      {
        title: "Assistant Teacher - Upper Primary (1600 Posts)",
        organization: "Directorate of Elementary Education (DEE), Assam",
        location: "Various Districts",
        description: "DEE Assam is recruiting 1600 teachers for Upper Primary Schools including Assistant Teachers, Science Teachers, and Hindi Teachers. Part of the 4500 posts mega recruitment drive.",
        requirements: "Age: 18-40 years as of 01.01.2025\nQualification: Bachelor's degree + B.Ed or equivalent\nMust have qualified ATET or CTET\nSubject-specific requirements for Science/Hindi teachers\nPermanent resident of Assam",
        salary: "₹14,000 - ₹70,000 (Pay Band-2) + Grade Pay",
        application_deadline: new Date("2025-04-08"),
        job_type: "Full-time",
        category: "Government",
        tags: ["Upper Primary", "TET Required", "B.Ed", "Science Teacher", "Hindi Teacher"],
        source: "DEE Assam Official",
        source_url: "https://dee.assam.gov.in/",
        ai_summary: "1600 UP teacher positions available. Includes specialized roles for Science and Hindi teachers. Merit-based selection with excellent career prospects."
      },
      {
        title: "Graduate Teacher (TGT) - 8004 Posts",
        organization: "Directorate of Secondary Education (DSE), Assam",
        location: "All Districts of Assam",
        description: "DSE Assam has announced recruitment for 8004 Graduate Teacher positions for various subjects. Written exam scheduled for January 19, 2025. This is one of the largest teacher recruitment drives in Assam.",
        requirements: "Bachelor's degree in relevant subject + B.Ed\nMust have qualified TET\nAge: 18-40 years\nSubject-wise vacancies available\nMust be permanent resident of Assam",
        salary: "₹14,000 - ₹70,000 + allowances as per 7th Pay Commission",
        application_deadline: new Date("2025-01-15"),
        job_type: "Full-time",
        category: "Government",
        tags: ["Graduate Teacher", "TGT", "Secondary Education", "Written Exam", "8000+ Posts"],
        source: "DSE Assam",
        source_url: "https://formsrec.in/DSE_Gr/",
        ai_summary: "Massive recruitment of 8004 Graduate Teachers. Written exam on Jan 19, 2025. Excellent opportunity for B.Ed qualified candidates."
      },
      {
        title: "Post Graduate Teacher (PGT) - 1385 Posts",
        organization: "Directorate of Secondary Education (DSE), Assam",
        location: "All Districts of Assam",
        description: "DSE Assam is recruiting 1385 Post Graduate Teachers for Higher Secondary schools. Positions available for various subjects including Physics, Chemistry, Mathematics, English, Economics, etc.",
        requirements: "Master's degree in relevant subject + B.Ed\nMust have qualified TET\nAge: 18-40 years\nMinimum 55% marks in Post Graduation\nSubject expertise required",
        salary: "₹14,000 - ₹70,000 + allowances as per 7th Pay Commission",
        application_deadline: new Date("2025-01-15"),
        job_type: "Full-time",
        category: "Government",
        tags: ["Post Graduate Teacher", "PGT", "Higher Secondary", "Master's Degree", "1385 Posts"],
        source: "DSE Assam",
        source_url: "https://formsrec.in/DSE_Gr/",
        ai_summary: "1385 PGT positions for Higher Secondary schools. Requires Master's degree and B.Ed. Higher pay scale for PG teachers."
      },
      {
        title: "Mathematics Teacher - Secondary School",
        organization: "Jawahar Navodaya Vidyalaya, Jorhat",
        location: "Jorhat",
        description: "JNV Jorhat requires an experienced Mathematics teacher for classes 9-12. CBSE curriculum experience preferred. Residential facility available on campus.",
        requirements: "M.Sc Mathematics + B.Ed\nMinimum 3 years teaching experience\nCBSE experience preferred\nComputer skills required\nAge limit: 35 years",
        salary: "₹47,600 - ₹1,51,100 (Level 8)",
        application_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        job_type: "Full-time",
        category: "Central Government",
        tags: ["Mathematics", "JNV", "CBSE", "Residential", "Secondary"],
        source: "NVS Official",
        source_url: "https://navodaya.gov.in",
        ai_summary: "Prestigious JNV position with residential facility. Central government job with excellent benefits and career growth."
      },
      {
        title: "English Teacher - Primary Section",
        organization: "Army Public School, Tezpur",
        location: "Tezpur",
        description: "Army Public School Tezpur invites applications for Primary English Teacher. Preference to army dependents. Strong communication skills required.",
        requirements: "BA English + B.Ed\nTET qualified mandatory\nExcellent English communication\nCreative teaching methods\nAge: 21-35 years",
        salary: "₹35,000 - ₹50,000",
        application_deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        job_type: "Full-time",
        category: "Defence",
        tags: ["English", "Primary", "Army School", "TET", "Communication Skills"],
        source: "AWES",
        source_url: "https://aps-csb.in",
        ai_summary: "Army school position with preference to defence dependents. Good work environment and facilities."
      },
      {
        title: "Science Teacher (Biology) - Higher Secondary",
        organization: "Cotton University Demonstration School",
        location: "Guwahati",
        description: "Cotton University Demonstration School seeks Biology teacher for Higher Secondary classes. Research opportunities available through university collaboration.",
        requirements: "M.Sc Botany/Zoology + B.Ed\nNET/SLET preferred\nLab management skills\nResearch interest beneficial\nAge limit: 40 years",
        salary: "₹57,700 - ₹1,82,400",
        application_deadline: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        job_type: "Full-time",
        category: "University",
        tags: ["Biology", "Higher Secondary", "Research", "University", "Lab Work"],
        source: "Cotton University",
        source_url: "https://cottonuniversity.ac.in",
        ai_summary: "University school position with research opportunities. Excellent academic environment and growth prospects."
      },
      {
        title: "Computer Science Teacher",
        organization: "Delhi Public School, Guwahati",
        location: "Guwahati",
        description: "DPS Guwahati requires Computer Science teacher for senior classes. Should be proficient in Python, Java, and web technologies. Smart classroom experience preferred.",
        requirements: "B.Tech/MCA + B.Ed\nProgramming expertise required\nSmart classroom experience\nCBSE curriculum knowledge\nAge: Below 35 years",
        salary: "₹45,000 - ₹65,000",
        application_deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        job_type: "Full-time",
        category: "Private",
        tags: ["Computer Science", "Programming", "CBSE", "Technology", "DPS"],
        source: "DPS Guwahati",
        source_url: "https://dpsguwahati.in",
        ai_summary: "Premium school with modern infrastructure. Focus on technology education and innovation."
      }
    ];

    for (const job of sampleJobs) {
      await this.createJobListing(job);
    }
    
    // Create a test user for easy login
    try {
      const testUser = await this.createUser({
        username: "testuser",
        password: "$2a$10$K3X9H5WbKPvKjYv5UqjJu.KmZYRVYMZkF1Kc3hbcwLm0fMuPdPGXi", // password: "test123"
        email: "test@example.com",
        fullName: "Test Teacher",
        bio: "Experienced teacher looking for opportunities in Assam",
        phone: "9876543210",
        address: "Guwahati, Assam",
        experience: "5 years of teaching experience in CBSE schools",
        education: "M.Sc Mathematics, B.Ed from Gauhati University",
        skills: ["Mathematics", "Physics", "Computer Science"],
        preferredLocations: ["Guwahati", "Tezpur", "Jorhat"]
      });
      console.log("Test user created - Username: testuser, Password: test123");
    } catch (error) {
      console.log("Test user might already exist");
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

  // Alias for scraper compatibility
  async getJobs(): Promise<JobListing[]> {
    return this.getAllJobs();
  }

  // Get job by external ID for duplicate checking
  async getJobByExternalId(externalId: string): Promise<JobListing | null> {
    const result = await this.pool.query('SELECT * FROM job_listings WHERE external_id = $1', [externalId]);
    return result.rows[0] || null;
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
    const { title, organization, location, description, requirements, salary, applicationDeadline, jobType, category, tags, source, sourceUrl, aiSummary, externalId, isActive, applicationLink } = jobListing;
    const result = await this.pool.query(
      `INSERT INTO job_listings (title, organization, location, description, requirements, salary, application_deadline, job_type, category, tags, source, source_url, ai_summary, external_id, is_active, application_link) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
       RETURNING *`,
      [title, organization, location, description, requirements, salary, applicationDeadline, jobType, category, tags, source, sourceUrl, aiSummary, externalId, isActive !== false, applicationLink]
    );
    return result.rows[0];
  }

  // Alias for scraper compatibility
  async createJob(job: InsertJobListing): Promise<JobListing> {
    return this.createJobListing(job);
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