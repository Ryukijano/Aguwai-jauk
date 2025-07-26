#!/usr/bin/env node

// Production startup script
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Starting production build and server...');

// Set production environment variables
process.env.NODE_ENV = 'production';

// Build the application first
console.log('Building application...');
const buildProcess = spawn('npm', ['run', 'build'], {
  stdio: 'inherit',
  cwd: __dirname
});

buildProcess.on('close', (code) => {
  if (code !== 0) {
    console.error(`Build process failed with code ${code}`);
    process.exit(1);
  }
  
  console.log('Build completed successfully. Starting server...');
  
  // Start the production server
  const serverProcess = spawn('npm', ['run', 'start'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  serverProcess.on('close', (serverCode) => {
    process.exit(serverCode);
  });
});