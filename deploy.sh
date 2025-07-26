#!/bin/bash
# Production deployment script with error handling

echo "Starting production deployment..."

# Set NODE_ENV to production
export NODE_ENV=production

# Build the application
echo "Building application..."
npm run build

# Check if build was successful
if [ $? -ne 0 ]; then
    echo "Build failed! Exiting..."
    exit 1
fi

# Start the production server
echo "Starting production server..."
npm run start