#!/bin/bash

# Fix all test files by adding _mockResult declaration before usage
find . -path ./worktrees -prune -o -path ./node_modules -prune -o -name "*.test.js" -type f -print | grep -v worktrees | while read file; do
  # Check if file contains _mockResult
  if grep -q "_mockResult" "$file"; then
    # Add const _mockResult declaration before the first usage in each test
    sed -i '/_mockResult.*=/,+0 {
      s/\(mockDeletionService\.\|mockIssueService\.\|mockProjectService\.\|mockTemplateService\.\|mockCommentService\.\|mockGithubService\.\|mockComponentService\.\|mockMilestoneService\.\|mockArchiveService\.\).*mockResolvedValue.*(_mockResult)/const _mockResult = {\n        content: [{ type: "text", text: "Success" }]\n      };\n      \1mockResolvedValue(_mockResult)/
    }' "$file"
  fi
done