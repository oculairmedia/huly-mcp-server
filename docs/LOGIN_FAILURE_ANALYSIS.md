# Huly MCP Server Login Failure Analysis

**Date**: 2025-09-30  
**Status**: 🔴 Investigating Authentication Failure  
**Error**: "Login failed" - token is undefined after login RPC call

---

## 🐛 Problem Summary

The Huly MCP server successfully connects to the platform and loads configuration, but fails during the authentication step with "Login failed".

### Error Location

```
Error: Login failed
    at getWorkspaceToken (huly-selfhost/huly-mcp-server/node_modules/@hcengineering/api-client/lib/utils.js:42:15)
```

### Authentication Flow

The `@hcengineering/api-client` follows this flow:

1. ✅ Load `/config.json` from base URL
2. ✅ Extract `ACCOUNTS_URL` from config
3. ❌ **Call login RPC** → Returns `undefined` token
4. ❌ Throw "Login failed" error

---

## 🔍 Root Cause Analysis

### The Login RPC Call

From `hully source/packages/api-client/src/utils.ts`:

```typescript
export async function getWorkspaceToken (
  url: string,
  options: AuthOptions,
  config?: ServerConfig
): Promise<WorkspaceToken> {
  config ??= await loadServerConfig(url)

  let token: string | undefined

  if ('token' in options) {
    token = options.token
  } else {
    const { email, password } = options
    const loginInfo = await getAccountClient(config.ACCOUNTS_URL).login(email, password)
    token = loginInfo.token  // ← This is undefined!
  }

  if (token === undefined) {
    throw new Error('Login failed')  // ← Error thrown here
  }
  // ...
}
```

### Why Token is Undefined

From `hully source/server/account/src/operations.ts`:

```typescript
export async function login (
  ctx: MeasureContext,
  db: AccountDB,
  branding: Branding | null,
  token: string,
  params: { email: string, password: string }
): Promise<LoginInfo> {
  const { email, password } = params
  
  // ... validation and password check ...
  
  const isConfirmed = emailSocialId.verifiedOn != null
  
  return {
    account: existingAccount.uuid,
    token: isConfirmed ? generateToken(existingAccount.uuid, undefined, extraToken) : undefined,  // ← Token only if confirmed!
    name: getPersonName(person),
    socialId: emailSocialId._id
  }
}
```

**Key Finding**: The token is only returned if `emailSocialId.verifiedOn != null`, meaning **the email must be verified**.

---

## 🎯 Possible Causes

### 1. Email Not Verified (MOST LIKELY)

**Symptom**: Login succeeds but returns `token: undefined`

**Cause**: The account exists but the email address has not been verified via OTP or confirmation link.

**Solution**: Verify the email address through the Huly UI or use the OTP flow.

**How to Check**:
```bash
# Run the debug script
node huly-mcp-server/test-login-debug.js
```

If you see:
```json
{
  "account": "...",
  "token": undefined,  // ← Email not verified
  "name": "...",
  "socialId": "..."
}
```

Then the email needs verification.

### 2. Incorrect Credentials

**Symptom**: Login RPC returns an error

**Cause**: Wrong email or password

**Solution**: Verify credentials are correct

**How to Check**: The debug script will show the exact RPC error

### 3. Account Service Not Accessible

**Symptom**: Cannot reach `ACCOUNTS_URL`

**Cause**: Network issue or incorrect URL in `/config.json`

**Solution**: Verify `ACCOUNTS_URL` is accessible

**How to Check**:
```bash
curl https://pm.oculair.ca/config.json
# Should show ACCOUNTS_URL

curl https://pm.oculair.ca/_accounts/providers
# Should return provider list
```

### 4. Account Doesn't Exist

**Symptom**: Login RPC returns "Account not found" error

**Cause**: User hasn't signed up yet

**Solution**: Create account through Huly UI first

---

## 🔧 Solutions

### Solution 1: Verify Email Address (RECOMMENDED)

If the account exists but email is not verified:

**Option A: Through Huly UI**
1. Go to https://pm.oculair.ca
2. Log in with the credentials
3. Check for email verification prompt
4. Complete email verification

**Option B: Use OTP Flow (if enabled)**
```javascript
import { getClient } from '@hcengineering/account-client';

const accountClient = getClient('https://pm.oculair.ca/_accounts');

// Request OTP
const otpInfo = await accountClient.loginOtp('emanuvaderland@gmail.com');

// Check email for OTP code, then validate
const loginInfo = await accountClient.validateOtp(
  'emanuvaderland@gmail.com',
  'OTP_CODE_FROM_EMAIL',
  'k2a8yy7sFWVZ6eL'
);

// Now loginInfo.token should be defined
```

