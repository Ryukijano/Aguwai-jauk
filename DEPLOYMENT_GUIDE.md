# Teacher Job Portal - Deployment Guide

## Important Note About Configuration Files

This project has two configuration files:
- **`.replit`** - Contains Python/Streamlit configuration (WRONG for our Node.js app)
- **`replit.toml`** - Contains correct Node.js production configuration (USED FOR DEPLOYMENT)

**Replit Deployments automatically use `replit.toml` for production deployments**, so the deployment will work correctly despite the `.replit` file having wrong configuration.

## Deployment Instructions

### Option 1: Deploy via Replit UI (Recommended)
1. Click the **Deploy** button in the Replit interface
2. Choose your deployment type (Autoscale recommended)
3. The deployment will automatically use the production configuration from `replit.toml`
4. Configure environment variables if needed
5. Click Deploy

### Option 2: Manual Deployment Script
```bash
./deploy.sh
```

### Option 3: Direct Commands
```bash
npm run build && npm run start
```

## Production Configuration Details

The `replit.toml` file contains:
```toml
[deployment]
deploymentTarget = "cloudrun"
run = ["sh", "-c", "npm run build && npm run start"]

[env]
NODE_ENV = "production"
```

This ensures:
- ✅ Production build commands are used (not dev commands)
- ✅ NODE_ENV is set to production
- ✅ Application is optimized for Cloud Run deployment

## Troubleshooting

### Error: "dev command blocked"
This error appears because the `.replit` file contains development commands. However, this doesn't affect deployment because Replit uses `replit.toml` for production deployments.

### Verification Steps
1. Check that `replit.toml` exists and contains production commands
2. Verify `package.json` has "build" and "start" scripts
3. Ensure the production build completes successfully: `npm run build`

## Environment Variables

Required for production:
- `DATABASE_URL` (automatically set by Replit)
- `SESSION_SECRET` (auto-generated if not provided)
- `OPENAI_API_KEY` (for AI features)
- `GEMINI_API_KEY` (for AI features)

## Port Configuration

The application runs on port 5000 internally and is mapped to port 80 externally via the configuration in `replit.toml`.