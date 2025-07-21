/**
 * ServiceRegistry - Centralized service management with dependency injection
 *
 * Manages the lifecycle and dependencies of all services in the application.
 * Implements a singleton pattern to ensure consistent service instances.
 */

import { ServiceFactory } from './ServiceFactory.js';
import { createLoggerWithConfig } from '../utils/index.js';
import { getConfigManager } from '../config/index.js';
import statusManager from '../../StatusManager.js';

/**
 * Registry for managing service instances and dependencies
 */
class ServiceRegistry {
  constructor() {
    this._services = null;
    this._logger = null;
    this._initialized = false;
  }

  /**
   * Initialize the registry with required dependencies
   * @param {Object} hulyClientWrapper - Huly client wrapper instance
   * @param {Object} logger - Logger instance (optional)
   */
  initialize(hulyClientWrapper, logger = null) {
    if (this._initialized) {
      throw new Error('ServiceRegistry already initialized');
    }

    // Use provided logger or create a new one
    this._logger = logger || createLoggerWithConfig(getConfigManager());

    this._logger.info('Initializing ServiceRegistry');

    // Use ServiceFactory to create all services with proper dependency injection
    this._services = ServiceFactory.createAllServices({
      statusManager,
      logger: this._logger,
    });

    // Validate dependencies are properly wired
    ServiceFactory.validateDependencies(this._services);

    this._initialized = true;
    this._logger.info('ServiceRegistry initialized successfully');
  }

  /**
   * Get all services
   * @returns {Object} Object containing all service instances
   */
  getServices() {
    if (!this._initialized) {
      throw new Error('ServiceRegistry not initialized');
    }
    return this._services;
  }

  /**
   * Get a specific service by name
   * @param {string} serviceName - Name of the service to retrieve
   * @returns {Object} The requested service instance
   */
  getService(serviceName) {
    if (!this._initialized) {
      throw new Error('ServiceRegistry not initialized');
    }

    const service = this._services[serviceName];
    if (!service) {
      throw new Error(`Service '${serviceName}' not found in registry`);
    }

    return service;
  }

  /**
   * Reset the registry (mainly for testing)
   */
  reset() {
    this._services = null;
    this._logger = null;
    this._initialized = false;
  }

  /**
   * Static method to get the singleton instance
   * @returns {ServiceRegistry} The singleton instance
   */
  static getInstance() {
    if (!ServiceRegistry._instance) {
      ServiceRegistry._instance = new ServiceRegistry();
    }
    return ServiceRegistry._instance;
  }
}

// Create singleton instance
ServiceRegistry._instance = null;

export default ServiceRegistry;
