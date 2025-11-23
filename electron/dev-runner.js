#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

// ANSI color codes for better log separation
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

console.log(`${colors.cyan}${colors.bright}
╔════════════════════════════════════════════════════════════════════╗
║                     SmartSpace Electron Dev Mode                   ║
╚════════════════════════════════════════════════════════════════════╝
${colors.reset}`);

console.log(`${colors.yellow}Starting development servers...${colors.reset}\n`);

// Start Next.js dev server
console.log(`${colors.blue}[NEXT.JS]${colors.reset} Starting Next.js dev server on port 3004...`);
const nextProcess = spawn('npm', ['run', 'dev'], {
  shell: true,
  env: { ...process.env, FORCE_COLOR: '1' }
});

// Start Electron after a delay
let electronProcess = null;
let electronStarted = false;

// Wait for Next.js to be ready
const checkNextReady = () => {
  const http = require('http');
  http.get('http://localhost:3004', (res) => {
    if (res.statusCode === 200 || res.statusCode === 404) {
      if (!electronStarted) {
        electronStarted = true;
        console.log(`\n${colors.green}[ELECTRON]${colors.reset} Next.js is ready, starting Electron...`);
        startElectron();
      }
    }
  }).on('error', () => {
    setTimeout(checkNextReady, 1000);
  });
};

setTimeout(checkNextReady, 3000);

function startElectron() {
  electronProcess = spawn('electron', ['.'], {
    shell: true,
    env: { ...process.env, ELECTRON_IS_DEV: '1', FORCE_COLOR: '1' }
  });

  // Handle Electron output
  electronProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.log(`${colors.green}[ELECTRON]${colors.reset} ${line}`);
    });
  });

  electronProcess.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      // Check if it's a warning or error
      if (line.includes('Warning') || line.includes('warning')) {
        console.log(`${colors.yellow}[ELECTRON]${colors.reset} ${line}`);
      } else {
        console.log(`${colors.red}[ELECTRON ERROR]${colors.reset} ${line}`);
      }
    });
  });

  electronProcess.on('close', (code) => {
    console.log(`\n${colors.red}[ELECTRON]${colors.reset} Process exited with code ${code}`);
    cleanup();
  });
}

// Handle Next.js output
nextProcess.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    // Color-code different types of Next.js messages
    if (line.includes('ready') || line.includes('started')) {
      console.log(`${colors.blue}[NEXT.JS]${colors.reset} ${colors.green}${line}${colors.reset}`);
    } else if (line.includes('compiled') || line.includes('building')) {
      console.log(`${colors.blue}[NEXT.JS]${colors.reset} ${colors.cyan}${line}${colors.reset}`);
    } else if (line.includes('warn') || line.includes('Warning')) {
      console.log(`${colors.blue}[NEXT.JS]${colors.reset} ${colors.yellow}${line}${colors.reset}`);
    } else if (line.includes('error') || line.includes('Error')) {
      console.log(`${colors.blue}[NEXT.JS]${colors.reset} ${colors.red}${line}${colors.reset}`);
    } else if (line.includes('GET') || line.includes('POST') || line.includes('PUT') || line.includes('DELETE')) {
      // API route logs
      console.log(`${colors.blue}[NEXT.JS API]${colors.reset} ${line}`);
    } else {
      console.log(`${colors.blue}[NEXT.JS]${colors.reset} ${line}`);
    }
  });
});

nextProcess.stderr.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    if (line.includes('Warning') || line.includes('warning')) {
      console.log(`${colors.yellow}[NEXT.JS WARN]${colors.reset} ${line}`);
    } else {
      console.log(`${colors.red}[NEXT.JS ERROR]${colors.reset} ${line}`);
    }
  });
});

// Handle process termination
function cleanup() {
  console.log(`\n${colors.yellow}Shutting down...${colors.reset}`);
  
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill();
  }
  
  if (nextProcess && !nextProcess.killed) {
    nextProcess.kill();
  }
  
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

nextProcess.on('close', (code) => {
  console.log(`\n${colors.red}[NEXT.JS]${colors.reset} Process exited with code ${code}`);
  cleanup();
});

// Keep the process alive
process.stdin.resume();
