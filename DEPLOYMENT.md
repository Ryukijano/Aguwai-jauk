# Deployment Configuration for Teacher Job Portal

## Issue
The original deployment configuration in `.replit` uses `npm run dev` which is blocked in production environments with the error:
```
The run command 'npm run dev' contains 'dev' which is blocked for security reasons
Development server commands are not allowed in production deployments
```

## Production Scripts Available
The application already has proper production scripts configured in `package.json`:

- `npm run build` - Builds both frontend (Vite) and backend (esbuild) for production
- `npm run start` - Starts the production server from the built files

## Deployment Solutions Created

### 1. Docker Configuration (`Dockerfile`)
- Production-ready Docker container
- Builds application and runs in production mode
- Exposes port 5000

### 2. Cloud Run Configuration (`cloudbuild.yaml`)
- Google Cloud Build configuration for Cloud Run deployment
- Includes build, containerize, and deploy steps
- Configured for `us-central1` region

### 3. Alternative Configuration Files

#### `replit.toml`
Alternative Replit configuration with production commands:
```toml
[deployment]
deploymentTarget = "cloudrun"
run = ["sh", "-c", "npm run build && npm run start"]
```

#### `production.sh`
Bash script for production deployment:
- Sets NODE_ENV=production
- Runs build process
- Starts production server
- Includes error handling

#### `start-production.js`
Node.js script for production startup:
- Programmatic build and start process
- Better error handling and logging

## Recommended Deployment Commands

For Replit deployment, use one of these commands instead of `npm run dev`:

1. **Direct production commands**: `npm run build && npm run start`
2. **Using production script**: `./production.sh`
3. **Using Node.js script**: `node start-production.js`

## Environment Variables Required
- `NODE_ENV=production` (automatically set by production scripts)
- `OPENAI_API_KEY` - For AI functionality
- `GEMINI_API_KEY` - For Google Gemini AI
- `DATABASE_URL` - PostgreSQL connection (already configured)
- `SESSION_SECRET` - For secure sessions (auto-generated if not provided)

## Port Configuration
- Application runs on port 5000 in production
- Configured to accept connections from 0.0.0.0 (required for cloud deployment)

## Next Steps
Since the `.replit` file cannot be modified directly, the deployment configuration needs to be updated through Replit's interface to use one of the production commands above instead of `npm run dev`.