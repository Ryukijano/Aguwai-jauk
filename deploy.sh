#!/bin/bash

# Production deployment script for Teacher Job Portal Assam
# Handles build and start with comprehensive error handling

set -e  # Exit on any error

echo "🚀 Starting production deployment for Teacher Job Portal..."

# Set production environment variables
export NODE_ENV=production
export PORT=5000

# Check if required commands exist
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed or not in PATH"
    exit 1
fi

echo "📦 Installing dependencies..."
npm ci --production=false

echo "🏗️  Building the application..."
if ! npm run build; then
    echo "❌ Build failed! Check the build logs above."
    echo "Common issues:"
    echo "  - TypeScript compilation errors"
    echo "  - Missing dependencies"
    echo "  - Build process configuration problems"
    exit 1
fi

echo "✅ Build completed successfully!"

# Check if dist directory exists
if [ ! -d "dist" ]; then
    echo "❌ Build output directory 'dist' not found!"
    exit 1
fi

echo "🚀 Starting the production server..."
if ! npm run start; then
    echo "❌ Failed to start the production server!"
    echo "Check if:"
    echo "  - Port 5000 is available"
    echo "  - Database connection is working"
    echo "  - All required environment variables are set"
    exit 1
fi

echo "✅ Production server started successfully on port 5000!"