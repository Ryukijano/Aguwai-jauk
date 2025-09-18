# Teacher Job Portal - Assam

## Overview
An AI-powered job portal specifically designed for teachers in Assam, featuring intelligent job matching, application tracking, and an advanced AI assistant with page-aware context similar to Perplexity's Comet assistant.

## Project Architecture

### Frontend (React + TypeScript)
- **Framework**: React with TypeScript, Vite build system
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack Query for server state
- **Styling**: Tailwind CSS with shadcn/ui components
- **Authentication**: Session-based auth with protected routes
- **Context System**: AIPageContextProvider for page-aware AI assistance

### Backend (Express + TypeScript)
- **Server**: Express.js with TypeScript
- **Authentication**: Passport.js with local strategy
- **Session Management**: express-session with in-memory storage
- **AI Integration**: 
  - OpenAI GPT-4o for conversational AI and analysis
  - Google Gemini for multimodal capabilities and resume analysis
  - Advanced agent system with function calling for job search, resume analysis, and interview prep
  - Page-aware context system for contextual AI responses

### AI Assistant Features (as of September 18, 2025)
- **Page-Aware Context System**: AI knows which page you're viewing and provides contextual responses
  - Automatically detects current page (Dashboard, Jobs, JobDetails, Applications, etc.)
  - Sees visible content, filters, and selections on each page
  - Creates new conversation threads on page transitions to prevent stale context
  - Header displays current page context for transparency
- **Fixed Popup Widget**: AI chat appears as a fixed popup at bottom-right of screen
- **Advanced Multi-Agent System with LangGraph Orchestration & Google ADK Patterns**: 
  - **Supervisor Agent**: Intelligently routes requests to specialized agents using OpenAI GPT-4o
  - **Resume Analyzer Agent**: Enhanced with Google's ADK patterns - multi-stage analysis, confidence scoring, qualification breakdown, career roadmap
  - **Job Search Agent**: Enhanced with intelligent filtering, market analysis, strategic insights, and salary range extraction
  - **Interview Prep Agent**: Enhanced with comprehensive preparation framework, demo lesson planning, cultural considerations
  - **Conversational Agent**: Enhanced with context awareness, topic analysis, and personalized recommendations
- **Google ADK Implementation**: 
  - **TaskResult Structure**: Structured response handling with confidence scores and metadata
  - **Multi-Stage Analysis**: Progressive analysis with weighted scoring matrices
  - **Fallback Strategies**: Intelligent error handling with graceful degradation
  - **Context Enhancement**: Personalized responses based on user history and preferences
- **Dual AI Models**: 
  - **OpenAI GPT-4o**: For conversational AI, supervisor decisions, and interview preparation
  - **Google Gemini 2.5 Flash**: For resume analysis with ADK framework patterns
- **LangGraph Integration**: 
  - Stateful multi-agent orchestration with memory persistence
  - Thread-based conversation management
  - Short-term memory (thread-scoped) and long-term memory (user profile)
  - Context-aware responses based on user history
- **Session-based History**: Maintains conversation context across sessions with enhanced memory store

## Recent Changes

### September 18, 2025 - Page-Aware Context System Implementation
- **Page Context Publishing**: Implemented `useAIContextPublisher` hook across all pages
  - Each page publishes its route, content summary, filters, and selections
  - Context updates automatically with 500ms debouncing for performance
  - Includes visible jobs, applications, documents with summaries
- **AI Context Provider**: Created `AIPageContextProvider` to manage context state
  - Wraps entire application for consistent context availability
  - Provides context to AI chat popup and backend
- **Backend Context Processing**: Enhanced AI routes to receive and process page context
  - Context included in every chat message for awareness
  - Creates new threads on page transitions to prevent stale responses
  - Supervisor agent routes based on current page context
- **Thread Management Fix**: Resolved context caching issues
  - New conversation threads created when navigating between pages
  - Prevents AI from using outdated context from previous pages
  - Ensures fresh, accurate responses for current page
- **Authentication Fixes**: Resolved component crashes for unauthenticated users
  - Added graceful error handling for 401 responses
  - Pages load properly without authentication
  - Test account configured: username: ryukijano, password: test123

