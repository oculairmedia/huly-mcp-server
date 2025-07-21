# Changelog

All notable changes to the Huly MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- SequenceService for atomic issue number generation (fixes HULLY-121)
- ServiceRegistry for dependency injection and service management
- Component and milestone support in issue creation tools
- Comprehensive integration tests for concurrent operations
- Progress tracking for bulk operations
- Standardized MCP response format across all tools
- Documentation for HULLY-121 fix and API updates

### Changed
- IssueService now uses atomic operations for issue number generation
- TemplateService updated to use SequenceService
- All issue-related tools return consistent MCP-formatted responses
- Comment system now uses ChatMessage instead of ActivityMessage
- Priority handling normalized across all operations
- Improved error messages with more context

### Fixed
- **CRITICAL**: Duplicate issue IDs when creating issues concurrently (HULLY-121)
- Component and milestone assignment in bulk operations
- Priority update errors in issue operations
- Comment display issues with message format
- Search functionality priority handling
- Template-created issues visibility in project view

### Security
- Atomic operations prevent race conditions in ID generation
- Better validation of input parameters

## [1.0.0] - Previous Release

### Initial Features
- Project management tools
- Issue tracking capabilities
- Git worktree integration
- Docker support
- Basic bulk operations
- Template system
- GitHub integration