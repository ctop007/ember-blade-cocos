#!/bin/bash
# usage: tools/mcp.sh <tool> '<json args>'  — calls funplay-cocos-mcp over JSON-RPC
TOOL="$1"; ARGS="${2:-{\}}"
curl -s -m 120 http://127.0.0.1:18765/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$TOOL\",\"arguments\":$ARGS}}"
echo
