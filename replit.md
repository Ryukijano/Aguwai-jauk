# Teacher Job Portal - Assam

## Overview
An AI-powered job portal specifically designed for teachers in Assam, featuring intelligent job matching, application tracking, and an advanced AI assistant with multi-agent capabilities.

## Project Architecture

### Frontend (React + TypeScript)
- **Framework**: React with TypeScript, Vite build system
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack Query for server state
- **Styling**: Tailwind CSS with shadcn/ui components
- **Authentication**: Session-based auth with protected routes

### Backend (Express + TypeScript)
- **Server**: Express.js with TypeScript
- **Authentication**: Passport.js with local strategy
- **Session Management**: express-session with in-memory storage
- **AI Integration**: 
  - OpenAI GPT-4o for conversational AI and analysis
  - Google Gemini for multimodal capabilities and resume analysis
  - Advanced agent system with function calling for job search, resume analysis, and interview prep

### AI Assistant Features (as of July 25, 2025)
- **Fixed Popup Widget**: AI chat appears as a fixed popup at bottom-right of screen
- **Multi-Agent System**: 
  - Job search agent with real-time filtering
  - Resume analysis with strengths/weaknesses identification
  - Interview preparation with tailored questions
  - Application tracking capabilities
- **Dual AI Models**: Uses both OpenAI and Google Gemini for enhanced capabilities
- **Session-based History**: Maintains conversation context across sessions

## Recent Changes

### July 25, 2025
- Transformed AI assistant from page element to fixed popup widget
- Integrated Google Gemini API for enhanced AI capabilities
- Implemented advanced agent system with function calling:
  - `search_jobs`: Searches teaching positions by location, type, category, keywords
  - `analyze_resume`: Provides detailed resume analysis with match scores
  - `prepare_interview`: Generates role-specific interview questions and tips
  - `track_application`: Tracks job application status (pending implementation)
- Added smooth animations and minimization feature to AI popup
- Removed vision and speech capabilities to focus on text-based assistance

## User Preferences
- Clean, modern UI with professional appearance
- Mobile-responsive design
- Focus on practical features for job seekers
- AI assistant should be easily accessible but not intrusive

## Key Features
1. **Dashboard**: Overview of job listings, applications, and AI insights
2. **Job Listings**: Browse and filter teaching positions
3. **Application Tracking**: Monitor application status
4. **AI Assistant**: Advanced conversational AI with job search capabilities
5. **Profile Management**: Update personal and professional information
6. **Calendar Integration**: Track important dates and interviews
7. **Document Management**: Store resumes and certificates

## Environment Variables Required
- `OPENAI_API_KEY`: For OpenAI GPT-4o integration
- `GEMINI_API_KEY`: For Google Gemini AI capabilities
- `SESSION_SECRET`: For secure session management (auto-generated if not provided)

## Development Guidelines
- Use the existing shadcn components for consistency
- Follow the established TypeScript patterns
- Maintain mobile-first responsive design
- Keep AI responses helpful and contextual to teaching jobs in Assam