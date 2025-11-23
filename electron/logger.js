const fs = require('fs');
const path = require('path');
const util = require('util');

class Logger {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.logToFile = options.logToFile || false;
    this.logDir = options.logDir || path.join(__dirname, '..', 'logs');
    this.prefix = options.prefix || '[App]';
    
    if (this.logToFile && this.enabled) {
      this.initFileLogging();
    }
  }
  
  initFileLogging() {
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    // Create log file with timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    this.logFile = path.join(this.logDir, `electron-${timestamp}.log`);
    
    // Create write stream
    this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
    
    console.log(`[Logger] Logging to file: ${this.logFile}`);
  }
  
  formatMessage(level, args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => 
      typeof arg === 'object' ? util.inspect(arg, { depth: 3 }) : arg
    ).join(' ');
    
    return `[${timestamp}] ${this.prefix} [${level}] ${message}`;
  }
  
  writeToFile(message) {
    if (this.logToFile && this.logStream) {
      this.logStream.write(message + '\n');
    }
  }
  
  log(...args) {
    if (!this.enabled) return;
    
    const message = this.formatMessage('INFO', args);
    console.log(message);
    this.writeToFile(message);
  }
  
  info(...args) {
    this.log(...args);
  }
  
  warn(...args) {
    if (!this.enabled) return;
    
    const message = this.formatMessage('WARN', args);
    console.warn(message);
    this.writeToFile(message);
  }
  
  error(...args) {
    if (!this.enabled) return;
    
    const message = this.formatMessage('ERROR', args);
    console.error(message);
    this.writeToFile(message);
  }
  
  debug(...args) {
    if (!this.enabled) return;
    
    const message = this.formatMessage('DEBUG', args);
    console.log(message);
    this.writeToFile(message);
  }
  
  close() {
    if (this.logStream) {
      this.logStream.end();
    }
  }
}

module.exports = Logger;

