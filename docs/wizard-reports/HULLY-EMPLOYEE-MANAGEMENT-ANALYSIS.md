# Huly Employee Management Analysis & Implementation Plan

## Executive Summary

This document outlines the analysis of Huly's employee/person management system and provides a comprehensive implementation plan for creating employee management tools in the MCP server. The analysis reveals that Huly uses a sophisticated contact-based architecture where employees are implemented as Person entities with Employee mixins.

## Huly Employee Architecture Analysis

### Core Entity Structure

Based on the Huly documentation analysis, the employee system follows this hierarchy:

```
Contact (base class)
  └── Person (extends Contact)
      └── Employee (mixin applied to Person)
```

### Key Entity Details

#### Contact Class (`contact.class.Contact`)
- **Base entity** for all contact-related objects
- **Core fields**:
  - `name: string` - Display name
  - `avatar?: Ref<Attachment>` - Profile picture
  - `comments?: number` - Comment count

#### Person Class (`contact.class.Person`)
- **Extends Contact**
- **Additional fields**:
  - `name: PersonName` - Structured name object
  - `city: string` - Location city
  - `country: string` - Location country

#### PersonName Structure
```typescript
interface PersonName {
  first: string    // First name
  last: string     // Last name
  middle?: string  // Middle name (optional)
}
```

#### Employee Mixin (`contact.mixin.Employee`)
- **Applied to Person entities**
- **Work-specific fields**:
  - `active: boolean` - Employment status
  - `role?: Ref<Role>` - System role reference
  - `statuses?: EmployeeStatus[]` - Status history
  - `position?: string` - Job title
  - `department?: Ref<Department>` - Department reference

### System Integration Points

#### Account System
- Employees are linked to user accounts via email
- Account creation triggers employee record creation
- Role-based access control through Employee.role

#### Project Assignment
- Employees can be assigned to projects
- Issue assignment uses employee references
- Team membership managed through employee records

## Current MCP Server Analysis

### Existing Infrastructure

#### Service Layer
- **Location**: `src/services/`
- **Pattern**: Service classes with client injection
- **Examples**: `ProjectService.js`, `IssueService.js`

#### Tool Layer
- **Location**: `src/tools/`
- **Pattern**: Definition + handler exports
- **Structure**: Organized by functional areas

#### Missing Components
- ❌ **EmployeeService** - No employee management service
- ❌ **Employee Tools** - No employee CRUD operations
- ❌ **Contact Integration** - No contact system access

## Implementation Plan

### Phase 1: Service Layer Implementation

#### 1.1 Create EmployeeService
**File**: `src/services/EmployeeService.js`

**Core Methods**:
```javascript
class EmployeeService {
  // Employee CRUD
  async createEmployee(client, employeeData)
  async getEmployee(client, employeeId)
  async updateEmployee(client, employeeId, updates)
  async deleteEmployee(client, employeeId)
  async listEmployees(client, options = {})
  
  // Search & Filter
  async searchEmployees(client, query)
  async getEmployeesByDepartment(client, departmentId)
  async getActiveEmployees(client)
  
  // Account Integration
  async createEmployeeWithAccount(client, employeeData)
  async linkEmployeeToAccount(client, employeeId, accountId)
  async getEmployeeByEmail(client, email)
}
```

#### 1.2 Contact System Integration
**Challenge**: Access to contact classes
**Solutions**:
1. **Direct Core Import**: Import from `@hcengineering/core`
2. **Client Query**: Use client.findAll() with class references
3. **Service Wrapper**: Create abstraction layer

### Phase 2: Tool Implementation

#### 2.1 Employee CRUD Tools

**Tools to Create**:
1. `huly_create_employee` - Create new employee
2. `huly_get_employee` - Retrieve employee details
3. `huly_update_employee` - Update employee information
4. `huly_delete_employee` - Remove employee
5. `huly_list_employees` - List/search employees

#### 2.2 Employee Management Tools

**Advanced Tools**:
1. `huly_bulk_create_employees` - Batch employee creation
2. `huly_import_employees_csv` - CSV import functionality
3. `huly_assign_employee_to_project` - Project assignment
4. `huly_manage_employee_roles` - Role management

### Phase 3: Integration & Testing

#### 3.1 Wizard Integration
- Update Issue Workflow Wizard for employee assignment
- Add employee selection to project tools
- Integrate with existing assignment workflows

#### 3.2 Testing Strategy
- Unit tests for EmployeeService methods
- Integration tests with Huly client
- Tool validation with mock data

## Technical Implementation Details

### Employee Data Model