**Option C: Admin Verification (if you have DB access)**
```javascript
// Connect to MongoDB
use huly

// Find the social ID
db.socialId.find({ email: "emanuvaderland@gmail.com" })

// Update verifiedOn field
db.socialId.updateOne(
  { email: "emanuvaderland@gmail.com" },
  { $set: { verifiedOn: new Date() } }
)
```

### Solution 2: Create New Account

If account doesn't exist:

```bash
# Through Huly UI
1. Go to https://pm.oculair.ca
2. Click "Sign Up"
3. Enter email and password
4. Verify email
5. Create workspace named "agentspace"
```

### Solution 3: Use Token-Based Authentication

If you already have a valid token:

```javascript
// In HulyClient.js
const client = await connect(this.config.url, {
  token: 'YOUR_EXISTING_TOKEN',  // Instead of email/password
  workspace: this.config.workspace,
  socketFactory: (url) => new WebSocket(url),
});
```

**How to get a token**:
1. Log in through Huly UI
2. Open browser DevTools → Application → Local Storage
3. Find the token in storage
4. Use it in MCP server config

---

## 🧪 Diagnostic Steps

### Step 1: Run Debug Script

```bash
cd huly-mcp-server
node test-login-debug.js
```

This will show exactly where the login process fails.

### Step 2: Check Account Service

```bash
# Test config endpoint
curl https://pm.oculair.ca/config.json

# Test providers endpoint (no auth required)
curl https://pm.oculair.ca/_accounts/providers

# Test login RPC
curl -X POST https://pm.oculair.ca/_accounts \
  -H "Content-Type: application/json" \
  -d '{
    "method": "login",
    "params": {
      "email": "emanuvaderland@gmail.com",
      "password": "k2a8yy7sFWVZ6eL"
    }
  }'
```

Expected response if email is verified:
```json
{
  "result": {
    "account": "...",
    "token": "eyJ...",  // ← Should be present
    "name": "...",
    "socialId": "..."
  }
}
```

Expected response if email is NOT verified:
```json
{
  "result": {
    "account": "...",
    "token": undefined,  // ← Missing!
    "name": "...",
    "socialId": "..."
  }
}
```

### Step 3: Check Email Verification Status

```bash
# Connect to MongoDB
docker-compose exec mongodb mongosh

# Switch to Huly database
use huly

# Find social ID for the email
db.socialId.find({ email: "emanuvaderland@gmail.com" }).pretty()

# Check if verifiedOn field exists and has a date
# If verifiedOn is null or missing, email is not verified
```

---

## 📚 Reference: Account Service RPC Methods

From `hully source/server/account/ACCOUNT_SERVICE_RPC_ROUTES.md`:

### Authentication Methods

1. **login** (deprecated - requires verified email)
   - Parameters: `{ email, password }`
   - Returns: `{ account, token?, name, socialId }`
   - Note: `token` is only returned if email is verified

2. **loginOtp** (recommended)
   - Parameters: `{ email }`
   - Returns: `{ _id, retryOn }`
   - Sends OTP to email

3. **validateOtp**
   - Parameters: `{ email, code, password? }`
   - Returns: `{ account, token, name, socialId }`
   - Validates OTP and returns token

### Workspace Methods

4. **selectWorkspace**
   - Parameters: `{ workspaceUrl, kind?, externalRegions? }`
   - Returns: `{ account, token, workspace, endpoint, role }`
   - Requires: Authorization header with token from login

---

## 🎯 Recommended Action Plan

1. **Run diagnostic script** to confirm the exact failure point
2. **Check if email is verified** in MongoDB or through UI
3. **If not verified**: Complete email verification through UI or OTP flow
4. **If verified**: Check credentials are correct
5. **Test connection again** after verification

---

## 📝 Additional Notes

### Email Verification Requirement

Huly requires email verification for security. This is enforced in the login flow:

```typescript
const isConfirmed = emailSocialId.verifiedOn != null
return {
  account: existingAccount.uuid,
  token: isConfirmed ? generateToken(...) : undefined,  // No token if not confirmed
  name: getPersonName(person),
  socialId: emailSocialId._id
}
```

### Alternative: Disable Email Verification (NOT RECOMMENDED)

For development/testing only, you could modify the account service to skip verification:

```typescript
// In server/account/src/operations.ts
return {
  account: existingAccount.uuid,
  token: generateToken(existingAccount.uuid, undefined, extraToken),  // Always return token
  name: getPersonName(person),
  socialId: emailSocialId._id
}
```

**Warning**: This bypasses security and should never be used in production.

---

## 🔄 Next Steps

1. Run `node huly-mcp-server/test-login-debug.js`
2. Review the output to identify the exact failure
3. Follow the appropriate solution based on the diagnostic results
4. Update this document with findings

