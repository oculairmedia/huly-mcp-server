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

    mockDeletionService.bulkDeleteIssues.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: `✅ Bulk Deletion Complete

Total requested: 3
Successfully deleted: 3
`,
        },
      ],
    });

    const result = await bulkDeleteIssuesHandler(args, mockContext);

    expect(mockDeletionService.bulkDeleteIssues).toHaveBeenCalledWith(
      mockContext.client,
      ['PROJ-1', 'PROJ-2', 'PROJ-3'],
      {} // No options provided, so empty object
    );
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('✅ Bulk Deletion Complete');
    expect(result.content[0].text).toContain('Total requested: 3');
    expect(result.content[0].text).toContain('Successfully deleted: 3');
  });

  it('should handle partial failures', async () => {
    const args = {
      issue_identifiers: ['PROJ-1', 'PROJ-2', 'PROJ-3'],
      options: {
        continue_on_error: true,
      },
    };

    mockDeletionService.bulkDeleteIssues.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: `⚠️ Bulk Deletion Completed with Errors

Failed: 1

Failed Issues:
PROJ-2: Issue not found
`,
        },
      ],
    });

    const result = await bulkDeleteIssuesHandler(args, mockContext);

    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('⚠️ Bulk Deletion Completed with Errors');
    expect(result.content[0].text).toContain('Failed: 1');
    expect(result.content[0].text).toContain('Failed Issues');
    expect(result.content[0].text).toContain('PROJ-2: Issue not found');
  });

  it('should handle dry run mode', async () => {
    const args = {
      issue_identifiers: ['PROJ-1', 'PROJ-2'],
      options: {
        dry_run: true,
      },
    };

    mockDeletionService.bulkDeleteIssues.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: `🔍 Dry Run Results

Would delete 5 issues total
`,
        },
      ],
    });

    const result = await bulkDeleteIssuesHandler(args, mockContext);

    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('🔍 Dry Run Results');
    expect(result.content[0].text).toContain('Would delete 5 issues total');
  });

  it('should validate issue identifiers', async () => {
    const args = {
      issue_identifiers: ['PROJ-1', 'invalid-format', 'PROJ-3'],
    };

    const result = await bulkDeleteIssuesHandler(args, mockContext);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toMatch(/Error: /);
  });

  it('should handle empty issue list', async () => {
    const args = {
      issue_identifiers: [],
    };

    const result = await bulkDeleteIssuesHandler(args, mockContext);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toMatch(/Error: .*/);
  });

  it('should respect batch size option', async () => {
    const args = {
      issue_identifiers: Array.from({ length: 25 }, (_, i) => `PROJ-${i + 1}`),
      options: {
        batch_size: 5,
      },
    };

    mockDeletionService.bulkDeleteIssues.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: `✅ Bulk Deletion Complete

Processed in 5 batches
`,
        },
      ],
    });

    const result = await bulkDeleteIssuesHandler(args, mockContext);

    expect(mockDeletionService.bulkDeleteIssues).toHaveBeenCalledWith(
      mockContext.client,
      expect.any(Array),
      {
        batch_size: 5,
      }
    );
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Processed in 5 batches');
  });

  it('should show progress for large deletions', async () => {
    const args = {
      issue_identifiers: Array.from({ length: 100 }, (_, i) => `PROJ-${i + 1}`),
    };

    mockDeletionService.bulkDeleteIssues.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: `✅ Bulk Deletion Complete

Processed in 10 batches
Total issues deleted: 150
(including sub-issues)
`,
        },
      ],
    });

    const result = await bulkDeleteIssuesHandler(args, mockContext);

    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Processed in 10 batches');
    expect(result.content[0].text).toContain('Total issues deleted: 150');
    expect(result.content[0].text).toContain('(including sub-issues)');
  });
});
