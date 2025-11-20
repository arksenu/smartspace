const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const isDev = require('electron-is-dev');

class NextServer {
  constructor() {
    this.serverProcess = null;
    this.port = 3004;
    this.baseUrl = `http://localhost:${this.port}`;
  }

  async findAvailablePort(startPort = 3004) {
    return new Promise((resolve, reject) => {
      const server = http.createServer();
      server.listen(startPort, () => {
        const port = server.address().port;
        server.close(() => resolve(port));
      });
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          this.findAvailablePort(startPort + 1).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });
    });
  }

  async start() {
    try {
      // Find available port
      this.port = await this.findAvailablePort(this.port);
      this.baseUrl = `http://localhost:${this.port}`;

      if (isDev) {
        // In development, Next.js dev server should already be running
        console.log('Development mode: Assuming Next.js dev server is running');
        return this.baseUrl;
      }

      // In production, start Next.js server
      const nextPath = path.join(__dirname, '..', '.next', 'standalone');
      const serverPath = path.join(nextPath, 'server.js');

      // Check if standalone build exists, otherwise use regular build
      const fs = require('fs');
      const serverExists = fs.existsSync(serverPath);
      
      if (!serverExists) {
        // Use regular Next.js start command
        const projectRoot = path.join(__dirname, '..');
        this.serverProcess = spawn('node', ['node_modules/.bin/next', 'start', '-p', this.port.toString()], {
          cwd: projectRoot,
          stdio: 'inherit',
          env: { ...process.env, PORT: this.port.toString() }
        });
      } else {
        // Use standalone server
        this.serverProcess = spawn('node', [serverPath], {
          cwd: nextPath,
          stdio: 'inherit',
          env: { ...process.env, PORT: this.port.toString() }
        });
      }

      // Wait for server to be ready
      await this.waitForServer();

      return this.baseUrl;
    } catch (error) {
      console.error('Failed to start Next.js server:', error);
      throw error;
    }
  }

  async waitForServer(maxAttempts = 30) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const checkServer = () => {
        attempts++;
        const req = http.get(this.baseUrl, (res) => {
          if (res.statusCode === 200 || res.statusCode === 404) {
            // Server is responding
            resolve();
          } else {
            if (attempts < maxAttempts) {
              setTimeout(checkServer, 1000);
            } else {
              reject(new Error('Server did not become ready in time'));
            }
          }
        });

        req.on('error', () => {
          if (attempts < maxAttempts) {
            setTimeout(checkServer, 1000);
          } else {
            reject(new Error('Server did not become ready in time'));
          }
        });

        req.setTimeout(2000, () => {
          req.destroy();
          if (attempts < maxAttempts) {
            setTimeout(checkServer, 1000);
          } else {
            reject(new Error('Server did not become ready in time'));
          }
        });
      };

      checkServer();
    });
  }

  async stop() {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  getPort() {
    return this.port;
  }
}

module.exports = NextServer;