```javascript
const employeeSchema = {
  // Required fields
  email: 'string (email format)',
  firstName: 'string',
  lastName: 'string',
  
  // Optional personal info
  middleName: 'string?',
  phone: 'string?',
  city: 'string?',
  country: 'string?',
  
  // Work-related fields
  active: 'boolean (default: true)',
  role: 'string (USER|GUEST)',
  position: 'string?',
  department: 'string?',
  
  // System fields (auto-generated)
  id: 'Ref<Person>',
  accountId: 'Ref<Account>?',
  createdAt: 'Date',
  updatedAt: 'Date'
};
```

### Service Implementation Pattern

```javascript
export class EmployeeService {
  constructor() {
    this.logger = getLogger('employee-service');
  }

  async createEmployee(client, employeeData) {
    try {
      // 1. Validate input data
      this.validateEmployeeData(employeeData);
      
      // 2. Create PersonName object
      const personName = {
        first: employeeData.firstName,
        last: employeeData.lastName,
        middle: employeeData.middleName
      };
      
      // 3. Create Person entity
      const personId = await client.createDoc(
        contact.class.Person,
        core.space.Model,
        {
          name: personName,
          city: employeeData.city,
          country: employeeData.country
        }
      );
      
      // 4. Apply Employee mixin
      await client.createMixin(
        personId,
        contact.class.Person,
        core.space.Model,
        contact.mixin.Employee,
        {
          active: employeeData.active ?? true,
          position: employeeData.position,
          department: employeeData.department
        }
      );
      
      // 5. Create account if email provided
      if (employeeData.email) {
        await this.createAccountForEmployee(client, personId, employeeData);
      }
      
      return { success: true, employeeId: personId };
    } catch (error) {
      this.logger.error('Failed to create employee', { error, employeeData });
      throw error;
    }
  }
}
```

## Dependencies & Requirements

### Required Packages
```json
{
  "@hcengineering/core": "^0.6.x",
  "@hcengineering/contact": "^0.6.x", // If available
  "@hcengineering/model": "^0.6.x"
}
```

### Class References Needed
```javascript
import contact from '@hcengineering/contact';
import core from '@hcengineering/core';

// Class references
const PersonClass = contact.class.Person;
const ContactClass = contact.class.Contact;
const EmployeeMixin = contact.mixin.Employee;
```

## Risk Assessment

### High Risk Areas
1. **Contact Package Availability** - May not be installed
2. **Class Reference Access** - Import path uncertainties
3. **Account Integration** - Complex account creation flow
4. **Permission Management** - Role-based access requirements

### Mitigation Strategies
1. **Graceful Degradation** - Fallback to basic functionality
2. **Error Handling** - Comprehensive error catching
3. **Validation** - Input validation at all levels
4. **Testing** - Extensive testing with mock data

## Success Criteria

### Phase 1 Success Metrics
- ✅ EmployeeService successfully creates Person entities
- ✅ Employee mixin properly applied
- ✅ Basic CRUD operations functional
- ✅ Error handling comprehensive

### Phase 2 Success Metrics
- ✅ All employee tools functional
- ✅ Proper input validation
- ✅ Integration with existing workflows
- ✅ Bulk operations working

### Phase 3 Success Metrics
- ✅ Wizard integration complete
- ✅ All tests passing
- ✅ Documentation updated
- ✅ Performance acceptable

## Next Steps

### Immediate Actions (Next 2 hours)
1. **Investigate Contact Package** - Check if @hcengineering/contact is available
2. **Create EmployeeService** - Implement basic service structure
3. **Test Class Access** - Verify contact class imports work
4. **Create First Tool** - Implement huly_create_employee

### Short Term (Next 8 hours)
1. **Complete Service Implementation** - All CRUD methods
2. **Create Core Tools** - Basic employee management tools
3. **Add Validation** - Input validation and error handling
4. **Integration Testing** - Test with real Huly instance

### Medium Term (Next 16 hours)
1. **Advanced Tools** - Bulk operations, CSV import
2. **Wizard Integration** - Update existing wizards
3. **Documentation** - Complete API documentation
4. **Performance Optimization** - Query optimization

## Appendix

### Huly Contact System References
- **Documentation**: `doc/huly-comprehensive-mcp-guide.md`
- **Core Classes**: Person, Contact, Employee mixin
- **Account Integration**: Email-based account linking
- **Role System**: USER/GUEST roles with permissions

### Related Issues
- **HULLY-316**: Issue Workflow Wizard improvements
- **Employee Assignment**: Project and issue assignment workflows
- **User Management**: Account creation and role management

### Technical Notes
- Employee entities are Person objects with Employee mixin
- Account creation requires email validation
- Role assignment affects system permissions
- Department/position fields are optional but recommended
