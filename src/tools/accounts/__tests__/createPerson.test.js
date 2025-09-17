/**
 * Unit tests for Create Person Tool
 */

import { jest } from '@jest/globals';

// Create mock functions
const mockCreatePerson = jest.fn();
const mockCreateErrorResponse = jest.fn((message) => ({
  content: [{ type: 'text', text: `Error: ${message}` }],
}));

// Mock PersonService using unstable_mockModule for ES modules
jest.unstable_mockModule('../../../services/PersonService.js', () => ({
  PersonService: jest.fn(),
  personService: {
    createPerson: mockCreatePerson,
  },
}));

// Mock ToolInterface using unstable_mockModule for ES modules
jest.unstable_mockModule('../../base/ToolInterface.js', () => ({
  createErrorResponse: mockCreateErrorResponse,
}));

// Import after mocking
const { definition, handler } = await import('../createPerson.js');

describe('CreatePersonTool', () => {
  let mockClient;
  let mockLogger;
  let mockServices;
  let mockContext;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockCreatePerson.mockReset();

    // Create mock client
    mockClient = {
      createDoc: jest.fn(),
      findOne: jest.fn(),
      updateDoc: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
    };

    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create mock services
    mockServices = {
      personService: {
        createPerson: mockCreatePerson,
      },
    };

    // Create mock context
    mockContext = {
      client: mockClient,
      logger: mockLogger,
      services: mockServices,
    };
  });

  describe('definition', () => {
    it('should have correct tool definition', () => {
      expect(definition).toEqual({
        name: 'huly_create_person',
        description: expect.stringContaining('Create a new person in the Huly workspace'),
        inputSchema: {
          type: 'object',
          properties: {
            first_name: {
              type: 'string',
              description: 'Person first name (required)',
              minLength: 1,
              maxLength: 50,
            },
            last_name: {
              type: 'string',
              description: 'Person last name (required)',
              minLength: 1,
              maxLength: 50,
            },
            middle_name: {
              type: 'string',
              description: 'Person middle name (optional)',
              maxLength: 50,
            },
            email: {
              type: 'string',
              description: 'Email address for account linking (optional)',
              format: 'email',
            },
            phone: {
              type: 'string',
              description: 'Phone number (optional)',
              maxLength: 20,
            },
            city: {
              type: 'string',
              description: 'City location (optional)',
              maxLength: 50,
            },
            country: {
              type: 'string',
              description: 'Country location (optional)',
              maxLength: 50,
            },
            birthday: {
              type: 'string',
              description: 'Birthday in ISO date format (optional)',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            },
          },
          required: ['first_name', 'last_name'],
        },
        annotations: {
          title: 'Create Person',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      });
    });
  });

  describe('handler', () => {
    it('should create person successfully with minimal data', async () => {
      const args = {
        first_name: 'John',
        last_name: 'Doe',
      };

      const expectedPersonData = {
        firstName: 'John',
        lastName: 'Doe',
        middleName: undefined,
        email: undefined,
        phone: undefined,
        city: undefined,
        country: undefined,
        birthday: undefined,
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Created person: John Doe\n\n**Person ID**: person-123\n**Name**: John Doe',
          },
        ],
      };

      mockCreatePerson.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockCreatePerson).toHaveBeenCalledWith(mockClient, expectedPersonData);
      expect(result).toEqual(mockResult);
      expect(mockLogger.debug).toHaveBeenCalledWith('Creating person', args);
    });

    it('should create person successfully with complete data', async () => {
      const args = {
        first_name: 'John',
        last_name: 'Doe',
        middle_name: 'William',
        email: 'john.doe@example.com',
        phone: '+1-555-0123',
        city: 'San Francisco',
        country: 'USA',
        birthday: '1990-01-15',
      };

      const expectedPersonData = {
        firstName: 'John',
        lastName: 'Doe',
        middleName: 'William',
        email: 'john.doe@example.com',
        phone: '+1-555-0123',
        city: 'San Francisco',
        country: 'USA',
        birthday: '1990-01-15',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Created person: John Doe\n\n**Person ID**: person-123\n**Name**: John William Doe\n**Email**: john.doe@example.com\n**Phone**: +1-555-0123\n**City**: San Francisco\n**Country**: USA\n**Birthday**: 1990-01-15',
          },
        ],
      };

      mockCreatePerson.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockCreatePerson).toHaveBeenCalledWith(mockClient, expectedPersonData);
      expect(result).toEqual(mockResult);
      expect(mockLogger.debug).toHaveBeenCalledWith('Creating person', args);
    });

    it('should handle PersonService not available error', async () => {
      const args = {
        first_name: 'John',
        last_name: 'Doe',
      };

      // Remove personService from context
      mockContext.services = {};

      const _result = await handler(args, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create person', {
        error: 'PersonService not available',
        args,
      });
      expect(mockCreateErrorResponse).toHaveBeenCalledWith(
        'Failed to create person: PersonService not available'
      );
    });

    it('should handle PersonService creation error', async () => {
      const args = {
        first_name: 'John',
        last_name: 'Doe',
      };

      const serviceError = new Error('Person already exists with this email');
      mockCreatePerson.mockRejectedValue(serviceError);

      const _result = await handler(args, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create person', {
        error: serviceError.message,
        args,
      });
      expect(mockCreateErrorResponse).toHaveBeenCalledWith(
        'Failed to create person: Person already exists with this email'
      );
    });

    it('should transform arguments correctly to service format', async () => {
      const args = {
        first_name: 'Jane',
        last_name: 'Smith',
        middle_name: 'Elizabeth',
        email: 'jane.smith@company.com',
        phone: '+1-555-9999',
        city: 'New York',
        country: 'United States',
        birthday: '1985-12-25',
      };

      const expectedPersonData = {
        firstName: 'Jane',
        lastName: 'Smith',
        middleName: 'Elizabeth',
        email: 'jane.smith@company.com',
        phone: '+1-555-9999',
        city: 'New York',
        country: 'United States',
        birthday: '1985-12-25',
      };

      const mockResult = {
        content: [{ type: 'text', text: 'Person created successfully' }],
      };

      mockCreatePerson.mockResolvedValue(mockResult);

      await handler(args, mockContext);

      expect(mockCreatePerson).toHaveBeenCalledWith(mockClient, expectedPersonData);
    });

    it('should handle validation error for missing first_name', async () => {
      const args = {
        // first_name missing
        last_name: 'Doe',
      };

      const _result = await handler(args, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create person', {
        error: 'first_name is required and must be a non-empty string',
        args,
      });
      expect(mockCreateErrorResponse).toHaveBeenCalledWith(
        'Failed to create person: first_name is required and must be a non-empty string'
      );
      expect(mockCreatePerson).not.toHaveBeenCalled();
    });

    it('should handle validation error for empty first_name', async () => {
      const args = {
        first_name: '',
        last_name: 'Doe',
      };

      const _result = await handler(args, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create person', {
        error: 'first_name is required and must be a non-empty string',
        args,
      });
      expect(mockCreateErrorResponse).toHaveBeenCalledWith(
        'Failed to create person: first_name is required and must be a non-empty string'
      );
      expect(mockCreatePerson).not.toHaveBeenCalled();
    });

    it('should handle validation error for missing last_name', async () => {
      const args = {
        first_name: 'John',
        // last_name missing
      };

      const _result = await handler(args, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create person', {
        error: 'last_name is required and must be a non-empty string',
        args,
      });
      expect(mockCreateErrorResponse).toHaveBeenCalledWith(
        'Failed to create person: last_name is required and must be a non-empty string'
      );
      expect(mockCreatePerson).not.toHaveBeenCalled();
    });

    it('should handle validation error for empty last_name', async () => {
      const args = {
        first_name: 'John',
        last_name: '',
      };

      const _result = await handler(args, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create person', {
        error: 'last_name is required and must be a non-empty string',
        args,
      });
      expect(mockCreateErrorResponse).toHaveBeenCalledWith(
        'Failed to create person: last_name is required and must be a non-empty string'
      );
      expect(mockCreatePerson).not.toHaveBeenCalled();
    });

    it('should handle undefined optional fields', async () => {
      const args = {
        first_name: 'Test',
        last_name: 'User',
        // All optional fields are undefined
      };

      const expectedPersonData = {
        firstName: 'Test',
        lastName: 'User',
        middleName: undefined,
        email: undefined,
        phone: undefined,
        city: undefined,
        country: undefined,
        birthday: undefined,
      };

      const mockResult = {
        content: [{ type: 'text', text: 'Person created successfully' }],
      };

      mockCreatePerson.mockResolvedValue(mockResult);

      await handler(args, mockContext);

      expect(mockCreatePerson).toHaveBeenCalledWith(mockClient, expectedPersonData);
    });

    it('should handle empty string optional fields', async () => {
      const args = {
        first_name: 'Test',
        last_name: 'User',
        email: '',
        phone: '',
        city: '',
        country: '',
      };

      const expectedPersonData = {
        firstName: 'Test',
        lastName: 'User',
        middleName: undefined,
        email: '',
        phone: '',
        city: '',
        country: '',
        birthday: undefined,
      };

      const mockResult = {
        content: [{ type: 'text', text: 'Person created successfully' }],
      };

      mockCreatePerson.mockResolvedValue(mockResult);

      await handler(args, mockContext);

      expect(mockCreatePerson).toHaveBeenCalledWith(mockClient, expectedPersonData);
    });
  });
});
