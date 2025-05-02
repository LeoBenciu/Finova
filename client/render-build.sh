#!/usr/bin/env bash
# Build script for Render

# Build the application
npm run build

# Create a rewrite rule for render
echo '/* /index.html 200' > dist/_redirects

# Ensure serve.json exists
echo '{"rewrites": [{ "source": "/**", "destination": "/index.html" }]}' > dist/serve.json

# Create a copy of index.html named 200.html (used by some static hosts)
cp dist/index.html dist/200.html

# Create a copy of index.html named 404.html
cp dist/index.html dist/404.html