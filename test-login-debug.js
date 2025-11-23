#!/usr/bin/env node
/**
 * Debug script to test Huly login process step-by-step
 */

const config = {
  baseUrl: 'https://pm.oculair.ca',
  email: 'emanuvaderland@gmail.com',
  password: 'k2a8yy7sFWVZ6eL',
  workspace: 'agentspace'
};

console.log('='.repeat(80));
console.log('HULY LOGIN DEBUG TEST');
console.log('='.repeat(80));
console.log('Base URL:', config.baseUrl);
console.log('Email:', config.email);
console.log('Workspace:', config.workspace);
console.log('');

async function testStep(stepName, fn) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`STEP: ${stepName}`);
  console.log('='.repeat(80));
  try {
    const result = await fn();
    console.log('✅ SUCCESS');
    return result;
  } catch (error) {
    console.log('❌ FAILED');
    console.error('Error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    throw error;
  }
}

async function main() {
  try {
    // Step 1: Load server config
    const serverConfig = await testStep('Load server config from /config.json', async () => {
      const configUrl = `${config.baseUrl}/config.json`;
      console.log('Fetching:', configUrl);
      
      const response = await fetch(configUrl);
      console.log('Status:', response.status, response.statusText);
      console.log('Headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const text = await response.text();
        console.log('Response body:', text.substring(0, 500));
        throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
      }
      
      const config = await response.json();
      console.log('Server config:', JSON.stringify(config, null, 2));
      return config;
    });

    // Step 2: Test accounts URL accessibility
    await testStep('Test accounts URL accessibility', async () => {
      const accountsUrl = serverConfig.ACCOUNTS_URL;
      console.log('Accounts URL:', accountsUrl);
      
      // Try to fetch providers endpoint (should work without auth)
      const providersUrl = `${accountsUrl}/providers`;
      console.log('Testing providers endpoint:', providersUrl);
      
      const response = await fetch(providersUrl);
      console.log('Status:', response.status, response.statusText);
      
      if (response.ok) {
        const providers = await response.json();
        console.log('Providers:', JSON.stringify(providers, null, 2));
      } else {
        const text = await response.text();
        console.log('Response:', text.substring(0, 500));
      }
      
      return accountsUrl;
    });

    // Step 3: Attempt login via RPC
    const loginInfo = await testStep('Login via JSON-RPC', async () => {
      const accountsUrl = serverConfig.ACCOUNTS_URL;
      console.log('Sending login RPC to:', accountsUrl);
      
      const request = {
        method: 'login',
        params: {
          email: config.email,
          password: config.password
        }
      };
      
      console.log('Request:', JSON.stringify(request, null, 2));
      
      const response = await fetch(accountsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Connection': 'keep-alive'
        },
        body: JSON.stringify(request)
      });
      
      console.log('Status:', response.status, response.statusText);
      console.log('Headers:', Object.fromEntries(response.headers.entries()));
      
      const responseText = await response.text();
      console.log('Response body:', responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Failed to parse JSON response: ${responseText.substring(0, 200)}`);
      }
      
      if (result.error) {
        console.log('RPC Error:', JSON.stringify(result.error, null, 2));
        throw new Error(`Login RPC failed: ${JSON.stringify(result.error)}`);
      }
      
      if (!result.result) {
        throw new Error('No result in RPC response');
      }
      
      console.log('Login result:', JSON.stringify(result.result, null, 2));
      
      if (!result.result.token) {
        throw new Error('No token in login result - email may not be verified');
      }
      
      return result.result;
    });

    // Step 4: Select workspace
    const workspaceInfo = await testStep('Select workspace', async () => {
      const accountsUrl = serverConfig.ACCOUNTS_URL;
      const token = loginInfo.token;
      
      console.log('Using token:', token.substring(0, 20) + '...');
      console.log('Selecting workspace:', config.workspace);
      
      const request = {
        method: 'selectWorkspace',
        params: {
          workspaceUrl: config.workspace,
          kind: 'external',
          externalRegions: []
        }
      };
      
      console.log('Request:', JSON.stringify(request, null, 2));
      
      const response = await fetch(accountsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Connection': 'keep-alive',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(request)
      });
      
      console.log('Status:', response.status, response.statusText);
      
      const responseText = await response.text();
      console.log('Response body:', responseText);
      
      const result = JSON.parse(responseText);
      
      if (result.error) {
        console.log('RPC Error:', JSON.stringify(result.error, null, 2));
        throw new Error(`selectWorkspace RPC failed: ${JSON.stringify(result.error)}`);
      }
      
      if (!result.result) {
        throw new Error('Workspace not found');
      }
      
      console.log('Workspace info:', JSON.stringify(result.result, null, 2));
      return result.result;
    });

    // Step 5: Summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ ALL STEPS COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log('Account UUID:', loginInfo.account);
    console.log('Workspace UUID:', workspaceInfo.workspace);
    console.log('Workspace endpoint:', workspaceInfo.endpoint);
    console.log('Workspace token:', workspaceInfo.token.substring(0, 20) + '...');
    console.log('');
    console.log('Connection should work with these credentials!');
    
  } catch (error) {
    console.log('\n' + '='.repeat(80));
    console.log('❌ TEST FAILED');
    console.log('='.repeat(80));
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();