### September 16, 2025 - Professional Visual Enhancement & Business Optimization
- **Professional Image Integration**: Generated and integrated 5 high-quality AI images throughout the application
  - Hero section classroom scene showcasing teachers in action
  - Feature icons for job search, AI assistant, and application tracking
  - Educational background pattern for visual depth
- **Landing Page Redesign**: Created comprehensive landing page with modern, business-ready design
  - Hero section with compelling CTAs and professional imagery
  - Statistics section showcasing 4,500+ vacancies and 27 districts
  - Feature cards highlighting platform capabilities
  - Testimonials from successful teachers
  - Footer with quick links and subscription option
- **Routing Enhancement**: Fixed registration route to properly display dedicated signup form
- **Business Optimization**: Application now production-ready with:
  - Real job data from government sources (11+ live positions)
  - Professional visual design optimized for conversion
  - Responsive layout for mobile and desktop users
  - Clear value proposition as a free platform for teachers

### July 30, 2025 - Google ADK Pattern Enhancement
- **Enhanced Gemini Agent with Google ADK Patterns**: 
  - Implemented TaskResult structure for sophisticated response handling
  - Added multi-stage resume analysis with confidence scoring
  - Enhanced qualification breakdown with weighted scoring (Education 30%, Experience 25%, etc.)
  - Added career roadmap generation (immediate, short-term, long-term actions)
  - Implemented competitive analysis and market positioning
- **Enhanced All Agents with ADK Framework**:
  - Job Search Agent: Added intelligent location fuzzy matching, market analysis, salary range extraction
  - Interview Prep Agent: Added comprehensive question banks, demo lesson planning, cultural tips
  - Conversational Agent: Added topic analysis, sentiment detection, contextual recommendations
- **Improved Error Handling**: All agents now have intelligent fallback strategies
- **Better Insights**: Each agent provides metadata with sources, insights, and recommendations

### July 28, 2025 - Advanced Multi-Agent System Implementation
- **LangGraph Integration**: Implemented comprehensive multi-agent orchestration using LangGraph
  - Created supervisor agent for intelligent routing between specialized agents
  - Resume analyzer agent using Google's ADK framework with Gemini 2.5 Flash
  - Job search agent with context-aware filtering
  - Interview preparation agent with role-specific questions
  - Conversational agent for general assistance
- **Memory Management**: Implemented dual-layer memory system
  - Thread-level memory for conversation continuity
  - User-level memory for long-term preferences and history
  - Resume analysis history tracking
  - Search history persistence
- **API Integration**: 
  - Successfully integrated both OpenAI (GPT-4o) and Google Gemini (2.5 Flash) APIs
  - Implemented proper error handling for rate limits
  - Added context enhancement for personalized responses
- **Architecture Update**: 
  - Created `server/agents/langgraph-orchestrator.ts` for multi-agent orchestration
  - Created `server/agents/memory-store.ts` for memory management
  - Updated AI routes to use new multi-agent system
  - Maintained backward compatibility with existing endpoints

## User Preferences
- Clean, modern UI with professional appearance
- Mobile-responsive design
- Focus on practical features for job seekers
- AI assistant should be easily accessible but not intrusive
- Page-aware context for relevant AI assistance

## Key Features
1. **Professional Landing Page**: Modern homepage with hero section, features showcase, and testimonials
2. **Dashboard**: Overview of job listings, applications, and AI insights
3. **Job Listings**: Browse and filter teaching positions with real government job data
4. **Application Tracking**: Monitor application status
5. **AI Assistant with Page Context**: Knows what you're viewing and provides contextual help
6. **Profile Management**: Update personal and professional information
7. **Calendar Integration**: Track important dates and interviews
8. **Document Management**: Store resumes and certificates

## Environment Variables Required
- `OPENAI_API_KEY`: For OpenAI GPT-4o integration
- `GEMINI_API_KEY`: For Google Gemini AI capabilities
- `SESSION_SECRET`: For secure session management (auto-generated if not provided)

## Development Guidelines
- Use the existing shadcn components for consistency
- Follow the established TypeScript patterns
- Maintain mobile-first responsive design
- Keep AI responses helpful and contextual to teaching jobs in Assam
- Ensure page context is properly published for AI awareness