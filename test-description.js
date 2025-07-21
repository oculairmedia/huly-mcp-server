#!/usr/bin/env node
import { connectPlatform } from './src/core/PlatformClient.js';
import trackerModule from '@hcengineering/tracker';
import { config } from 'dotenv';

config();

const tracker = trackerModule.default || trackerModule;

async function test() {
  const client = await connectPlatform();

  // Find an issue with a description
  const issues = await client.findAll(
    tracker.class.Issue,
    { description: { $ne: null } },
    { limit: 5 }
  );

  console.log('Found issues with descriptions:', issues.length);

  for (const issue of issues) {
    console.log('\n---');
    console.log('Issue:', issue.identifier);
    console.log('Description field type:', typeof issue.description);
    console.log('Description field value:', issue.description);

    if (typeof issue.description === 'string') {
      console.log('Description length:', issue.description.length);
      console.log('First 100 chars:', issue.description.substring(0, 100));

      // Check if it's a JSON string
      if (issue.description.startsWith('{')) {
        try {
          const parsed = JSON.parse(issue.description);
          console.log('Parsed as JSON:', `${JSON.stringify(parsed, null, 2).substring(0, 200)}...`);
        } catch {
          console.log('Not valid JSON');
        }
      }

      // Check if it looks like a blob reference
      if (issue.description.match(/^[a-f0-9]{24}$/)) {
        console.log('Looks like a blob reference (24 hex chars)');
      }
    }
  }

  await client.close();
}

test().catch(console.error);
