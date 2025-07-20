import { jest } from '@jest/globals';
import { handler as deleteIssueHandler } from '../../../src/tools/issues/deleteIssue.js';

describe('deleteIssue tool', () => {
  let mockContext;
  let mockDeletionService;

  beforeEach(() => {
    mockDeletionService = {
      deleteIssue: jest.fn(),
    };

    mockContext = {
      client: {},
      services: {
        deletionService: mockDeletionService,
      },
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should delete issue successfully', async () => {
    const args = {
      issue_identifier: 'PROJ-123',
    };

    const mockResult = {
      success: true,
      deletedCount: 1,
      deletedIssues: ['PROJ-123'],
    };

    mockDeletionService.deleteIssue.mockResolvedValue(mockResult);

    const result = await deleteIssueHandler(args, mockContext);

    expect(mockDeletionService.deleteIssue).toHaveBeenCalledWith(
      mockContext.client,
      'PROJ-123',
      {
        cascade: true,
        force: false,
        dryRun: false,
      }
    );
    expect(result).toContain('✅ Successfully deleted 1 issue');
    expect(result).toContain('PROJ-123');
  });

  it('should handle cascade deletion of sub-issues', async () => {
    const args = {
      issue_identifier: 'PROJ-123',
      cascade: true,
    };

    const mockResult = {
      success: true,
      deletedCount: 3,
      deletedIssues: ['PROJ-123', 'PROJ-124', 'PROJ-125'],
    };

    mockDeletionService.deleteIssue.mockResolvedValue(mockResult);

    const result = await deleteIssueHandler(args, mockContext);

    expect(result).toContain('✅ Successfully deleted 3 issues');
    expect(result).toContain('Including 2 sub-issues');
  });

  it('should handle dry run mode', async () => {
    const args = {
      issue_identifier: 'PROJ-123',
      dry_run: true,
    };

    const mockResult = {
      success: true,
      dryRun: true,
      deletedCount: 0,
      wouldDelete: ['PROJ-123', 'PROJ-124'],
    };

    mockDeletionService.deleteIssue.mockResolvedValue(mockResult);

    const result = await deleteIssueHandler(args, mockContext);

    expect(result).toContain('🔍 Dry Run Results');
    expect(result).toContain('Would delete 2 issues');
    expect(mockDeletionService.deleteIssue).toHaveBeenCalledWith(
      mockContext.client,
      'PROJ-123',
      {
        cascade: true,
        force: false,
        dryRun: true,
      }
    );
  });

  it('should handle force deletion', async () => {
    const args = {
      issue_identifier: 'PROJ-123',
      force: true,
    };

    const mockResult = {
      success: true,
      deletedCount: 1,
      deletedIssues: ['PROJ-123'],
      forcedDeletion: true,
    };

    mockDeletionService.deleteIssue.mockResolvedValue(mockResult);

    const result = await deleteIssueHandler(args, mockContext);

    expect(result).toContain('⚠️ Force deletion applied');
  });

  it('should handle deletion with warnings', async () => {
    const args = {
      issue_identifier: 'PROJ-123',
      cascade: false,
    };

    const mockResult = {
      success: true,
      deletedCount: 1,
      deletedIssues: ['PROJ-123'],
      warnings: ['Issue has 2 sub-issues that were not deleted'],
    };

    mockDeletionService.deleteIssue.mockResolvedValue(mockResult);

    const result = await deleteIssueHandler(args, mockContext);

    expect(result).toContain('⚠️ Warnings');
    expect(result).toContain('Issue has 2 sub-issues that were not deleted');
  });

  it('should handle invalid issue identifier', async () => {
    const args = {
      issue_identifier: 'invalid-format',
    };

    await expect(deleteIssueHandler(args, mockContext)).rejects.toThrow(
      'Invalid issue identifier format'
    );
  });

  it('should handle deletion failure', async () => {
    const args = {
      issue_identifier: 'PROJ-123',
    };

    mockDeletionService.deleteIssue.mockRejectedValue(new Error('Issue not found'));

    await expect(deleteIssueHandler(args, mockContext)).rejects.toThrow('Issue not found');
    expect(mockContext.logger.error).toHaveBeenCalled();
  });
});