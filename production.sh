#!/bin/bash

# Production deployment script
echo "Starting production deployment..."

# Set production environment
export NODE_ENV=production

# Build the application
echo "Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "Build failed!"
    exit 1
fi

echo "Build completed successfully."

# Start the production server
echo "Starting production server..."
npm run start