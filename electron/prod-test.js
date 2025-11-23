#!/usr/bin/env node
/**
 * Production mode tester
 * Runs the app in production-like mode without building
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting SmartSpace in production mode (test)...\n');

// Set environment to production-like but still in test mode
process.env.NODE_ENV = 'production';
process.env.ELECTRON_IS_DEV = '1'; // Keep this as dev to prevent auto-updater issues
process.env.ELECTRON_PROD_TEST = '1'; // Custom flag to indicate production test mode

// Build Next.js first
console.log('📦 Building Next.js for production...');
const buildProcess = spawn('npm', ['run', 'build'], {
  stdio: 'inherit',
  shell: true
});

buildProcess.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ Build failed with code', code);
    process.exit(code);
  }
  
  console.log('\n✅ Build complete!');
  console.log('🎯 Starting Electron in production mode...\n');
  
  // Start Next.js production server
  const nextProcess = spawn('npm', ['run', 'start'], {
    shell: true,
    env: { ...process.env, NODE_ENV: 'production' }
  });
  
  // Start Electron after a delay
  setTimeout(() => {
    const electronProcess = spawn('electron', ['.'], {
      stdio: 'inherit',
      shell: true,
      env: { 
        ...process.env, 
        NODE_ENV: 'production',
        ELECTRON_IS_DEV: '1', // Keep as dev to prevent auto-updater issues
        ELECTRON_PROD_TEST: '1' // Custom flag for production test mode
      }
    });
    
    electronProcess.on('close', (code) => {
      console.log('Electron closed with code', code);
      nextProcess.kill();
      process.exit(code);
    });
  }, 3000);
  
  // Handle termination
  process.on('SIGINT', () => {
    console.log('\nShutting down production test...');
    nextProcess.kill();
    process.exit();
  });
});

