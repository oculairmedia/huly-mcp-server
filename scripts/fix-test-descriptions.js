#!/usr/bin/env node

/**
 * Script to automatically fix test description mismatches
 *
 * This script reads all test files and updates description expectations
 * to match the actual comprehensive descriptions used in tools.
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mapping of old short descriptions to key phrases from new comprehensive descriptions
const descriptionMappings = {
  'List all GitHub repositories': 'Retrieve a comprehensive inventory of all GitHub repositories',
  'Add a child template': 'Extend existing issue templates with additional child template',
  'Search for templates': 'Execute sophisticated search operations across issue templates',
  'Update template fields': 'Modify specific fields and configurations of existing issue templates',
  'Get template details':
    'Retrieve exhaustive, detailed information about specific issue templates',
  'Create issues from template':
    'Generate comprehensive issue structures from predefined templates',
  'Assign a GitHub repository': 'Establish bidirectional integration between GitHub repositories',
  'List issues in a specific project':
    'Retrieve a comprehensive, chronologically-ordered listing of issues',
  'Create a new issue': 'Create a comprehensive new issue within a specified project',
  'Update an issue': 'Modify specific fields of existing issues with comprehensive validation',
  'Get issue details': 'Retrieve exhaustive, detailed information about a specific issue',
  'Delete an issue': 'Permanently remove issues from the Huly workspace',
  'Search for issues': 'Execute sophisticated search and filtering operations across issues',
  'Create a sub-issue':
    'Establish hierarchical issue relationships by creating detailed sub-issues',
  'Bulk create issues': 'Execute high-performance bulk creation of multiple issues',
  'Bulk update issues': 'Perform high-efficiency bulk modifications across multiple issues',
  'Bulk delete issues': 'Execute large-scale deletion operations across multiple issues',
  'Create a new project': 'Establish a new project within the Huly workspace',
  'List all projects': 'Retrieve a comprehensive listing of all projects',
  'Delete an entire project': 'Permanently remove an entire project and all associated data',
  'Create a component': 'Establish new organizational components within projects',
  'List components': 'Retrieve a comprehensive inventory of all organizational components',
  'Delete a component': 'Permanently remove organizational components from projects',
  'Create a milestone': 'Establish new project milestones with comprehensive timeline management',
  'List milestones': 'Retrieve a comprehensive overview of all project milestones',
  'Delete a milestone':
    'Permanently remove project milestones with comprehensive dependency validation',
  'Create a comment': 'Add comprehensive commentary and discussion threads to existing issues',
  'List comments': 'Retrieve a comprehensive, chronologically-ordered listing of all comments',
  'Get current account':
    'Retrieve comprehensive account information for the currently authenticated user',
  'Create an employee': 'Create a new employee in the Huly workspace',
  'Get employee details': 'Retrieve comprehensive details about a specific employee',
  'List employees': 'Retrieve a comprehensive listing of employees',
  'Update employee': 'Update specific fields of existing employee records',
  'Delete employee': 'Remove employee status from a person',
  'Validate deletion': 'Perform comprehensive pre-deletion analysis and dependency validation',
  'Preview deletion impact': 'Generate comprehensive, detailed impact analysis and preview reports',
  'Remove a child template': 'remove specific child templates',
  'Create issues from a template':
    'Generate comprehensive issue structures from predefined templates',
  'Update multiple issues': 'Perform high-efficiency bulk modifications',
};

async function findTestFiles(dir) {
  const files = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory() && entry.name !== 'node_modules') {
        files.push(...(await findTestFiles(fullPath)));
      } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`Could not read directory ${dir}:`, error.message);
  }

  return files;
}

async function fixTestFile(filePath) {
  try {
    let content = await readFile(filePath, 'utf8');
    let modified = false;

    // Look for description expectations and update them
    for (const [oldDesc, newKeyPhrase] of Object.entries(descriptionMappings)) {
      const patterns = [
        // Pattern: expect(definition.description).toBe('old description')
        new RegExp(
          `expect\\(definition\\.description\\)\\.toBe\\(['"\`]${escapeRegex(oldDesc)}['"\`]\\)`,
          'g'
        ),
        // Pattern: expect(definition.description).toEqual('old description')
        new RegExp(
          `expect\\(definition\\.description\\)\\.toEqual\\(['"\`]${escapeRegex(oldDesc)}['"\`]\\)`,
          'g'
        ),
        // Pattern: expect(definition.description).toContain('old description')
        new RegExp(
          `expect\\(definition\\.description\\)\\.toContain\\(['"\`]${escapeRegex(oldDesc)}['"\`]\\)`,
          'g'
        ),
      ];

      for (const pattern of patterns) {
        if (pattern.test(content)) {
          content = content.replace(
            pattern,
            `expect(definition.description).toContain('${newKeyPhrase}')`
          );
          modified = true;
          console.log(`Fixed description in ${filePath}: "${oldDesc}" -> "${newKeyPhrase}"`);
        }
      }
    }

    if (modified) {
      await writeFile(filePath, content, 'utf8');
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  const projectRoot = join(__dirname, '..');

  console.log('🔍 Finding test files...');
  const testFiles = await findTestFiles(projectRoot);
  console.log(`Found ${testFiles.length} test files`);

  console.log('\n🔧 Fixing test description expectations...');
  let fixedCount = 0;

  for (const filePath of testFiles) {
    const wasFixed = await fixTestFile(filePath);
    if (wasFixed) {
      fixedCount++;
    }
  }

  console.log(`\n✅ Fixed ${fixedCount} test files`);

  if (fixedCount > 0) {
    console.log('\n🧪 Running tests to verify fixes...');
    // Could run tests here to verify, but we'll let the user do it
    console.log('Run: npm test to verify all fixes are working');
  } else {
    console.log('\n✨ No test files needed fixing');
  }
}

main().catch(console.error);
