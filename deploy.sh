#!/bin/bash

# Enhanced deployment script with comprehensive error handling
set -e

echo "🚀 Starting deployment process..."

# Set production environment
export NODE_ENV=production

echo "📦 Installing dependencies..."
if ! npm install; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "🔨 Building application..."
if ! npm run build; then
    echo "❌ Build failed. Please check your code for errors."
    echo "Common issues:"
    echo "  - TypeScript compilation errors"
    echo "  - Missing dependencies"
    echo "  - Invalid imports or exports"
    exit 1
fi

echo "✅ Build completed successfully"

echo "🌟 Starting production server..."
if ! npm run start; then
    echo "❌ Failed to start production server"
    echo "Check for:"
    echo "  - Port conflicts"
    echo "  - Database connection issues"
    echo "  - Missing environment variables"
    exit 1
fi

echo "🎉 Deployment completed successfully!"