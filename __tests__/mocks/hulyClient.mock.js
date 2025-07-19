/**
 * Mock Huly Client for Testing
 * 
 * Provides a complete mock implementation of the Huly client
 * with controllable behavior for unit testing
 */

import { jest } from '@jest/globals';

export class MockHulyClient {
  constructor() {
    this.connected = false;
    this.workspace = null;
    this.mockData = {
      projects: [],
      issues: [],
      components: [],
      milestones: [],
      comments: [],
      statuses: [],
      priorities: []
    };
    
    // Track method calls for assertions
    this.calls = {
      findAll: [],
      findOne: [],
      create: [],
      update: [],
      uploadMarkup: [],
      fetchMarkup: []
    };
  }

  // Mock connection status
  async connect(url, config) {
    if (!config.email || !config.password) {
      throw new Error('Authentication failed: Invalid credentials');
    }
    
    if (!config.workspace) {
      throw new Error('Workspace selection failed: No workspace specified');
    }
    
    this.connected = true;
    this.workspace = config.workspace;
    return this;
  }

  // Mock findAll method
  async findAll(classRef, query, options) {
    this.calls.findAll.push({ classRef, query, options });
    
    // Simulate different responses based on classRef
    const className = classRef._class || classRef;
    
    switch (className) {
      case 'tracker:class:Project':
        return this.mockData.projects;
        
      case 'tracker:class:Issue':
        let issues = [...this.mockData.issues];
        
        // Apply query filters
        if (query) {
          if (query.space) {
            issues = issues.filter(i => i.space === query.space);
          }
          if (query.status) {
            issues = issues.filter(i => i.status === query.status);
          }
          if (query.priority) {
            issues = issues.filter(i => i.priority === query.priority);
          }
          // Support text search in title
          if (query.$search) {
            const searchTerm = query.$search.toLowerCase();
            issues = issues.filter(i => 
              i.title && i.title.toLowerCase().includes(searchTerm)
            );
          }
        }
        
        // Apply limit if specified
        if (options?.limit) {
          issues = issues.slice(0, options.limit);
        }
        
        // If total is requested, return an object with total count
        if (options?.total) {
          return { total: issues.length };
        }
        
        return issues;
        
      case 'tracker:class:Component':
        return this.mockData.components.filter(c => 
          query?.space ? c.space === query.space : true
        );
        
      case 'tracker:class:Milestone':
        return this.mockData.milestones.filter(m => 
          query?.space ? m.space === query.space : true
        );
        
      case 'chunter:class:Comment':
        return this.mockData.comments.filter(c => 
          query?.attachedTo ? c.attachedTo === query.attachedTo : true
        );
        
      default:
        return [];
    }
  }

  // Mock findOne method
  async findOne(classRef, query) {
    this.calls.findOne.push({ classRef, query });
    
    const results = await this.findAll(classRef, query);
    return results[0] || null;
  }

  // Mock createDoc method (matching actual Huly client API)
  async createDoc(classRef, spaceId, data) {
    this.calls.create.push({ classRef, spaceId, data });
    
    const className = classRef._class || classRef;
    const id = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newObject = {
      _id: id,
      _class: className,
      space: spaceId,
      ...data,
      createdOn: Date.now(),
      modifiedOn: Date.now()
    };
    
    switch (className) {
      case 'tracker:class:Project':
        this.mockData.projects.push(newObject);
        break;
      case 'tracker:class:Issue':
        this.mockData.issues.push(newObject);
        break;
      case 'tracker:class:Component':
        this.mockData.components.push(newObject);
        break;
      case 'tracker:class:Milestone':
        this.mockData.milestones.push(newObject);
        break;
      case 'chunter:class:Comment':
        this.mockData.comments.push(newObject);
        break;
    }
    
    return id;
  }

