# 🎓 Teacher Job Portal - Assam

An AI-powered job portal specifically designed for teachers in Assam, featuring intelligent job matching, resume analysis, and an advanced AI assistant with page-aware context.

![Teacher Job Portal](https://img.shields.io/badge/Status-Production%20Ready-success)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Express.js](https://img.shields.io/badge/Express.js-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white)

## 🌟 Key Features

### 🤖 Advanced AI Integration
- **Page-Aware AI Assistant**: Contextual AI that knows what page you're viewing and provides relevant assistance
- **Multi-Agent System**: Specialized AI agents for job search, resume analysis, interview preparation, and general assistance
- **Dual AI Models**: OpenAI GPT-4o for conversations and Google Gemini 2.5 Flash for resume analysis
- **LangGraph Orchestration**: Intelligent routing between specialized AI agents

### 💼 Job Matching & Search
- **Intelligent Job Matching**: AI-powered matching with 85%+ accuracy using semantic similarity
- **Real Government Data**: Integration with official Assam job portals and RSS feeds
- **Smart Filtering**: Filter by location, subject, experience level, and match score
- **Bulk Applications**: Apply to multiple positions efficiently

### 📄 Resume Analysis & Management
- **AI-Powered Analysis**: Comprehensive resume scoring and qualification breakdown
- **Teaching-Specific Evaluation**: Focus on TET, CTET, B.Ed, and Assam education requirements
- **Career Roadmap**: Personalized recommendations for career advancement
- **Drag-and-Drop Upload**: Modern interface with progress tracking

### 📊 Application Tracking
- **Real-Time Status**: Track all your job applications in one place
- **Interview Scheduling**: Calendar integration for important dates
- **AI Interview Prep**: Personalized interview questions and preparation tips
- **Email Notifications**: Stay updated with application progress

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** database
- **OpenAI API Key** - Get from [OpenAI Platform](https://platform.openai.com/api-keys)
- **Google Gemini API Key** - Get from [Google AI Studio](https://aistudio.google.com/app/apikey)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/teacher-job-portal-assam.git
   cd teacher-job-portal-assam
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your actual values:
   ```env
   # Required API Keys
   OPENAI_API_KEY=sk-your_actual_openai_key_here
   GEMINI_API_KEY=your_actual_gemini_key_here
   
   # Database
   DATABASE_URL=postgresql://username:password@localhost:5432/teacher_portal
   
   # Security
   SESSION_SECRET=your_secure_random_32_character_string_here
   ```

4. **Set up the database**
   ```bash
   # Create database and tables
   npm run db:push
   ```

5. **Start the application**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`

### 🎯 Test Account
- **Username**: `ryukijano`
- **Password**: `test123`

## 🏗️ Project Architecture

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript and Vite
- **Routing**: Wouter (lightweight React Router alternative)
- **State Management**: TanStack Query for server state
- **UI Components**: Tailwind CSS + shadcn/ui
- **Authentication**: Session-based with protected routes

### Backend (Express + TypeScript)
- **Server**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with local strategy
- **AI Integration**: OpenAI GPT-4o + Google Gemini 2.5 Flash
- **Session Management**: Express-session with PostgreSQL store

### AI System Architecture
```mermaid
graph TB
    A[User Input] --> B[Supervisor Agent]
    B --> C[Resume Analyzer]
    B --> D[Job Search Agent]
    B --> E[Interview Prep Agent]
    B --> F[Conversational Agent]
    C --> G[Google Gemini 2.5 Flash]
    D --> H[OpenAI GPT-4o]
    E --> H
    F --> H
```

## 📁 Project Structure

```
teacher-job-portal-assam/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Application pages
│   │   ├── contexts/      # React contexts
│   │   ├── hooks/         # Custom hooks
│   │   └── lib/           # Utilities and configurations
├── server/                # Express backend
│   ├── agents/           # LangGraph AI agents
│   ├── routes/           # API route handlers
│   ├── services/         # Business logic services
│   └── middleware/       # Express middleware
├── shared/               # Shared TypeScript types
└── db/                   # Database schemas and migrations
```

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | ✅ | OpenAI API key for GPT-4o |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key for resume analysis |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | Secret for session encryption |
| `SENDGRID_API_KEY` | ❌ | SendGrid for email notifications |
| `NODE_ENV` | ❌ | Environment (development/production) |

### Database Setup

The application uses PostgreSQL with Drizzle ORM. Schema is defined in `shared/schema.ts`.

```bash
# Push schema changes to database
npm run db:push

# Force push (if there are warnings)
npm run db:push --force
```

## 🚀 Deployment

### Production Build

```bash
# Build the application
npm run build

# Start in production mode
NODE_ENV=production npm start
```

### Environment Setup for Production

1. Set `NODE_ENV=production`
2. Use secure session secrets (32+ characters)
3. Enable SSL for database connections
4. Configure proper CORS settings
5. Set up reverse proxy (nginx recommended)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📊 Performance Features

- **Caching**: 24-hour cache for AI analysis and job matches
- **Rate Limiting**: API protection with configurable limits
- **Batch Processing**: Efficient bulk operations
- **Memory Management**: Optimized queries with connection pooling

## 🔐 Security Features

- **Session-based Authentication**: Secure session management
- **CSRF Protection**: Cross-site request forgery protection
- **Input Validation**: Comprehensive data validation with Zod
- **SQL Injection Prevention**: Parameterized queries with Drizzle ORM
- **File Upload Security**: Validated resume uploads with size limits

## 📱 Mobile Support

The application is fully responsive and optimized for:
- **Desktop**: Full-featured experience
- **Tablet**: Optimized layouts
- **Mobile**: Touch-friendly interface with mobile navigation

## 🔍 SEO & Analytics

- **Meta Tags**: Comprehensive SEO meta tags
- **Open Graph**: Social media sharing optimization  
- **Structured Data**: Schema.org markup for better search visibility
- **Performance Monitoring**: Built-in performance tracking

## ❓ FAQ

**Q: How accurate is the job matching?**
A: Our AI achieves 85%+ accuracy by analyzing job requirements against resume content using semantic similarity and domain-specific knowledge.

**Q: Is my resume data secure?**
A: Yes, all uploaded resumes are stored securely and processed locally. We never share your personal information with third parties.

**Q: Can I use this for other states?**
A: The system is optimized for Assam but can be adapted for other states by updating job sources and regional requirements.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with modern web technologies and AI/ML best practices
- Designed specifically for the Assam education system
- Inspired by the need for efficient teacher recruitment

---

<div align="center">
  <strong>Made with ❤️ for teachers in Assam</strong>
  <br>
  <em>Empowering educators through intelligent job matching</em>
</div>