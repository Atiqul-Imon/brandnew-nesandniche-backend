import fs from 'fs';
import path from 'path';

class Logger {
  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = this.getTimestamp();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };
    return JSON.stringify(logEntry) + '\n';
  }

  writeToFile(filename, content) {
    const filePath = path.join(this.logDir, filename);
    fs.appendFileSync(filePath, content);
  }

  log(level, message, meta = {}) {
    const formattedMessage = this.formatMessage(level, message, meta);
    
    // Console output
    const consoleMessage = `[${this.getTimestamp()}] ${level.toUpperCase()}: ${message}`;
    if (level === 'error') {
      console.error(consoleMessage);
    } else if (level === 'warn') {
      console.warn(consoleMessage);
    } else {
      console.log(consoleMessage);
    }

    // File output
    const filename = `${level}.log`;
    this.writeToFile(filename, formattedMessage);

    // Combined log file
    this.writeToFile('combined.log', formattedMessage);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, meta);
    }
  }

  // Request logging
  logRequest(req, res, next) {
    const start = Date.now();
    
    // Override the res.end method to capture the response
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      const duration = Date.now() - start;
      const logData = {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.userId || 'anonymous'
      };

      // Use console methods directly to avoid context issues
      if (res.statusCode >= 400) {
        console.warn('HTTP Request', logData);
      } else {
        console.log('HTTP Request', logData);
      }

      // Call the original end method
      originalEnd.call(this, chunk, encoding);
    };

    next();
  }

  // Database logging
  logDatabase(operation, collection, duration, success = true) {
    const message = `Database ${operation} on ${collection}`;
    const meta = {
      operation,
      collection,
      duration: `${duration}ms`,
      success
    };

    if (success) {
      this.debug(message, meta);
    } else {
      this.error(message, meta);
    }
  }

  // Authentication logging
  logAuth(action, userId, success = true, details = {}) {
    const message = `Authentication ${action}`;
    const meta = {
      action,
      userId,
      success,
      ...details
    };

    if (success) {
      this.info(message, meta);
    } else {
      this.warn(message, meta);
    }
  }
}

const logger = new Logger();

export default logger; 