  // Mock addCollection method (for creating issues)
  async addCollection(classRef, spaceId, parentId, parentClass, collection, data, objectId) {
    const id = objectId || `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.calls.create.push({ 
      method: 'addCollection',
      classRef, 
      spaceId, 
      parentId, 
      parentClass, 
      collection, 
      data,
      objectId: id
    });
    
    const className = classRef._class || classRef;
    const newObject = {
      _id: id,
      _class: className,
      space: spaceId,
      ...data,
      createdOn: Date.now(),
      modifiedOn: Date.now()
    };
    
    // Add to appropriate collection
    if (className.includes('Issue')) {
      this.mockData.issues.push(newObject);
    } else if (className.includes('Comment')) {
      this.mockData.comments.push(newObject);
    }
    
    return id;
  }
  
  // Mock updateDoc method (matching actual Huly client API)
  async updateDoc(objectClass, spaceId, objectId, updates, returnObject) {
    this.calls.update.push({ objectClass, spaceId, objectId, updates });
    
    // Find and update the object in mock data
    const collections = ['projects', 'issues', 'components', 'milestones', 'comments'];
    
    for (const collection of collections) {
      const index = this.mockData[collection].findIndex(item => item._id === objectId);
      if (index !== -1) {
        let updatedObject = { ...this.mockData[collection][index] };
        
        // Handle special update operators
        if (updates.$inc) {
          for (const [field, increment] of Object.entries(updates.$inc)) {
            updatedObject[field] = (updatedObject[field] || 0) + increment;
          }
        } else {
          // Regular updates
          updatedObject = {
            ...updatedObject,
            ...updates
          };
        }
        
        updatedObject.modifiedOn = Date.now();
        this.mockData[collection][index] = updatedObject;
        
        if (returnObject) {
          return { object: updatedObject };
        }
        return;
      }
    }
    
    throw new Error('Object not found for update');
  }

  // Mock uploadMarkup method
  async uploadMarkup(classRef, objectId, field, text, format) {
    this.calls.uploadMarkup.push({ classRef, objectId, field, text, format });
    
    if (!text || text.trim() === '') {
      return '';
    }
    
    // Generate a mock MarkupBlobRef
    const ref = `markup:${objectId}:${field}:${Date.now()}`;
    
    // Store the markup content for retrieval
    if (!this.mockData.markupContent) {
      this.mockData.markupContent = {};
    }
    this.mockData.markupContent[ref] = {
      text,
      format,
      doc: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: text
              }
            ]
          }
        ]
      }
    };
    
    return ref;
  }

  // Mock createMixin method
  async createMixin(objectId, objectClass, spaceId, mixin, data) {
    // For now, just track the call
    this.calls.createMixin = this.calls.createMixin || [];
    this.calls.createMixin.push({ objectId, objectClass, spaceId, mixin, data });
    return objectId;
  }
  
  // Mock fetchMarkup method
  async fetchMarkup(classRef, objectId, field, ref) {
    this.calls.fetchMarkup.push({ classRef, objectId, field, ref });
    
    if (!ref || ref === '') {
      return null;
    }
    
    const content = this.mockData.markupContent?.[ref];
    if (!content) {
      throw new Error(`Markup not found: ${ref}`);
    }
    
    return content.doc;
  }

  // Helper methods for test setup
  addMockProject(project) {
    this.mockData.projects.push({
      _id: project._id || `project-${Date.now()}`,
      _class: 'tracker:class:Project',
      name: project.name,
      identifier: project.identifier,
      description: project.description || '',
      ...project
    });
  }

  addMockIssue(issue) {
    this.mockData.issues.push({
      _id: issue._id || `issue-${Date.now()}`,
      _class: 'tracker:class:Issue',
      title: issue.title,
      identifier: issue.identifier,
      number: issue.number,
      status: issue.status || 'tracker:status:Backlog',
      priority: issue.priority || 'tracker:priority:Medium',
      description: issue.description || '',
      ...issue
    });
  }

  addMockStatus(status) {
    this.mockData.statuses.push({
      _id: status._id || `status-${Date.now()}`,
      _class: 'tracker:class:IssueStatus',
      name: status.name,
      category: status.category,
      ...status
    });
  }

  addMockPriority(priority) {
    this.mockData.priorities.push({
      _id: priority._id || `priority-${Date.now()}`,
      _class: 'tracker:class:IssuePriority',
      name: priority.name,
      ...priority
    });
  }

  // Reset all mock data
  reset() {
    this.connected = false;
    this.workspace = null;
    this.mockData = {
      projects: [],
      issues: [],
      components: [],
      milestones: [],
      comments: [],
      statuses: [],
      priorities: [],
      markupContent: {}
    };
    this.calls = {
      findAll: [],
      findOne: [],
      create: [],
      update: [],
      uploadMarkup: [],
      fetchMarkup: []
    };
  }

  // Verify method was called with specific arguments
  wasCalledWith(method, expectedArgs) {
    const calls = this.calls[method] || [];
    return calls.some(call => 
      JSON.stringify(call) === JSON.stringify(expectedArgs)
    );
  }
}

// Mock connect function
export const mockConnect = jest.fn(async (url, config) => {
  const client = new MockHulyClient();
  
  // Simulate the connection process
  if (!config.email || !config.password) {
    throw new Error('Authentication failed: Invalid credentials');
  }
  
  if (!config.workspace) {
    throw new Error('Workspace selection failed: No workspace specified');
  }
  
  // Set connection status
  client.connected = true;
  client.workspace = config.workspace;
  
  return client;
});

export default {
  MockHulyClient,
  mockConnect
};