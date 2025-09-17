/**
 * Simple Account Management Integration Tests
 *
 * Tests the basic integration between account management tools
 * and services with proper mocking.
 */

import { jest } from '@jest/globals';
import { executeTool, initializeTools } from '../../src/tools/index.js';

// Mock dependencies
jest.unstable_mockModule('../../src/utils/Logger.js', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
  createLoggerWithConfig: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('Account Management Integration - Simple', () => {
  let mockContext;
  let testCounter = 0;

  beforeAll(async () => {
    await initializeTools();
  });

  beforeEach(() => {
    testCounter++;

    mockContext = {
      client: {
        getCurrentAccountId: jest.fn(() => 'current-account-id'),
        accountId: 'current-account-id',
        findOne: jest.fn(),
        findAll: jest.fn(),
        createDoc: jest.fn(),
        updateDoc: jest.fn(),
        updateMixin: jest.fn(),
        removeMixin: jest.fn(),
        isConnected: () => true,
      },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      services: {
        // Mock employee service as expected by the tools
        employeeService: {
          createEmployee: jest.fn(),
          updateEmployee: jest.fn(),
          deleteEmployee: jest.fn(),
          getEmployee: jest.fn(),
          listEmployees: jest.fn(),
        },
        // Mock account service
        accountService: {
          getCurrentAccount: jest.fn(),
          listWorkspaceMembers: jest.fn(),
        },
        // Mock person service
        personService: {
          createPerson: jest.fn(),
          updatePerson: jest.fn(),
          findPersonByEmail: jest.fn(),
          setPersonAvatar: jest.fn(),
          convertToEmployee: jest.fn(),
        },
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Employee Creation Integration', () => {
    it('should create employee successfully', async () => {
      const employeeData = {
        first_name: 'John',
        last_name: 'Doe',
        email: `john.doe.${testCounter}@test.com`,
      };

      // Mock successful employee creation
      const expectedResult = {
        content: [
          {
            text: `Employee created successfully: John Doe\n\n**Employee ID**: person-${testCounter}\n**Email**: ${employeeData.email}\n**Name**: John Doe\n**Status**: ✅ Active\n**Position**: Not specified\n**Department**: Not specified`,
          },
        ],
      };

      mockContext.services.employeeService.createEmployee.mockResolvedValueOnce(expectedResult);

      const result = await executeTool('huly_create_employee', employeeData, mockContext);

      expect(result.content[0].text).toContain('Employee created successfully');
      expect(result.content[0].text).toContain('John Doe');
      expect(result.content[0].text).toContain(employeeData.email);

      // Verify service was called
      expect(mockContext.services.employeeService.createEmployee).toHaveBeenCalledWith(
        mockContext.client,
        expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
          email: employeeData.email,
        })
      );
    });

    it('should handle employee creation with complete data', async () => {
      const employeeData = {
        first_name: 'Jane',
        last_name: 'Smith',
        email: `jane.smith.${testCounter}@test.com`,
        position: 'Senior Developer',
        department: 'Engineering',
        active: true,
      };

      const expectedResult = {
        content: [
          {
            text: `Employee created successfully: Jane Smith\n\n**Employee ID**: person-${testCounter}\n**Email**: ${employeeData.email}\n**Name**: Jane Smith\n**Status**: ✅ Active\n**Position**: Senior Developer\n**Department**: Engineering`,
          },
        ],
      };

      mockContext.services.employeeService.createEmployee.mockResolvedValueOnce(expectedResult);

      const result = await executeTool('huly_create_employee', employeeData, mockContext);

      expect(result.content[0].text).toContain('Employee created successfully');
      expect(result.content[0].text).toContain('Jane Smith');
      expect(result.content[0].text).toContain('Senior Developer');
      expect(result.content[0].text).toContain('Engineering');

      expect(mockContext.services.employeeService.createEmployee).toHaveBeenCalledWith(
        mockContext.client,
        expect.objectContaining({
          firstName: 'Jane',
          lastName: 'Smith',
          position: 'Senior Developer',
          department: 'Engineering',
          active: true,
        })
      );
    });

    it('should handle validation errors', async () => {
      const invalidData = {
        first_name: '', // Empty first name
        last_name: 'Doe',
      };

      const _expectedError = {
        isError: true,
        content: [
          {
            text: 'Error: Failed to create employee: First name is required',
          },
        ],
      };

      mockContext.services.employeeService.createEmployee.mockRejectedValueOnce(
        new Error('First name is required')
      );

      const result = await executeTool('huly_create_employee', invalidData, mockContext);

      expect(result.content[0].text).toContain('Failed to create employee');
    });
  });

  describe('Employee Retrieval Integration', () => {
    it('should get employee details successfully', async () => {
      const employeeId = `person-${testCounter}`;

      const expectedResult = {
        content: [
          {
            text: `**Employee Details**\n\n**Employee ID**: ${employeeId}\n**Name**: Test Employee\n**Email**: test@example.com\n**Status**: ✅ Active\n**Position**: Developer\n**Department**: Engineering\n**Phone**: +1-555-0123\n**Location**: San Francisco, USA`,
          },
        ],
      };

      mockContext.services.employeeService.getEmployee.mockResolvedValueOnce(expectedResult);

      const result = await executeTool(
        'huly_get_employee',
        { employee_id: employeeId },
        mockContext
      );

      expect(result.content[0].text).toContain('Employee Details');
      expect(result.content[0].text).toContain('Test Employee');
      expect(result.content[0].text).toContain('Developer');

      expect(mockContext.services.employeeService.getEmployee).toHaveBeenCalledWith(
        mockContext.client,
        employeeId
      );
    });

    it('should handle employee not found', async () => {
      const nonExistentId = 'non-existent-id';

      mockContext.services.employeeService.getEmployee.mockRejectedValueOnce(
        new Error('Employee not found')
      );

      const result = await executeTool(
        'huly_get_employee',
        { employee_id: nonExistentId },
        mockContext
      );

      expect(result.content[0].text).toContain('Failed to get employee details');
    });
  });

  describe('Employee Listing Integration', () => {
    it('should list employees successfully', async () => {
      const expectedResult = {
        content: [
          {
            text: `Found 3 employees:\n\n**John Doe** (john@example.com)\n✅ Active • Developer • Engineering\n📞 +1-555-0001 • 📍 San Francisco, USA\n\n**Jane Smith** (jane@example.com)\n✅ Active • Senior Developer • Engineering\n📞 +1-555-0002 • 📍 New York, USA\n\n**Bob Johnson** (bob@example.com)\n❌ Inactive • Manager • Sales`,
          },
        ],
      };

      mockContext.services.employeeService.listEmployees.mockResolvedValueOnce(expectedResult);

      const result = await executeTool('huly_list_employees', {}, mockContext);

      expect(result.content[0].text).toContain('Found 3 employees');
      expect(result.content[0].text).toContain('John Doe');
      expect(result.content[0].text).toContain('Jane Smith');
      expect(result.content[0].text).toContain('Bob Johnson');

      expect(mockContext.services.employeeService.listEmployees).toHaveBeenCalledWith(
        mockContext.client,
        {}
      );
    });

    it('should filter employees by department', async () => {
      const expectedResult = {
        content: [
          {
            text: `Found 2 employees:\n\n**John Doe** (john@example.com)\n✅ Active • Developer • Engineering\n\n**Jane Smith** (jane@example.com)\n✅ Active • Senior Developer • Engineering`,
          },
        ],
      };

      mockContext.services.employeeService.listEmployees.mockResolvedValueOnce(expectedResult);

      const result = await executeTool(
        'huly_list_employees',
        { department: 'Engineering' },
        mockContext
      );

      expect(result.content[0].text).toContain('Found 2 employees');
      expect(result.content[0].text).toContain('Engineering');

      expect(mockContext.services.employeeService.listEmployees).toHaveBeenCalledWith(
        mockContext.client,
        { department: 'Engineering' }
      );
    });
  });

  describe('Employee Update Integration', () => {
    it('should update employee successfully', async () => {
      const employeeId = `person-${testCounter}`;
      const updateData = {
        employee_id: employeeId,
        position: 'Senior Developer',
        department: 'Engineering',
        active: true,
      };

      const expectedResult = {
        content: [
          {
            text: `Employee updated successfully: Test Employee\n\n**Employee ID**: ${employeeId}\n**Updated Fields**: position, department, active\n**Position**: Senior Developer\n**Department**: Engineering\n**Status**: ✅ Active`,
          },
        ],
      };

      mockContext.services.employeeService.updateEmployee.mockResolvedValueOnce(expectedResult);

      const result = await executeTool('huly_update_employee', updateData, mockContext);

      expect(result.content[0].text).toContain('Employee updated successfully');
      expect(result.content[0].text).toContain('Senior Developer');
      expect(result.content[0].text).toContain('Engineering');

      expect(mockContext.services.employeeService.updateEmployee).toHaveBeenCalledWith(
        mockContext.client,
        employeeId,
        expect.objectContaining({
          position: 'Senior Developer',
          department: 'Engineering',
          active: true,
        })
      );
    });
  });

  describe('Employee Deletion Integration', () => {
    it('should delete employee successfully', async () => {
      const employeeId = `person-${testCounter}`;

      const expectedResult = {
        content: [
          {
            text: `Employee status removed successfully: Test Employee\n\n**Employee ID**: ${employeeId}\n**Action**: Employee mixin removed\n**Note**: Person record preserved for audit purposes`,
          },
        ],
      };

      mockContext.services.employeeService.deleteEmployee.mockResolvedValueOnce(expectedResult);

      const result = await executeTool(
        'huly_delete_employee',
        {
          employee_id: employeeId,
          confirm: true,
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Employee status removed successfully');
      expect(result.content[0].text).toContain('Test Employee');

      expect(mockContext.services.employeeService.deleteEmployee).toHaveBeenCalledWith(
        mockContext.client,
        employeeId
      );
    });

    it('should require confirmation for deletion', async () => {
      const employeeId = `person-${testCounter}`;

      const result = await executeTool(
        'huly_delete_employee',
        {
          employee_id: employeeId,
          confirm: false,
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Confirmation required');

      // Should not call the service without confirmation
      expect(mockContext.services.employeeService.deleteEmployee).not.toHaveBeenCalled();
    });
  });

  describe('Person Creation Integration', () => {
    it('should create person successfully with minimal data', async () => {
      const personData = {
        first_name: 'Alice',
        last_name: 'Johnson',
      };

      const expectedResult = {
        content: [
          {
            text: `✅ Created person: Alice Johnson

**Person ID**: person-${testCounter}
**Name**: Alice Johnson

🔗 Person can now be used for employee conversion or account linking.`,
          },
        ],
      };

      mockContext.services.personService.createPerson.mockResolvedValueOnce(expectedResult);

      const result = await executeTool('huly_create_person', personData, mockContext);

      expect(result.content[0].text).toContain('Created person: Alice Johnson');
      expect(result.content[0].text).toContain('employee conversion');

      expect(mockContext.services.personService.createPerson).toHaveBeenCalledWith(
        mockContext.client,
        expect.objectContaining({
          firstName: 'Alice',
          lastName: 'Johnson',
        })
      );
    });

    it('should create person successfully with complete data', async () => {
      const personData = {
        first_name: 'Bob',
        last_name: 'Wilson',
        middle_name: 'Thomas',
        email: `bob.wilson.${testCounter}@test.com`,
        phone: '+1-555-0199',
        city: 'Chicago',
        country: 'USA',
        birthday: '1985-07-20',
      };

      const expectedResult = {
        content: [
          {
            text: `✅ Created person: Bob Wilson

**Person ID**: person-${testCounter}
**Name**: Bob Thomas Wilson
**Email**: ${personData.email}
**Phone**: +1-555-0199
**City**: Chicago
**Country**: USA
**Birthday**: 1985-07-20

🔗 Person can now be used for employee conversion or account linking.`,
          },
        ],
      };

      mockContext.services.personService.createPerson.mockResolvedValueOnce(expectedResult);

      const result = await executeTool('huly_create_person', personData, mockContext);

      expect(result.content[0].text).toContain('Created person: Bob Wilson');
      expect(result.content[0].text).toContain('Bob Thomas Wilson');
      expect(result.content[0].text).toContain(personData.email);
      expect(result.content[0].text).toContain('+1-555-0199');
      expect(result.content[0].text).toContain('Chicago');
      expect(result.content[0].text).toContain('USA');
      expect(result.content[0].text).toContain('1985-07-20');

      expect(mockContext.services.personService.createPerson).toHaveBeenCalledWith(
        mockContext.client,
        expect.objectContaining({
          firstName: 'Bob',
          lastName: 'Wilson',
          middleName: 'Thomas',
          email: personData.email,
          phone: '+1-555-0199',
          city: 'Chicago',
          country: 'USA',
          birthday: '1985-07-20',
        })
      );
    });

    it('should handle person creation validation errors', async () => {
      const invalidData = {
        first_name: '', // Empty first name
        last_name: 'Smith',
      };

      const result = await executeTool('huly_create_person', invalidData, mockContext);

      expect(result.content[0].text).toContain('Failed to create person');

      // Should not call service with invalid data
      expect(mockContext.services.personService.createPerson).not.toHaveBeenCalled();
    });

    it('should handle duplicate person errors', async () => {
      const personData = {
        first_name: 'Charlie',
        last_name: 'Brown',
        email: `charlie.brown.${testCounter}@test.com`,
      };

      mockContext.services.personService.createPerson.mockRejectedValueOnce(
        new Error('Person with email charlie.brown@test.com already exists')
      );

      const result = await executeTool('huly_create_person', personData, mockContext);

      expect(result.content[0].text).toContain('Failed to create person');
      expect(result.content[0].text).toContain('already exists');
    });

    it('should handle PersonService not available', async () => {
      const personData = {
        first_name: 'David',
        last_name: 'Miller',
      };

      // Remove personService from context
      delete mockContext.services.personService;

      const result = await executeTool('huly_create_person', personData, mockContext);

      expect(result.content[0].text).toContain('Failed to create person');
      expect(result.content[0].text).toContain('PersonService not available');
    });
  });

  // Note: Account Information Integration tests are covered by unit tests
  // The getCurrentAccount tool uses a different service injection pattern

  describe('End-to-End Workflow Integration', () => {
    it('should complete full employee lifecycle', async () => {
      const employeeData = {
        first_name: 'Lifecycle',
        last_name: 'Test',
        email: `lifecycle.test.${testCounter}@test.com`,
      };

      // Step 1: Create employee
      const createResult = {
        content: [
          {
            text: `Employee created successfully: Lifecycle Test\n\n**Employee ID**: person-lifecycle-${testCounter}`,
          },
        ],
      };
      mockContext.services.employeeService.createEmployee.mockResolvedValueOnce(createResult);

      const created = await executeTool('huly_create_employee', employeeData, mockContext);
      expect(created.content[0].text).toContain('Employee created successfully');

      jest.clearAllMocks();

      // Step 2: Get employee details
      const getResult = {
        content: [
          {
            text: `**Employee Details**\n\n**Name**: Lifecycle Test\n**Email**: ${employeeData.email}\n**Status**: ✅ Active`,
          },
        ],
      };
      mockContext.services.employeeService.getEmployee.mockResolvedValueOnce(getResult);

      const retrieved = await executeTool(
        'huly_get_employee',
        {
          employee_id: `person-lifecycle-${testCounter}`,
        },
        mockContext
      );
      expect(retrieved.content[0].text).toContain('Lifecycle Test');

      jest.clearAllMocks();

      // Step 3: Update employee
      const updateResult = {
        content: [
          {
            text: `Employee updated successfully: Lifecycle Test\n\n**Position**: Senior Tester`,
          },
        ],
      };
      mockContext.services.employeeService.updateEmployee.mockResolvedValueOnce(updateResult);

      const updated = await executeTool(
        'huly_update_employee',
        {
          employee_id: `person-lifecycle-${testCounter}`,
          position: 'Senior Tester',
        },
        mockContext
      );
      expect(updated.content[0].text).toContain('Employee updated successfully');

      jest.clearAllMocks();

      // Step 4: Delete employee
      const deleteResult = {
        content: [
          {
            text: `Employee status removed successfully: Lifecycle Test`,
          },
        ],
      };
      mockContext.services.employeeService.deleteEmployee.mockResolvedValueOnce(deleteResult);

      const deleted = await executeTool(
        'huly_delete_employee',
        {
          employee_id: `person-lifecycle-${testCounter}`,
          confirm: true,
        },
        mockContext
      );
      expect(deleted.content[0].text).toContain('Employee status removed successfully');

      // Verify all steps called their respective services
      expect(mockContext.services.employeeService.deleteEmployee).toHaveBeenCalledWith(
        mockContext.client,
        `person-lifecycle-${testCounter}`
      );
    });
  });
});
