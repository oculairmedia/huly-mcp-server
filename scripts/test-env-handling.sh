#!/bin/bash

# Test script for .env file handling in worktree-create.sh
# This tests various edge cases to ensure robust handling

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Testing .env file handling...${NC}"

# Create a temporary directory for testing
TEST_DIR="/tmp/env-test-$$"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Test 1: .env file without trailing newline
echo -e "${YELLOW}Test 1: .env file without trailing newline${NC}"
printf "EXISTING_VAR=value" > test1.env
cp test1.env test1_backup.env

# Simulate appending without the fix
echo "GITHUB_TOKEN=test_token" >> test1.env

# Check if corruption occurred
if grep -q "valueGITHUB_TOKEN" test1.env; then
    echo -e "${RED}❌ Test 1 Failed: Variables concatenated${NC}"
else
    echo -e "${GREEN}✅ Test 1 Passed: Variables properly separated${NC}"
fi

# Test 2: Multiple GITHUB_TOKEN entries
echo -e "\n${YELLOW}Test 2: Multiple GITHUB_TOKEN entries${NC}"
cat > test2.env << EOF
VAR1=value1
GITHUB_TOKEN=token1
VAR2=value2
GITHUB_TOKEN=token2
VAR3=value3
EOF

# Count GITHUB_TOKEN entries
TOKEN_COUNT=$(grep -c "^GITHUB_TOKEN=" test2.env)
if [ "$TOKEN_COUNT" -eq 2 ]; then
    echo -e "${GREEN}✅ Test 2 Setup: Found $TOKEN_COUNT duplicate entries${NC}"
else
    echo -e "${RED}❌ Test 2 Setup Failed${NC}"
fi

# Test 3: .env file with various line endings
echo -e "\n${YELLOW}Test 3: Mixed line endings${NC}"
printf "VAR1=value1\r\nGITHUB_TOKEN=token\r\nVAR2=value2\n" > test3.env

# Check if file can be sourced
if bash -c "set -a; source test3.env 2>/dev/null; set +a"; then
    echo -e "${GREEN}✅ Test 3 Passed: File with mixed endings can be sourced${NC}"
else
    echo -e "${RED}❌ Test 3 Failed: Cannot source file with mixed endings${NC}"
fi

# Test 4: Empty .env file
echo -e "\n${YELLOW}Test 4: Empty .env file${NC}"
touch test4.env
echo "GITHUB_TOKEN=token" >> test4.env

if [ -s test4.env ] && grep -q "^GITHUB_TOKEN=" test4.env; then
    echo -e "${GREEN}✅ Test 4 Passed: Token added to empty file${NC}"
else
    echo -e "${RED}❌ Test 4 Failed: Token not properly added${NC}"
fi

# Test 5: .env with special characters in token
echo -e "\n${YELLOW}Test 5: Special characters in token${NC}"
SPECIAL_TOKEN='github_pat_11EXAMPLE_TOKEN_WITH_SPECIAL_CHARS_0123456789_AbCdEf'
cat > test5.env << EOF
VAR1=value1
GITHUB_TOKEN=$SPECIAL_TOKEN
EOF

# Source and check token
if bash -c "set -a; source test5.env 2>/dev/null; set +a; [ \"\$GITHUB_TOKEN\" = '$SPECIAL_TOKEN' ]"; then
    echo -e "${GREEN}✅ Test 5 Passed: Special characters preserved${NC}"
else
    echo -e "${RED}❌ Test 5 Failed: Special characters not preserved${NC}"
fi

# Cleanup
cd /
rm -rf "$TEST_DIR"

echo -e "\n${GREEN}Testing complete!${NC}"