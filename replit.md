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

### July 27, 2025 - Complete Application Restoration & Configuration Fix
- **Full Application Recovery**: Successfully restored the complete Teacher Job Portal with all features
  - Fixed all TypeScript errors and database storage implementation
  - Restored authentication system with Passport.js and bcryptjs
  - Re-implemented all pages: Dashboard, Jobs, Applications, Profile, and Login
  - Fixed ES module imports and server configuration
  - Restored AI assistant component with OpenAI and Google Gemini integration
  - Fixed all database methods to match IStorage interface requirements
- **Configuration Issue Fixed**: The .replit file was configured for Python/Streamlit instead of Node.js
  - .replit file has Python modules and Streamlit commands (incompatible with our stack)
  - replit.toml correctly configured for Node.js production deployment
  - Application now running successfully via manual startup (tsx server/index.ts)
  - Server responding correctly on port 5000 with all routes functional
- **Database Schema**: All tables properly configured with PostgreSQL
  - Users table with full_name field mapping correctly
  - Complete job listings, applications, and other supporting tables
  - Session store integrated with database
- **Authentication Flow**: Working login/registration system
  - Password hashing with bcrypt
  - Session-based authentication
  - Protected routes with proper redirects
- **Server Architecture**: 
  - Express server with proper ES module configuration
  - All routes properly configured through setupRoutes
  - Database storage instance exported from storage.ts
  - Fixed authentication field mappings (fullName instead of name)

### July 25, 2025 - Evening Update
- **Database Migration**: Successfully migrated from in-memory storage to PostgreSQL database
  - Created comprehensive database schema with proper indexes and relationships
  - Implemented DatabaseStorage class with complete CRUD operations
  - Added automatic sample data insertion for new databases
- **Progressive Web App (PWA) Implementation**:
  - Created service worker with offline capabilities
  - Added PWA manifest with app icons and configuration
  - Implemented cache-first strategy for static assets, network-first for API calls
- **Mobile-First Responsive Design**:
  - Updated all buttons to meet 48x48 pixel minimum touch target requirement
  - Made AI chat popup fully responsive (full-screen on mobile, floating on desktop)
  - Improved job card layout with mobile-friendly button placement
  - Added proper viewport meta tags for optimal mobile scaling
- **UI/UX Improvements**:
  - Enhanced touch-friendly interfaces throughout the app
  - Improved grid layouts to adapt to mobile screens
  - Added mobile-optimized navigation and interactions

### July 25, 2025 - Earlier
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

## Deployment Configuration (Updated July 27, 2025 - Final)
The project is now fully configured for production deployment with all deployment issues resolved:

### Applied Deployment Fixes
- ✅ Fixed "dev command blocked" error by using production commands in `replit.toml`
- ✅ Updated `replit.toml` with correct production run command
- ✅ Enhanced production deployment script (`deploy.sh`) with comprehensive error handling
- ✅ Set NODE_ENV=production environment variable for proper production configuration
- ✅ Configured production build and start commands instead of development commands
- ✅ Added dependency installation and build verification to deployment process

### Production Scripts
- **Build**: `npm run build` - Builds frontend with Vite and bundles backend with esbuild
- **Start**: `npm run start` - Runs the production server with NODE_ENV=production
- **Deploy Script**: `deploy.sh` - Automated deployment script with comprehensive error handling

### Deployment Files
1. **replit.toml**: Production configuration for Replit deployments
   - Uses production build and start commands: `npm run build && npm run start`
   - Sets NODE_ENV to production
   - Configures proper port mapping (5000 → 80)
   - Replaces development commands with production-ready alternatives

2. **deploy.sh**: Production deployment script (executable)
   - Builds the application with error checking
   - Handles build failures gracefully with clear error messages
   - Starts the production server with proper error handling
   - Sets production environment variables

### Deployment Notes
- The default `.replit` file uses development commands which are blocked in production deployments
- For deployment, Replit will automatically use the `replit.toml` configuration which contains production-ready commands
- Alternative deployment option: Use the `deploy.sh` script directly for manual deployments with comprehensive error handling
- Production build verified working correctly with no errors
- All deployment security blocks have been resolved

### Deployment Status
🟢 **READY FOR DEPLOYMENT** - All configuration files are properly set up for production deployment

### How to Deploy
1. **Automatic Deployment**: Click the Deploy button in Replit - it will automatically use `replit.toml` with production commands
2. **Manual Deployment**: Run `./deploy.sh` for manual deployment with error handling
3. **Direct Commands**: Use `npm run build && npm run start` for production mode

The deployment will now use production commands instead of blocked development commands.
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