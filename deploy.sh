#!/bin/bash

# Production deployment script for Teacher Job Portal Assam
# Handles build and start with error handling

set -e  # Exit on any error

echo "Starting production deployment..."

# Set production environment
export NODE_ENV=production

echo "Building the application..."
if ! npm run build; then
    echo "❌ Build failed! Check the build logs above."
    exit 1
fi

echo "✅ Build completed successfully!"

echo "Starting the production server..."
if ! npm run start; then
    echo "❌ Failed to start the production server!"
    exit 1
fi

echo "✅ Production server started successfully!"