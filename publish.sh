#!/bin/bash

echo "📦 Publishing expo-perfect-canvas to npm"
echo "========================================="
echo ""

# Check if logged in to npm
echo "Checking npm login status..."
npm whoami 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ Not logged in to npm"
    echo "Please run: npm login"
    echo "Then run this script again."
    exit 1
fi

echo "✅ Logged in to npm"
echo ""

# Verify package
echo "📋 Package details:"
echo "Name: expo-perfect-canvas"
echo "Version: 1.0.0"
echo "Author: Jan Horak"
echo ""

# Dry run first
echo "🔍 Running dry-run to verify package contents..."
npm pack --dry-run

echo ""
read -p "Do you want to publish to npm? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Publishing to npm..."
    npm publish --access public
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Successfully published!"
        echo "📦 Package available at: https://www.npmjs.com/package/expo-perfect-canvas"
        echo "🎉 Users can now install with: npm install expo-perfect-canvas"
    else
        echo "❌ Publishing failed. Please check the error above."
    fi
else
    echo "❌ Publishing cancelled."
fi