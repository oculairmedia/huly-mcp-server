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

    const _mockResult = {
      content: [
        {
          type: 'text',
          text: '✅ Successfully deleted 1 issue:\n• PROJ-123',
        },
      ],
    };

    mockDeletionService.deleteIssue.mockResolvedValue(_mockResult);

    const result = await deleteIssueHandler(args, mockContext);

    expect(mockDeletionService.deleteIssue).toHaveBeenCalledWith(mockContext.client, 'PROJ-123', {
      cascade: true,
      force: false,
      dryRun: false,
    });
    expect(result.content[0].text).toContain('✅ Successfully deleted 1 issue');
    expect(result.content[0].text).toContain('PROJ-123');
  });

  it('should handle cascade deletion of sub-issues', async () => {
    const args = {
      issue_identifier: 'PROJ-123',
      cascade: true,
    };

    const _mockResult = {
      content: [
        {
          type: 'text',
          text: '✅ Successfully deleted 3 issues:\n• PROJ-123\n• PROJ-124\n• PROJ-125\nIncluding 2 sub-issues',
        },
      ],
    };

    mockDeletionService.deleteIssue.mockResolvedValue(_mockResult);

    const result = await deleteIssueHandler(args, mockContext);

    expect(result.content[0].text).toContain('✅ Successfully deleted 3 issues');
    expect(result.content[0].text).toContain('Including 2 sub-issues');
  });

  it('should handle dry run mode', async () => {
    const args = {
      issue_identifier: 'PROJ-123',
      dry_run: true,
    };

    const _mockResult = {
      content: [
        {
          type: 'text',
          text: '🔍 Dry run - would delete 2 items:\n• PROJ-123\n• PROJ-124',
        },
      ],
    };

    mockDeletionService.deleteIssue.mockResolvedValue(_mockResult);

    const result = await deleteIssueHandler(args, mockContext);

    expect(result.content[0].text).toContain('🔍 Dry run');
    expect(result.content[0].text).toContain('would delete 2 items');
    expect(mockDeletionService.deleteIssue).toHaveBeenCalledWith(mockContext.client, 'PROJ-123', {
      cascade: true,
      force: false,
      dryRun: true,
    });
  });

  it('should handle force deletion', async () => {
    const args = {
      issue_identifier: 'PROJ-123',
      force: true,
    };

    const _mockResult = {
      content: [
        {
          type: 'text',
          text: '✅ Successfully deleted 1 issue:\n• PROJ-123\n⚠️ Force deletion applied',
        },
      ],
    };

    mockDeletionService.deleteIssue.mockResolvedValue(_mockResult);

    const result = await deleteIssueHandler(args, mockContext);

    expect(result.content[0].text).toContain('⚠️ Force deletion applied');
  });

  it('should handle deletion with warnings', async () => {
    const args = {
      issue_identifier: 'PROJ-123',
      cascade: false,
    };

    const _mockResult = {
      content: [
        {
          type: 'text',
          text: '✅ Successfully deleted 1 issue:\n• PROJ-123\n⚠️ Issue has 2 sub-issues that were not deleted',
        },
      ],
    };

    mockDeletionService.deleteIssue.mockResolvedValue(_mockResult);

    const result = await deleteIssueHandler(args, mockContext);

    expect(result.content[0].text).toContain('⚠️ Issue has 2 sub-issues that were not deleted');
  });

  it('should handle invalid issue identifier', async () => {
    const args = {
      issue_identifier: 'invalid-format',
    };

    const result = await deleteIssueHandler(args, mockContext);

    expect(result.content[0].text).toContain('Error');
    expect(result.content[0].text).toContain("Invalid value for field 'issue_identifier'");
  });

  it('should handle deletion failure', async () => {
    const args = {
      issue_identifier: 'PROJ-123',
    };

    mockDeletionService.deleteIssue.mockRejectedValue(new Error('Issue not found'));

    const result = await deleteIssueHandler(args, mockContext);

    expect(result.content[0].text).toContain('Error');
    expect(result.content[0].text).toContain('Issue not found');
    expect(mockContext.logger.error).toHaveBeenCalled();
  });
});
