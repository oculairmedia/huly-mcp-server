/**
 * Tests for ConfigManager
 */

import { ConfigManager, getConfigManager, resetConfigManager } from '../ConfigManager.js';

describe('ConfigManager', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    // Reset singleton before each test
    resetConfigManager();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should load configuration with environment variables', () => {
      process.env.HULY_EMAIL = 'test@example.com';
      process.env.HULY_PASSWORD = 'testpass';
      process.env.HULY_WORKSPACE = 'testworkspace';
      process.env.LOG_LEVEL = 'debug';
      process.env.PORT = '4567';

      const config = new ConfigManager();

      expect(config.get('huly.email')).toBe('test@example.com');
      expect(config.get('huly.password')).toBe('testpass');
      expect(config.get('huly.workspace')).toBe('testworkspace');
      expect(config.get('logging.level')).toBe('debug');
      expect(config.get('transport.http.port')).toBe(4567);
    });

    it('should use defaults when environment variables are not set', () => {
      process.env.HULY_EMAIL = 'test@example.com';
      process.env.HULY_PASSWORD = 'testpass';
      process.env.HULY_WORKSPACE = 'testworkspace';

      const config = new ConfigManager();

      expect(config.get('server.name')).toBe('huly-mcp-server');
      expect(config.get('server.version')).toBe('1.0.0');
      expect(config.get('transport.defaultType')).toBe('stdio');
      expect(config.get('transport.http.port')).toBe(3457);
      expect(config.get('logging.level')).toBe('info');
      expect(config.get('defaults.issueListLimit')).toBe(50);
    });

    it('should support both HULY_ and HULY_MCP_ prefixes', () => {
      process.env.HULY_MCP_EMAIL = 'mcp@example.com';
      process.env.HULY_MCP_PASSWORD = 'mcppass';
      process.env.HULY_MCP_WORKSPACE = 'mcpworkspace';

      const config = new ConfigManager();

      expect(config.get('huly.email')).toBe('mcp@example.com');
      expect(config.get('huly.password')).toBe('mcppass');
      expect(config.get('huly.workspace')).toBe('mcpworkspace');
    });

    it('should prefer HULY_ over HULY_MCP_ prefix', () => {
      process.env.HULY_EMAIL = 'huly@example.com';
      process.env.HULY_MCP_EMAIL = 'mcp@example.com';
      process.env.HULY_PASSWORD = 'hulypass';
      process.env.HULY_MCP_PASSWORD = 'mcppass';
      process.env.HULY_WORKSPACE = 'testworkspace';

      const config = new ConfigManager();

      expect(config.get('huly.email')).toBe('huly@example.com');
      expect(config.get('huly.password')).toBe('hulypass');
    });
  });

  describe('validateConfiguration', () => {
    it('should throw error if email is missing', () => {
      process.env.HULY_PASSWORD = 'testpass';
      process.env.HULY_WORKSPACE = 'testworkspace';

      expect(() => new ConfigManager()).toThrow('Huly credentials are required');
    });

    it('should throw error if password is missing', () => {
      process.env.HULY_EMAIL = 'test@example.com';
      process.env.HULY_WORKSPACE = 'testworkspace';

      expect(() => new ConfigManager()).toThrow('Huly credentials are required');
    });

    it('should throw error if workspace is missing', () => {
      process.env.HULY_EMAIL = 'test@example.com';
      process.env.HULY_PASSWORD = 'testpass';

      expect(() => new ConfigManager()).toThrow('Huly workspace is required');
    });

    it('should throw error for invalid port number', () => {
      process.env.HULY_EMAIL = 'test@example.com';
      process.env.HULY_PASSWORD = 'testpass';
      process.env.HULY_WORKSPACE = 'testworkspace';
      process.env.PORT = '99999';

      expect(() => new ConfigManager()).toThrow('Invalid HTTP port: 99999');
    });

    it('should throw error for invalid limits', () => {
      process.env.HULY_EMAIL = 'test@example.com';
      process.env.HULY_PASSWORD = 'testpass';
      process.env.HULY_WORKSPACE = 'testworkspace';
      process.env.DEFAULT_ISSUE_LIMIT = '2000';

      expect(() => new ConfigManager()).toThrow('Invalid issueListLimit: 2000');
    });
  });

  describe('get', () => {
    beforeEach(() => {
      process.env.HULY_EMAIL = 'test@example.com';
      process.env.HULY_PASSWORD = 'testpass';
      process.env.HULY_WORKSPACE = 'testworkspace';
    });

    it('should get nested configuration values', () => {
      const config = new ConfigManager();

      expect(config.get('huly.url')).toBe('https://pm.oculair.ca');
      expect(config.get('transport.http.cors.enabled')).toBe(true);
      expect(config.get('features.connectionPooling')).toBe(false);
    });

    it('should return default value for non-existent paths', () => {
      const config = new ConfigManager();

      expect(config.get('non.existent.path', 'default')).toBe('default');
      expect(config.get('huly.nonexistent', null)).toBe(null);
    });

    it('should handle partial paths', () => {
      const config = new ConfigManager();

      const hulyConfig = config.get('huly');
      expect(hulyConfig).toHaveProperty('email', 'test@example.com');
      expect(hulyConfig).toHaveProperty('workspace', 'testworkspace');
    });
  });

  describe('isFeatureEnabled', () => {
    beforeEach(() => {
      process.env.HULY_EMAIL = 'test@example.com';
      process.env.HULY_PASSWORD = 'testpass';
      process.env.HULY_WORKSPACE = 'testworkspace';
    });

    it('should return true for enabled features', () => {
      process.env.ENABLE_CONNECTION_POOLING = 'true';
      process.env.ENABLE_RETRY = 'true';

      const config = new ConfigManager();

      expect(config.isFeatureEnabled('connectionPooling')).toBe(true);
      expect(config.isFeatureEnabled('retryOnError')).toBe(true);
    });

    it('should return false for disabled features', () => {
      const config = new ConfigManager();

      expect(config.isFeatureEnabled('connectionPooling')).toBe(false);
      expect(config.isFeatureEnabled('retryOnError')).toBe(false);
    });
  });

  describe('getters', () => {
    beforeEach(() => {
      process.env.HULY_EMAIL = 'test@example.com';
      process.env.HULY_PASSWORD = 'testpass';
      process.env.HULY_WORKSPACE = 'testworkspace';
    });

    it('should get server info', () => {
      const config = new ConfigManager();
      const serverInfo = config.getServerInfo();

      expect(serverInfo).toEqual({
        name: 'huly-mcp-server',
        version: '1.0.0',
      });
    });

    it('should get Huly configuration', () => {
      const config = new ConfigManager();
      const hulyConfig = config.getHulyConfig();

      expect(hulyConfig).toEqual({
        url: 'https://pm.oculair.ca',
        email: 'test@example.com',
        password: 'testpass',
        workspace: 'testworkspace',
      });
    });

    it('should get transport configuration', () => {
      const config = new ConfigManager();
      const transportConfig = config.getTransportConfig();

      expect(transportConfig).toHaveProperty('defaultType', 'stdio');
      expect(transportConfig).toHaveProperty('http.port', 3457);
    });

    it('should get defaults', () => {
      const config = new ConfigManager();
      const defaults = config.getDefaults();

      expect(defaults).toEqual({
        issueListLimit: 50,
        commentListLimit: 50,
        searchResultLimit: 50,
        priority: 'medium',
      });
    });

    it('should get validation rules', () => {
      const config = new ConfigManager();
      const validation = config.getValidationRules();

      expect(validation).toEqual({
        projectIdentifierMaxLength: 5,
        maxTitleLength: 255,
        maxDescriptionLength: 10000,
      });
    });

    it('should return copies of configuration objects', () => {
      const config = new ConfigManager();

      const hulyConfig1 = config.getHulyConfig();
      const hulyConfig2 = config.getHulyConfig();

      hulyConfig1.email = 'modified@example.com';

      expect(hulyConfig2.email).toBe('test@example.com');
    });
  });

  describe('singleton', () => {
    beforeEach(() => {
      process.env.HULY_EMAIL = 'test@example.com';
      process.env.HULY_PASSWORD = 'testpass';
      process.env.HULY_WORKSPACE = 'testworkspace';
    });

    it('should return the same instance', () => {
      const config1 = getConfigManager();
      const config2 = getConfigManager();

      expect(config1).toBe(config2);
    });

    it('should reset singleton instance', () => {
      const config1 = getConfigManager();
      resetConfigManager();
      const config2 = getConfigManager();

      expect(config1).not.toBe(config2);
    });

    it('should maintain state across calls', () => {
      process.env.LOG_LEVEL = 'debug';

      const config1 = getConfigManager();
      expect(config1.get('logging.level')).toBe('debug');

      // Change env after first instantiation
      process.env.LOG_LEVEL = 'error';

      const config2 = getConfigManager();
      // Should still have original value
      expect(config2.get('logging.level')).toBe('debug');
    });
  });

  describe('parseBoolean', () => {
    beforeEach(() => {
      process.env.HULY_EMAIL = 'test@example.com';
      process.env.HULY_PASSWORD = 'testpass';
      process.env.HULY_WORKSPACE = 'testworkspace';
    });

    it('should parse boolean environment variables correctly', () => {
      process.env.CORS_ENABLED = 'false';

      const config = new ConfigManager();

      expect(config.get('transport.http.cors.enabled')).toBe(false);
    });

    it('should default to true for CORS when not explicitly false', () => {
      process.env.CORS_ENABLED = 'true';

      const config = new ConfigManager();

      expect(config.get('transport.http.cors.enabled')).toBe(true);
    });
  });

  describe('parseInt', () => {
    beforeEach(() => {
      process.env.HULY_EMAIL = 'test@example.com';
      process.env.HULY_PASSWORD = 'testpass';
      process.env.HULY_WORKSPACE = 'testworkspace';
    });

    it('should parse integer environment variables', () => {
      process.env.MAX_RETRIES = '5';
      process.env.DEFAULT_ISSUE_LIMIT = '100';

      const config = new ConfigManager();

      expect(config.get('features.maxRetries')).toBe(5);
      expect(config.get('defaults.issueListLimit')).toBe(100);
    });

    it('should use default values for invalid integers', () => {
      process.env.MAX_RETRIES = 'invalid';

      const config = new ConfigManager();

      expect(config.get('features.maxRetries')).toBe(3); // default value
    });
  });
});
