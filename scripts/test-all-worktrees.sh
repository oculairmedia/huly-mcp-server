#!/bin/bash

# Test All Worktrees Script
# Tests all active worktrees without Docker, using stdio/HTTP on different ports
# Usage: ./scripts/test-all-worktrees.sh [--parallel]

# Configuration
BASE_PORT=6400
PARALLEL=false
if [ "$1" == "--parallel" ]; then
    PARALLEL=true
fi

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Testing All Active Worktrees ===${NC}"
echo ""

# Get all worktrees
WORKTREES=$(git worktree list --porcelain | grep "worktree" | awk '{print $2}')

# Track test results
declare -A test_results
declare -A test_ports
CURRENT_PORT=$BASE_PORT

# Function to test a single worktree
test_worktree() {
    local worktree=$1
    local port=$2
    local branch=$3
    
    echo -e "${CYAN}Testing $branch on port $port...${NC}"
    
    cd "$worktree" 2>/dev/null || return 1
    
    # Check if test-stdio.sh exists
    if [ -f "scripts/test-stdio.sh" ]; then
        # Run stdio test
        if ./scripts/test-stdio.sh >/dev/null 2>&1; then
            echo -e "${GREEN}  ✅ stdio test passed${NC}"
            STDIO_RESULT="PASS"
        else
            echo -e "${RED}  ❌ stdio test failed${NC}"
            STDIO_RESULT="FAIL"
        fi
    else
        STDIO_RESULT="N/A"
    fi
    
    # Start HTTP server for testing
    echo -e "${YELLOW}  Starting HTTP server on port $port...${NC}"
    
    # Create a test script that starts the server
    cat > /tmp/test-http-$port.sh << EOF
#!/bin/bash
cd "$worktree"
PORT=$port node index.js --transport http >/tmp/mcp-test-$port.log 2>&1 &
echo \$! > /tmp/mcp-test-$port.pid
EOF
    
    chmod +x /tmp/test-http-$port.sh
    /tmp/test-http-$port.sh
    
    # Wait for server to start
    sleep 2
    
    # Test HTTP endpoint
    HTTP_TEST=$(curl -s -X POST "http://localhost:$port/mcp" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc": "2.0", "method": "tools/list", "params": {}, "id": 1}' \
        2>/dev/null)
    
    if echo "$HTTP_TEST" | grep -q "huly_"; then
        echo -e "${GREEN}  ✅ HTTP test passed${NC}"
        HTTP_RESULT="PASS"
    else
        echo -e "${RED}  ❌ HTTP test failed${NC}"
        HTTP_RESULT="FAIL"
    fi
    
    # Kill the test server
    if [ -f /tmp/mcp-test-$port.pid ]; then
        kill $(cat /tmp/mcp-test-$port.pid) 2>/dev/null
        rm -f /tmp/mcp-test-$port.pid
    fi
    
    # Store results
    test_results["$branch"]="stdio:$STDIO_RESULT http:$HTTP_RESULT"
    
    # Clean up
    rm -f /tmp/test-http-$port.sh /tmp/mcp-test-$port.log
    
    return 0
}

# Test each worktree
if [ "$PARALLEL" == true ]; then
    echo -e "${YELLOW}Running tests in parallel...${NC}"
    echo ""
fi

for worktree in $WORKTREES; do
    if [[ "$worktree" == *"/main" ]] || [[ "$worktree" == *"/.git" ]]; then
        continue
    fi
    
    # Get branch name
    cd "$worktree" 2>/dev/null || continue
    BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    
    if [[ ! $BRANCH =~ HULLY-[0-9]+ ]]; then
        continue
    fi
    
    # Assign port
    test_ports["$BRANCH"]=$CURRENT_PORT
    
    if [ "$PARALLEL" == true ]; then
        # Run test in background
        test_worktree "$worktree" "$CURRENT_PORT" "$BRANCH" &
    else
        # Run test sequentially
        test_worktree "$worktree" "$CURRENT_PORT" "$BRANCH"
        echo ""
    fi
    
    ((CURRENT_PORT++))
done

# Wait for parallel tests to complete
if [ "$PARALLEL" == true ]; then
    echo -e "${YELLOW}Waiting for all tests to complete...${NC}"
    wait
    echo ""
fi

# Return to original directory
cd /opt/stacks/huly-selfhost/huly-mcp-server 2>/dev/null

# Display results summary
echo -e "${BLUE}=== Test Results Summary ===${NC}"
echo ""

TOTAL_PASS=0
TOTAL_FAIL=0

for branch in "${!test_results[@]}"; do
    RESULT="${test_results[$branch]}"
    PORT="${test_ports[$branch]}"
    
    echo -e "📋 $branch (port $PORT):"
    
    # Parse results
    if [[ "$RESULT" == *"stdio:PASS"* ]]; then
        echo -e "   stdio: ${GREEN}✅ PASS${NC}"
        ((TOTAL_PASS++))
    elif [[ "$RESULT" == *"stdio:FAIL"* ]]; then
        echo -e "   stdio: ${RED}❌ FAIL${NC}"
        ((TOTAL_FAIL++))
    else
        echo -e "   stdio: ${YELLOW}N/A${NC}"
    fi
    
    if [[ "$RESULT" == *"http:PASS"* ]]; then
        echo -e "   HTTP:  ${GREEN}✅ PASS${NC}"
        ((TOTAL_PASS++))
    else
        echo -e "   HTTP:  ${RED}❌ FAIL${NC}"
        ((TOTAL_FAIL++))
    fi
    echo ""
done

# Overall summary
echo -e "${BLUE}=== Overall Summary ===${NC}"
echo -e "Total tests run: $((TOTAL_PASS + TOTAL_FAIL))"
echo -e "Passed: ${GREEN}$TOTAL_PASS${NC}"
echo -e "Failed: ${RED}$TOTAL_FAIL${NC}"
echo ""

if [ $TOTAL_FAIL -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please check individual worktrees.${NC}"
    exit 1
fi