import { jest } from '@jest/globals';
import { handler as bulkDeleteIssuesHandler } from '../../../src/tools/issues/bulkDeleteIssues.js';

describe('bulkDeleteIssues tool', () => {
  let mockContext;
  let mockDeletionService;

  beforeEach(() => {
    mockDeletionService = {
      bulkDeleteIssues: jest.fn(),
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

  it('should delete multiple issues successfully', async () => {
    const args = {
      issue_identifiers: ['PROJ-1', 'PROJ-2', 'PROJ-3'],
    };

    const mockResult = {
      success: true,
      totalRequested: 3,
      successCount: 3,
      failedCount: 0,
      deletedCount: 3,
      duration: 150,
      batches: 1,
      results: [
        { issueIdentifier: 'PROJ-1', success: true, deletedCount: 1 },
        { issueIdentifier: 'PROJ-2', success: true, deletedCount: 1 },
        { issueIdentifier: 'PROJ-3', success: true, deletedCount: 1 },
      ],
    };

    mockDeletionService.bulkDeleteIssues.mockResolvedValue(mockResult);

    const result = await bulkDeleteIssuesHandler(args, mockContext);

    expect(mockDeletionService.bulkDeleteIssues).toHaveBeenCalledWith(
      mockContext.client,
      ['PROJ-1', 'PROJ-2', 'PROJ-3'],
      {
        cascade: true,
        force: false,
        dryRun: false,
        continueOnError: true,
        batchSize: 10,
      }
    );
    expect(result).toContain('✅ Bulk Deletion Complete');
    expect(result).toContain('Total requested: 3');
    expect(result).toContain('Successfully deleted: 3');
  });

  it('should handle partial failures', async () => {
    const args = {
      issue_identifiers: ['PROJ-1', 'PROJ-2', 'PROJ-3'],
      options: {
        continue_on_error: true,
      },
    };

    const mockResult = {
      success: true,
      totalRequested: 3,
      successCount: 2,
      failedCount: 1,
      deletedCount: 2,
      duration: 150,
      batches: 1,
      results: [
        { issueIdentifier: 'PROJ-1', success: true, deletedCount: 1 },
        { issueIdentifier: 'PROJ-2', success: false, error: 'Issue not found' },
        { issueIdentifier: 'PROJ-3', success: true, deletedCount: 1 },
      ],
    };

    mockDeletionService.bulkDeleteIssues.mockResolvedValue(mockResult);

    const result = await bulkDeleteIssuesHandler(args, mockContext);

    expect(result).toContain('⚠️ Bulk Deletion Completed with Errors');
    expect(result).toContain('Failed: 1');
    expect(result).toContain('Failed Issues');
    expect(result).toContain('PROJ-2: Issue not found');
  });

  it('should handle dry run mode', async () => {
    const args = {
      issue_identifiers: ['PROJ-1', 'PROJ-2'],
      options: {
        dry_run: true,
      },
    };

    const mockResult = {
      success: true,
      dryRun: true,
      totalRequested: 2,
      successCount: 2,
      failedCount: 0,
      deletedCount: 0,
      wouldDelete: 5, // Including sub-issues
      duration: 50,
      batches: 1,
      results: [
        { issueIdentifier: 'PROJ-1', success: true, wouldDelete: ['PROJ-1', 'PROJ-1a', 'PROJ-1b'] },
        { issueIdentifier: 'PROJ-2', success: true, wouldDelete: ['PROJ-2', 'PROJ-2a'] },
      ],
    };

    mockDeletionService.bulkDeleteIssues.mockResolvedValue(mockResult);

    const result = await bulkDeleteIssuesHandler(args, mockContext);

    expect(result).toContain('🔍 Dry Run Results');
    expect(result).toContain('Would delete 5 issues total');
  });

  it('should validate issue identifiers', async () => {
    const args = {
      issue_identifiers: ['PROJ-1', 'invalid-format', 'PROJ-3'],
    };

    await expect(bulkDeleteIssuesHandler(args, mockContext)).rejects.toThrow(
      'Invalid issue identifier at index 1: invalid-format'
    );
  });

  it('should handle empty issue list', async () => {
    const args = {
      issue_identifiers: [],
    };

    await expect(bulkDeleteIssuesHandler(args, mockContext)).rejects.toThrow(
      'No issue identifiers provided'
    );
  });

  it('should respect batch size option', async () => {
    const args = {
      issue_identifiers: Array.from({ length: 25 }, (_, i) => `PROJ-${i + 1}`),
      options: {
        batch_size: 5,
      },
    };

    const mockResult = {
      success: true,
      totalRequested: 25,
      successCount: 25,
      failedCount: 0,
      deletedCount: 25,
      duration: 500,
      batches: 5,
      results: Array.from({ length: 25 }, (_, i) => ({
        issueIdentifier: `PROJ-${i + 1}`,
        success: true,
        deletedCount: 1,
      })),
    };

    mockDeletionService.bulkDeleteIssues.mockResolvedValue(mockResult);

    const result = await bulkDeleteIssuesHandler(args, mockContext);

    expect(mockDeletionService.bulkDeleteIssues).toHaveBeenCalledWith(
      mockContext.client,
      expect.any(Array),
      expect.objectContaining({
        batchSize: 5,
      })
    );
    expect(result).toContain('Processed in 5 batches');
  });

  it('should show progress for large deletions', async () => {
    const args = {
      issue_identifiers: Array.from({ length: 100 }, (_, i) => `PROJ-${i + 1}`),
    };

    const mockResult = {
      success: true,
      totalRequested: 100,
      successCount: 100,
      failedCount: 0,
      deletedCount: 150, // Including sub-issues
      duration: 2000,
      batches: 10,
      results: Array.from({ length: 100 }, (_, i) => ({
        issueIdentifier: `PROJ-${i + 1}`,
        success: true,
        deletedCount: i % 3 === 0 ? 2 : 1, // Some have sub-issues
      })),
    };

    mockDeletionService.bulkDeleteIssues.mockResolvedValue(mockResult);

    const result = await bulkDeleteIssuesHandler(args, mockContext);

    expect(result).toContain('Processed in 10 batches');
    expect(result).toContain('Total issues deleted: 150');
    expect(result).toContain('(including sub-issues)');
  });
});