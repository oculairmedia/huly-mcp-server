/**
 * Logger Module
 *
 * Provides structured logging with different levels and formats
 */

// Log levels with numeric values for comparison
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// ANSI color codes for terminal output
const COLORS = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
  reset: '\x1b[0m'   // Reset
};

// Log level emojis for better visibility
const LEVEL_EMOJIS = {
  debug: '🐛',
  info: '📘',
  warn: '⚠️',
  error: '❌'
};

export class Logger {
  constructor(name = 'default', options = {}) {
    this.name = name;
    this.level = LOG_LEVELS[options.level || 'info'];
    this.format = options.format || 'text';
    this.useColors = process.env.NO_COLOR !== '1' && process.stdout.isTTY;
    this.defaultContext = {};
  }

  /**
   * Log a debug message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  debug(message, context = {}) {
    this._log('debug', message, context);
  }

  /**
   * Log an info message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  info(message, context = {}) {
    this._log('info', message, context);
  }

  /**
   * Log a warning message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  warn(message, context = {}) {
    this._log('warn', message, context);
  }

  /**
   * Log an error message
   * @param {string} message - Log message
   * @param {Object|Error} context - Additional context or error object
   */
  error(message, context = {}) {
    // Handle Error objects specially
    if (context instanceof Error) {
      context = {
        error: {
          message: context.message,
          stack: context.stack,
          name: context.name,
          ...context
        }
      };
    }
    this._log('error', message, context);
  }

  /**
   * Create a child logger with additional context
   * @param {string} childName - Child logger name
   * @param {Object} defaultContext - Default context for all logs
   * @returns {Logger}
   */
  child(childName, defaultContext = {}) {
    const child = new Logger(`${this.name}:${childName}`, {
      level: Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === this.level),
      format: this.format
    });
    child.defaultContext = { ...this.defaultContext, ...defaultContext };
    child.useColors = this.useColors;
    return child;
  }

  /**
   * Internal logging method
   * @private
   */
  _log(level, message, context) {
    // Check if this level should be logged
    if (LOG_LEVELS[level] < this.level) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      logger: this.name,
      message,
      ...this.defaultContext,
      ...context
    };

    // Format and output based on configuration
    if (this.format === 'json') {
      this._outputJson(logEntry);
    } else {
      this._outputText(level, timestamp, message, context);
    }
  }

  /**
   * Output JSON formatted log
   * @private
   */
  _outputJson(logEntry) {
    console.log(JSON.stringify(logEntry));
  }

  /**
   * Output text formatted log
   * @private
   */
  _outputText(level, timestamp, message, context) {
    const parts = [];

    // Add timestamp
    parts.push(`[${timestamp}]`);

    // Add level with color and emoji
    const levelStr = level.toUpperCase().padEnd(5);
    if (this.useColors) {
      parts.push(`${COLORS[level]}${levelStr}${COLORS.reset}`);
    } else {
      parts.push(levelStr);
    }

    // Add emoji for better visibility
    parts.push(LEVEL_EMOJIS[level]);

    // Add logger name
    if (this.name !== 'default') {
      parts.push(`[${this.name}]`);
    }

    // Add message
    parts.push(message);

    // Add context if present
    if (Object.keys(context).length > 0) {
      // Remove default context from display
      const displayContext = { ...context };
      if (this.defaultContext) {
        Object.keys(this.defaultContext).forEach(key => {
          if (displayContext[key] === this.defaultContext[key]) {
            delete displayContext[key];
          }
        });
      }

      if (Object.keys(displayContext).length > 0) {
        parts.push('-');
        parts.push(JSON.stringify(displayContext, null, 2));
      }
    }

    // Output to appropriate stream
    const output = parts.join(' ');
    if (level === 'error') {
      console.error(output);
    } else {
      console.log(output);
    }
  }
}

// Singleton logger instance
let defaultLogger = null;

/**
 * Get or create the default logger instance
 * @param {Object} options - Logger options
 * @returns {Logger}
 */
export function getLogger(options = {}) {
  if (!defaultLogger) {
    defaultLogger = new Logger('default', options);
  }
  return defaultLogger;
}

/**
 * Create a logger with ConfigManager integration
 * @param {ConfigManager} configManager - Configuration manager instance
 * @returns {Logger}
 */
export function createLoggerWithConfig(configManager) {
  const options = {
    level: configManager.get('logging.level', 'info'),
    format: configManager.get('logging.format', 'text')
  };
  return new Logger('huly-mcp', options);
}

/**
 * Reset the default logger (mainly for testing)
 */
export function resetLogger() {
  defaultLogger = null;
}