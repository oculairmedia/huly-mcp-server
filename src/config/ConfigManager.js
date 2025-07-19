/**
 * Configuration Manager
 *
 * Centralized configuration management with environment variable support
 */

export class ConfigManager {
  constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  /**
   * Load configuration from environment variables with defaults
   * @returns {Object} Configuration object
   */
  loadConfiguration() {
    return {
      // Server configuration
      server: {
        name: process.env.MCP_SERVER_NAME || 'huly-mcp-server',
        version: process.env.MCP_SERVER_VERSION || '1.0.0',
        description:
          process.env.MCP_SERVER_DESCRIPTION || 'MCP server for Huly project management platform',
      },

      // Huly connection configuration
      huly: {
        url: process.env.HULY_URL || 'https://pm.oculair.ca',
        email: process.env.HULY_EMAIL || process.env.HULY_MCP_EMAIL,
        password: process.env.HULY_PASSWORD || process.env.HULY_MCP_PASSWORD,
        workspace: process.env.HULY_WORKSPACE || process.env.HULY_MCP_WORKSPACE,
      },

      // Transport configuration
      transport: {
        defaultType: process.env.DEFAULT_TRANSPORT || 'stdio',
        http: {
          port: parseInt(process.env.PORT || process.env.HTTP_PORT || '3457', 10),
          cors: {
            enabled: process.env.CORS_ENABLED !== 'false',
            origin: process.env.CORS_ORIGIN || '*',
          },
        },
      },

      // Protocol configuration
      protocol: {
        version: process.env.MCP_PROTOCOL_VERSION || '2024-11-05',
      },

      // Logging configuration
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'text',
      },

      // Features configuration
      features: {
        connectionPooling: process.env.ENABLE_CONNECTION_POOLING === 'true',
        retryOnError: process.env.ENABLE_RETRY === 'true',
        maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10) || 3,
      },

      // Defaults and limits
      defaults: {
        issueListLimit: parseInt(process.env.DEFAULT_ISSUE_LIMIT || '50', 10),
        commentListLimit: parseInt(process.env.DEFAULT_COMMENT_LIMIT || '50', 10),
        searchResultLimit: parseInt(process.env.DEFAULT_SEARCH_LIMIT || '50', 10),
        priority: process.env.DEFAULT_PRIORITY || 'medium',
      },

      // Validation patterns
      validation: {
        projectIdentifierMaxLength: parseInt(process.env.PROJECT_ID_MAX_LENGTH || '5', 10),
        maxTitleLength: parseInt(process.env.MAX_TITLE_LENGTH || '255', 10),
        maxDescriptionLength: parseInt(process.env.MAX_DESCRIPTION_LENGTH || '10000', 10),
      },
    };
  }

  /**
   * Validate configuration for required fields and correct types
   * @throws {Error} If configuration is invalid
   */
  validateConfiguration() {
    // Validate Huly credentials
    if (!this.config.huly.email || !this.config.huly.password) {
      throw new Error(
        'Huly credentials are required. Set HULY_EMAIL/HULY_MCP_EMAIL and HULY_PASSWORD/HULY_MCP_PASSWORD environment variables.'
      );
    }

    // Validate workspace
    if (!this.config.huly.workspace) {
      throw new Error(
        'Huly workspace is required. Set HULY_WORKSPACE or HULY_MCP_WORKSPACE environment variable.'
      );
    }

    // Validate port number
    if (
      isNaN(this.config.transport.http.port) ||
      this.config.transport.http.port < 1 ||
      this.config.transport.http.port > 65535
    ) {
      throw new Error(
        `Invalid HTTP port: ${this.config.transport.http.port}. Must be between 1 and 65535.`
      );
    }

    // Validate limits
    const limits = [
      { name: 'issueListLimit', value: this.config.defaults.issueListLimit },
      { name: 'commentListLimit', value: this.config.defaults.commentListLimit },
      { name: 'searchResultLimit', value: this.config.defaults.searchResultLimit },
    ];

    for (const limit of limits) {
      if (isNaN(limit.value) || limit.value < 1 || limit.value > 1000) {
        throw new Error(`Invalid ${limit.name}: ${limit.value}. Must be between 1 and 1000.`);
      }
    }
  }

  /**
   * Get the full configuration object
   * @returns {Object}
   */
  getConfig() {
    return this.config;
  }

  /**
   * Get a specific configuration value by path
   * @param {string} path - Dot-separated path (e.g., 'huly.url')
   * @param {*} defaultValue - Default value if path not found
   * @returns {*}
   */
  get(path, defaultValue = undefined) {
    const keys = path.split('.');
    let value = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  /**
   * Check if a feature is enabled
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  isFeatureEnabled(feature) {
    return this.config.features[feature] === true;
  }

  /**
   * Get server info for MCP protocol
   * @returns {Object}
   */
  getServerInfo() {
    return {
      name: this.config.server.name,
      version: this.config.server.version,
    };
  }

  /**
   * Get Huly connection configuration
   * @returns {Object}
   */
  getHulyConfig() {
    return { ...this.config.huly };
  }

  /**
   * Get transport configuration
   * @returns {Object}
   */
  getTransportConfig() {
    return { ...this.config.transport };
  }

  /**
   * Get default values
   * @returns {Object}
   */
  getDefaults() {
    return { ...this.config.defaults };
  }

  /**
   * Get validation rules
   * @returns {Object}
   */
  getValidationRules() {
    return { ...this.config.validation };
  }
}

// Singleton instance
let configManagerInstance = null;

/**
 * Get or create the ConfigManager singleton instance
 * @returns {ConfigManager}
 */
export function getConfigManager() {
  if (!configManagerInstance) {
    configManagerInstance = new ConfigManager();
  }
  return configManagerInstance;
}

/**
 * Reset the singleton instance (mainly for testing)
 */
export function resetConfigManager() {
  configManagerInstance = null;
}
