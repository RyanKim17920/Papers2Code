#!/bin/bash
"""
Vercel Deployment Guide for Papers2Code

This script helps you deploy your Papers2Code app to Vercel.
"""

set -e

echo "🚀 Setting up Papers2Code for Vercel deployment..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Pre-deployment checklist:${NC}"
echo "1. Make sure you have a Vercel account (vercel.com)"
echo "2. Install Vercel CLI: npm i -g vercel"
echo "3. Have your MongoDB connection string ready"
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
fi

echo -e "${BLUE}🔧 Setting up project structure...${NC}"

# Make sure API directory exists with proper structure
mkdir -p api/cron

# Check if main requirements exist
if [[ ! -f "papers2code_app2/requirements.txt" ]]; then
    echo -e "${YELLOW}📦 Creating requirements.txt...${NC}"
    # We'll use the API requirements as base
    cp api/requirements.txt papers2code_app2/requirements.txt
fi

echo -e "${GREEN}✅ Project structure ready!${NC}"
echo ""
echo -e "${BLUE}📝 Manual steps you need to do:${NC}"
echo ""
echo "1. Run: ${YELLOW}vercel login${NC}"
echo "2. Run: ${YELLOW}vercel${NC} (in this directory)"
echo "3. When prompted:"
echo "   - Set up and deploy: ${YELLOW}Y${NC}"
echo "   - Which scope: Choose your account"
echo "   - Link to existing project: ${YELLOW}N${NC}"
echo "   - Project name: ${YELLOW}papers2code${NC}"
echo "   - Directory: ${YELLOW}./papers2code-ui${NC} (or just press Enter)"
echo ""
echo "4. After deployment, set environment variables:"
echo "   ${YELLOW}vercel env add MONGO_CONNECTION_STRING${NC}"
echo "   (Paste your MongoDB connection string)"
echo ""
echo "5. Redeploy with env vars:"
echo "   ${YELLOW}vercel --prod${NC}"
echo ""
echo -e "${GREEN}🎉 Your app will be live at: https://papers2code-[random].vercel.app${NC}"
echo ""
echo -e "${BLUE}🔄 For updates:${NC}"
echo "Just run: ${YELLOW}git push${NC} (if you set up Git integration)"
echo "Or run: ${YELLOW}vercel --prod${NC}"
echo ""
echo -e "${BLUE}📊 To check cron jobs:${NC}"
echo "Visit your Vercel dashboard → Functions → Cron"
echo "The email updater will run every 5 minutes automatically!"
echo ""

# Offer to start deployment
read -p "Ready to start deployment? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🚀 Starting Vercel deployment...${NC}"
    vercel
else
    echo -e "${YELLOW}👍 Run 'vercel' when you're ready to deploy!${NC}"
fi
