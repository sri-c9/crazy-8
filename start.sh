#!/bin/bash

# Start the Crazy 8 game server
echo "🎮 Starting Crazy 8 server..."

# Build the frontend
echo "📦 Building frontend..."
bun run build

# Start the server
echo "🚀 Starting server on http://localhost:3000"
echo "   Press Ctrl+C to stop"
echo ""
bun dev
