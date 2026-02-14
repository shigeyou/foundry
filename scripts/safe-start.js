#!/usr/bin/env node
/**
 * Safe server start script
 * - Checks if port 3006 is in use
 * - Kills any process using the port
 * - Generates Prisma client if needed
 * - Starts the dev server
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 3006;
const PROJECT_ROOT = path.join(__dirname, '..');

function log(message) {
  console.log(`[safe-start] ${message}`);
}

function checkPort() {
  try {
    const result = execSync(`netstat -ano | findstr ":${PORT}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const lines = result.trim().split('\n').filter(line => line.includes('LISTENING'));
    if (lines.length > 0) {
      const parts = lines[0].trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      return parseInt(pid, 10);
    }
  } catch (e) {
    // Port not in use
  }
  return null;
}

function killProcess(pid) {
  try {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'pipe' });
    log(`Killed process ${pid}`);
    return true;
  } catch (e) {
    log(`Failed to kill process ${pid}: ${e.message}`);
    return false;
  }
}

function waitForPortRelease(maxWait = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    if (!checkPort()) {
      return true;
    }
    execSync('timeout /t 1 >nul', { shell: true, stdio: 'pipe' });
  }
  return false;
}

function checkPrismaClient() {
  const prismaClientPath = path.join(PROJECT_ROOT, 'src', 'generated', 'prisma');
  return fs.existsSync(prismaClientPath);
}

function generatePrisma() {
  log('Generating Prisma client...');
  try {
    execSync('npx prisma generate', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit'
    });
    return true;
  } catch (e) {
    log('Failed to generate Prisma client');
    return false;
  }
}

function cleanNextCache() {
  const lockPath = path.join(PROJECT_ROOT, '.next', 'dev', 'lock');
  if (fs.existsSync(lockPath)) {
    try {
      fs.unlinkSync(lockPath);
      log('Removed .next/dev/lock');
    } catch (e) {
      // Ignore
    }
  }
}

async function main() {
  log('Starting safe server startup...');

  // Step 1: Check and kill existing process on port
  const existingPid = checkPort();
  if (existingPid) {
    log(`Port ${PORT} is in use by PID ${existingPid}`);
    killProcess(existingPid);

    if (!waitForPortRelease()) {
      log('ERROR: Failed to release port. Please manually kill the process.');
      process.exit(1);
    }
    log(`Port ${PORT} is now free`);
  } else {
    log(`Port ${PORT} is available`);
  }

  // Step 2: Clean Next.js cache if needed
  cleanNextCache();

  // Step 3: Check/generate Prisma client
  if (!checkPrismaClient()) {
    if (!generatePrisma()) {
      process.exit(1);
    }
  }

  // Step 4: Start the dev server
  log(`Starting Next.js dev server on port ${PORT}...`);

  const server = spawn('npm', ['run', 'dev'], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    shell: true
  });

  server.on('error', (err) => {
    log(`Server error: ${err.message}`);
    process.exit(1);
  });

  server.on('exit', (code) => {
    if (code !== 0) {
      log(`Server exited with code ${code}`);
    }
    process.exit(code);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    log('Received SIGINT, shutting down...');
    server.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    log('Received SIGTERM, shutting down...');
    server.kill('SIGTERM');
  });
}

main().catch((err) => {
  log(`Error: ${err.message}`);
  process.exit(1);
});
