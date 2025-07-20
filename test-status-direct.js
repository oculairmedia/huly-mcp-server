#!/usr/bin/env node

// Direct test to check status availability in HULLY project

import { createHulyClient } from './src/core/index.js';
import trackerModule from '@hcengineering/tracker';

const tracker = trackerModule.default || trackerModule;

async function testStatuses() {
  console.log('Testing status availability in HULLY project...\n');

  const config = {
    url: 'http://pm.oculair.ca',
    email: 'emanuvaderland@gmail.com',
    password: 'k2a8yy7sFWVZ6eL',
    workspace: 'agentspace',
  };

  const hulyClient = createHulyClient(config);

  try {
    await hulyClient.connect();
    console.log('✅ Connected to Huly\n');

    await hulyClient.withClient(async (client) => {
      // Find the HULLY project
      const project = await client.findOne(tracker.class.Project, {
        identifier: 'HULLY',
      });

      if (!project) {
        console.log('❌ HULLY project not found');
        return;
      }

      console.log(`✅ Found project: ${project.name} (${project.identifier})`);
      console.log(`   Project ID: ${project._id}\n`);

      // Find all statuses in the project
      console.log('Querying for IssueStatus objects...');
      const statuses = await client.findAll(tracker.class.IssueStatus, {
        space: project._id,
      });

      console.log(`\nFound ${statuses.length} statuses in project:\n`);

      if (statuses.length === 0) {
        console.log('❌ No statuses found! This is the problem.');

        // Try to find statuses without space filter
        console.log('\nTrying to find all statuses in workspace...');
        const allStatuses = await client.findAll(tracker.class.IssueStatus, {});
        console.log(`Found ${allStatuses.length} total statuses in workspace`);

        if (allStatuses.length > 0) {
          console.log('\nFirst few statuses:');
          allStatuses.slice(0, 5).forEach((s) => {
            console.log(`- ${s.name} (space: ${s.space}, category: ${s.category})`);
          });
        }
      } else {
        statuses.forEach((status, index) => {
          console.log(`${index + 1}. Status: ${status.name}`);
          console.log(`   ID: ${status._id}`);
          console.log(`   Category: ${status.category || 'N/A'}`);
          console.log(`   Description: ${status.description || 'N/A'}`);
          console.log(`   Space: ${status.space}`);
          console.log('');
        });
      }

      // Test finding a specific issue
      console.log('\nTesting with issue HULLY-190...');
      const issue = await client.findOne(tracker.class.Issue, {
        identifier: 'HULLY-190',
      });

      if (issue) {
        console.log(`✅ Found issue: ${issue.identifier}`);
        console.log(`   Current status ID: ${issue.status}`);
        console.log(`   Issue space: ${issue.space}`);
        console.log(`   Space matches project: ${issue.space === project._id}`);

        // Try to find the status object for this issue
        const issueStatus = await client.findOne(tracker.class.IssueStatus, {
          _id: issue.status,
        });

        if (issueStatus) {
          console.log(`\n   Current status details:`);
          console.log(`   - Name: ${issueStatus.name}`);
          console.log(`   - Category: ${issueStatus.category}`);
          console.log(`   - Space: ${issueStatus.space}`);
        }
      }
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await hulyClient.disconnect();
    console.log('\n✅ Disconnected from Huly');
  }
}

testStatuses().catch(console.error);
