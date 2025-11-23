const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const { app } = require('electron');
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
      const fs = require('fs');
      let nextPath;
      let serverPath;

      if (app.isPackaged) {
        // In production, use the standalone build from extraResources (outside ASAR)
        nextPath = path.join(process.resourcesPath, 'standalone');
        serverPath = path.join(nextPath, 'server.js');
        
        console.log('Production mode - checking for standalone server');
        console.log('Resource path:', process.resourcesPath);
        console.log('Next path:', nextPath);
        console.log('Server path:', serverPath);
      } else {
        // In development (not packaged), use the local standalone build
        nextPath = path.join(__dirname, '..', '.next', 'standalone');
        serverPath = path.join(nextPath, 'server.js');
        
        console.log('Development mode - checking for standalone server');
        console.log('Next path:', nextPath);
        console.log('Server path:', serverPath);
      }

      // Check if standalone build exists
      const serverExists = fs.existsSync(serverPath);
      console.log('Server exists:', serverExists);

      if (!serverExists) {
        const errorMsg = `Next.js standalone server not found at: ${serverPath}
Please ensure you've built the Next.js app with 'npm run build' before packaging.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      // Use the standalone server
      // Use fork to run the server in a separate Node.js process
      const { fork } = require('child_process');
      
      console.log('Starting Next.js standalone server...');
      this.serverProcess = fork(serverPath, [], {
        cwd: nextPath,
        stdio: 'inherit',
        env: {
          ...process.env,
          PORT: this.port.toString(),
          HOSTNAME: 'localhost',
          NODE_ENV: 'production'
        },
        // Important: Set execArgv to empty array to avoid inheriting Electron's arguments
        execArgv: []
      });

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
