enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

class Logger {
  private log(level: LogLevel, message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta,
    };

    // In production, send to logging service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to logging service (Datadog, CloudWatch, etc.)
    }

    // Console output for development
    console[level](JSON.stringify(logEntry));
  }

  debug(message: string, meta?: any) {
    this.log(LogLevel.DEBUG, message, meta);
  }

  info(message: string, meta?: any) {
    this.log(LogLevel.INFO, message, meta);
  }

  warn(message: string, meta?: any) {
    this.log(LogLevel.WARN, message, meta);
  }

  error(message: string, error?: Error, meta?: any) {
    this.log(LogLevel.ERROR, message, {
      ...meta,
      error: error?.message,
      stack: error?.stack,
    });
  }
}

export const logger = new Logger();
