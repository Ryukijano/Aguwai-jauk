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
  type InsertChatMessage,
  type JobExternalClick,
  type InsertJobExternalClick,
  type ApplicationStatusHistory,
  type InsertApplicationStatusHistory,
  type Notification,
  type InsertNotification
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
      
      // Create job_external_clicks table if it doesn't exist
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS job_external_clicks (
          id SERIAL PRIMARY KEY,
          job_id INTEGER NOT NULL REFERENCES job_listings(id),
          user_id INTEGER REFERENCES users(id),
          clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create application_status_history table if it doesn't exist
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS application_status_history (
          id SERIAL PRIMARY KEY,
          application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
          status TEXT NOT NULL,
          note TEXT,
          changed_by INTEGER REFERENCES users(id),
          changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Normalize existing application statuses
      await this.pool.query(`
        UPDATE applications
        SET status = CASE
          WHEN LOWER(status) = 'pending' THEN 'pending'
          WHEN LOWER(status) = 'applied' THEN 'pending'
          WHEN LOWER(status) = 'interview' THEN 'shortlisted'
          WHEN LOWER(status) = 'shortlisted' THEN 'shortlisted'
          WHEN LOWER(status) = 'rejected' THEN 'rejected'
          WHEN LOWER(status) = 'accepted' THEN 'accepted'
          ELSE 'pending'
        END
      `);
      
      // Create initial status history for existing applications
      await this.pool.query(`
        INSERT INTO application_status_history (application_id, status, note)
        SELECT id, status, 'Initial status' FROM applications
        WHERE NOT EXISTS (
          SELECT 1 FROM application_status_history 
          WHERE application_id = applications.id
        )
      `);
      
      // Add new columns to documents table if they don't exist
      await this.pool.query(`
        ALTER TABLE documents 
        ADD COLUMN IF NOT EXISTS mime_type TEXT,
        ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS parsed_data TEXT
      `).catch(err => {
        console.log('Documents table columns might already exist:', err.message);
      });
      
      // Create notifications table if it doesn't exist
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          type TEXT NOT NULL,
          recipient TEXT NOT NULL,
          subject TEXT,
          payload TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          sent_at TIMESTAMP,
          error TEXT,
          attempts INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Add email_preferences column to users table if it doesn't exist
      await this.pool.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS email_preferences TEXT
      `).catch(err => {
        console.log('Email preferences column might already exist:', err.message);
      });
      
      // Create job_matches table if it doesn't exist
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS job_matches (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id INTEGER NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
          resume_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
          match_score INTEGER NOT NULL,
          match_reasons TEXT[],
          missing_qualifications TEXT[],
          strengths TEXT[],
          recommendation_level TEXT NOT NULL,
          match_data TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create index for faster lookups
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_job_matches_user_id 
        ON job_matches(user_id)
      `).catch(() => {});
      
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_job_matches_user_job 
        ON job_matches(user_id, job_id)
      `).catch(() => {});
      
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
    
    // Create a test user for easy login (development only)
    if (process.env.NODE_ENV !== 'production') {
      try {
        const testUser = await this.createUser({
          username: process.env.TEST_USERNAME || "testuser",
          password: process.env.TEST_PASSWORD_HASH || "$2a$10$K3X9H5WbKPvKjYv5UqjJu.KmZYRVYMZkF1Kc3hbcwLm0fMuPdPGXi", // default: "test123"
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
        console.log("Test user created for development environment");
      } catch (error) {
        console.log("Test user might already exist");
      }
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

  // Bulk application methods
  async bulkCreateApplications(applications: InsertApplication[]): Promise<{
    successes: Application[];
    failures: Array<{ jobId: number; error: string }>;
    skipped: Array<{ jobId: number; reason: string }>;
  }> {
    const successes: Application[] = [];
    const failures: Array<{ jobId: number; error: string }> = [];
    const skipped: Array<{ jobId: number; reason: string }> = [];

    for (const app of applications) {
      try {
        // Check if already applied
        const existing = await this.getApplicationByUserAndJob(app.userId, app.jobId);
        if (existing) {
          skipped.push({ jobId: app.jobId, reason: 'Already applied to this job' });
          continue;
        }

        // Check if job exists and is active
        const job = await this.getJobListing(app.jobId);
        if (!job) {
          failures.push({ jobId: app.jobId, error: 'Job not found' });
          continue;
        }
        
        if (!job.isActive) {
          failures.push({ jobId: app.jobId, error: 'Job is no longer active' });
          continue;
        }

        // Check if it's an external job (should not allow bulk apply)
        if (job.applicationLink) {
          failures.push({ jobId: app.jobId, error: 'Cannot bulk apply to external jobs' });
          continue;
        }

        // Create the application
        const created = await this.createApplication(app);
        successes.push(created);
        
        // Add a small delay for rate limiting (100ms between applications)
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        failures.push({ jobId: app.jobId, error: error.message || 'Failed to create application' });
      }
    }

    return { successes, failures, skipped };
  }

  async checkExistingApplications(userId: number, jobIds: number[]): Promise<number[]> {
    if (jobIds.length === 0) return [];
    
    try {
      const result = await this.pool.query(`
        SELECT job_id FROM applications 
        WHERE user_id = $1 AND job_id = ANY($2::int[])
      `, [userId, jobIds]);
      
      return result.rows.map(row => row.job_id);
    } catch (error) {
      console.error('Failed to check existing applications:', error);
      throw error;
    }
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
    const result = await this.pool.query('SELECT * FROM documents WHERE user_id = $1 ORDER BY uploaded_at DESC', [userId]);
    return result.rows.map(this.mapDocument);
  }
  
  async getDocumentById(id: number): Promise<Document | null> {
    const result = await this.pool.query('SELECT * FROM documents WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.mapDocument(result.rows[0]) : null;
  }
  
  async getUserResumes(userId: number): Promise<Document[]> {
    const result = await this.pool.query(
      `SELECT * FROM documents 
       WHERE user_id = $1 AND LOWER(type) = 'resume' 
       ORDER BY is_default DESC, uploaded_at DESC`,
      [userId]
    );
    return result.rows.map(this.mapDocument);
  }
  
  async setDefaultResume(userId: number, documentId: number): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // First, unset all default resumes for this user
      await client.query(
        `UPDATE documents SET is_default = FALSE 
         WHERE user_id = $1 AND LOWER(type) = 'resume'`,
        [userId]
      );
      
      // Then set the selected one as default
      const result = await client.query(
        `UPDATE documents SET is_default = TRUE 
         WHERE id = $1 AND user_id = $2 AND LOWER(type) = 'resume'
         RETURNING id`,
        [documentId, userId]
      );
      
      await client.query('COMMIT');
      return result.rows.length > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const { userId, type, name, url, size, mimeType, parsedData } = document;
    const result = await this.pool.query(
      `INSERT INTO documents (user_id, type, name, url, size, mime_type, parsed_data) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        userId, 
        type, 
        name, 
        url, 
        size,
        mimeType || null,
        parsedData || null
      ]
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
  
  async deleteUserDocument(userId: number, documentId: number): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM documents WHERE id = $1 AND user_id = $2',
      [documentId, userId]
    );
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

  // Helper methods
  private mapDocument(row: any): Document {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      name: row.name,
      url: row.url,
      size: row.size,
      mimeType: row.mime_type,
      isDefault: row.is_default,
      parsedData: row.parsed_data,
      uploadedAt: row.uploaded_at
    };
  }
  
  // Job external click tracking
  async trackJobExternalClick(click: InsertJobExternalClick): Promise<JobExternalClick> {
    const { jobId, userId } = click;
    const result = await this.pool.query(
      'INSERT INTO job_external_clicks (job_id, user_id) VALUES ($1, $2) RETURNING *',
      [jobId, userId]
    );
    return result.rows[0];
  }

  async getJobExternalClicks(jobId: number): Promise<JobExternalClick[]> {
    const result = await this.pool.query(
      'SELECT * FROM job_external_clicks WHERE job_id = $1 ORDER BY clicked_at DESC',
      [jobId]
    );
    return result.rows;
  }
  
  // Application status history methods
  async createStatusHistory(history: InsertApplicationStatusHistory): Promise<ApplicationStatusHistory> {
    const { applicationId, status, note, changedBy } = history;
    const result = await this.pool.query(
      'INSERT INTO application_status_history (application_id, status, note, changed_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [applicationId, status, note, changedBy]
    );
    return result.rows[0];
  }
  
  async getApplicationStatusHistory(applicationId: number): Promise<ApplicationStatusHistory[]> {
    const result = await this.pool.query(
      `SELECT ash.*, u.username, u.full_name 
       FROM application_status_history ash
       LEFT JOIN users u ON ash.changed_by = u.id
       WHERE ash.application_id = $1 
       ORDER BY ash.changed_at DESC`,
      [applicationId]
    );
    return result.rows.map(row => ({
      id: row.id,
      applicationId: row.application_id,
      status: row.status,
      note: row.note,
      changedBy: row.changed_by,
      changedAt: row.changed_at,
      changedByName: row.full_name || row.username
    }));
  }
  
  async updateApplicationStatus(applicationId: number, status: string, userId?: number, note?: string): Promise<Application | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Update the application status
      const updateResult = await client.query(
        'UPDATE applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [status, applicationId]
      );
      
      if (updateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      
      // Create status history entry
      await client.query(
        'INSERT INTO application_status_history (application_id, status, note, changed_by) VALUES ($1, $2, $3, $4)',
        [applicationId, status, note, userId]
      );
      
      await client.query('COMMIT');
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Notification methods
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const { userId, type, recipient, subject, payload, status, error, attempts } = notification;
    const result = await this.pool.query(
      'INSERT INTO notifications (user_id, type, recipient, subject, payload, status, error, attempts) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [userId, type, recipient, subject, payload, status || 'pending', error, attempts || 0]
    );
    return result.rows[0];
  }
  
  async getNotifications(userId: number): Promise<Notification[]> {
    const result = await this.pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }
  
  async updateNotificationStatus(id: number, status: string, sentAt?: Date, error?: string): Promise<Notification | null> {
    const fields = ['status = $2'];
    const values = [id, status];
    let index = 3;
    
    if (sentAt) {
      fields.push(`sent_at = $${index}`);
      values.push(sentAt);
      index++;
    }
    
    if (error !== undefined) {
      fields.push(`error = $${index}`);
      values.push(error);
      index++;
    }
    
    // Increment attempts if it's a failure
    if (status === 'failed') {
      fields.push('attempts = attempts + 1');
    }
    
    const query = `UPDATE notifications SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }
  
  // Email preferences methods
  async getUserEmailPreferences(userId: number): Promise<any> {
    const result = await this.pool.query(
      'SELECT email_preferences FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const preferences = result.rows[0].email_preferences;
    
    // Return parsed preferences or default if not set
    if (preferences) {
      try {
        return JSON.parse(preferences);
      } catch (e) {
        console.error('Failed to parse email preferences:', e);
        return {
          applicationUpdates: true,
          jobAlerts: true,
          interviewReminders: true,
          weeklyDigest: false,
          marketingEmails: false
        };
      }
    }
    
    // Return default preferences if none set
    return {
      applicationUpdates: true,
      jobAlerts: true,
      interviewReminders: true,
      weeklyDigest: false,
      marketingEmails: false
    };
  }
  
  async updateUserEmailPreferences(userId: number, preferences: any): Promise<boolean> {
    const preferencesJson = JSON.stringify(preferences);
    const result = await this.pool.query(
      'UPDATE users SET email_preferences = $1 WHERE id = $2',
      [preferencesJson, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }
  
  // Job match methods
  async saveJobMatches(userId: number, resumeId: number | null, matches: any[]): Promise<void> {
    // Clear existing matches for this user
    await this.clearUserJobMatches(userId);
    
    // Insert new matches
    for (const match of matches) {
      await this.pool.query(`
        INSERT INTO job_matches (
          user_id, job_id, resume_id, match_score, 
          match_reasons, missing_qualifications, strengths,
          recommendation_level, match_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        userId,
        match.jobId,
        resumeId,
        match.matchScore,
        match.matchReasons,
        match.missingQualifications,
        match.strengths,
        match.recommendationLevel,
        JSON.stringify(match)
      ]);
    }
  }
  
  async getJobMatches(userId: number): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT jm.*, jl.title, jl.organization, jl.location, jl.description, jl.category, jl.application_deadline
      FROM job_matches jm
      JOIN job_listings jl ON jm.job_id = jl.id
      WHERE jm.user_id = $1
      ORDER BY jm.match_score DESC
    `, [userId]);
    
    return result.rows.map(row => ({
      ...row,
      matchReasons: row.match_reasons || [],
      missingQualifications: row.missing_qualifications || [],
      strengths: row.strengths || []
    }));
  }
  
  async getJobMatchByUserAndJob(userId: number, jobId: number): Promise<any | null> {
    const result = await this.pool.query(`
      SELECT * FROM job_matches
      WHERE user_id = $1 AND job_id = $2
    `, [userId, jobId]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      ...row,
      matchReasons: row.match_reasons || [],
      missingQualifications: row.missing_qualifications || [],
      strengths: row.strengths || []
    };
  }
  
  async clearUserJobMatches(userId: number): Promise<void> {
    await this.pool.query(
      'DELETE FROM job_matches WHERE user_id = $1',
      [userId]
    );
  }
}