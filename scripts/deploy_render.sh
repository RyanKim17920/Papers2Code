#!/bin/bash
"""
Render Deployment for Papers2Code

Render is perfect for full-stack apps - free tier available!
"""

set -e

echo "🎨 Setting up Papers2Code for Render deployment..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}📋 Render Setup Guide:${NC}"
echo ""
echo "Render advantages for your app:"
echo "• ✅ Free tier available (backend sleeps after 15min)"
echo "• ✅ Always-on for $7/month (backend)"
echo "• ✅ Free static sites (frontend)"
echo "• ✅ One platform for both services"
echo "• ✅ Auto-deploys from Git"
echo "• ✅ Built-in databases available"
echo ""

echo -e "${YELLOW}💰 Cost: Free to start, $7/month for always-on backend${NC}"
echo ""

echo -e "${BLUE}🔧 Steps to deploy:${NC}"
echo ""
echo "1. Go to render.com and sign up with GitHub"
echo "2. Click 'New' → 'Blueprint'"
echo "3. Connect this repository"
echo "4. Render will use the render.yaml configuration"
echo "5. Set required environment variables"
echo ""

echo -e "${BLUE}🔐 Environment Variables to set:${NC}"
echo "In Render dashboard, set these secrets:"
echo "• ${YELLOW}MONGO_CONNECTION_STRING${NC} = your MongoDB Atlas connection string"
echo "• ${YELLOW}GITHUB_CLIENT_ID${NC} = your GitHub OAuth app client ID"
echo "• ${YELLOW}GITHUB_CLIENT_SECRET${NC} = your GitHub OAuth app client secret"
echo ""

echo -e "${BLUE}📦 Services that will be created:${NC}"
echo "• ${YELLOW}papers2code-api${NC} - FastAPI backend (Web Service)"
echo "• ${YELLOW}papers2code-frontend${NC} - React frontend (Static Site)"
echo ""

echo -e "${GREEN}🎉 Total setup time: ~5 minutes${NC}"
echo -e "${GREEN}✅ Both services will auto-connect via environment variables!${NC}"
echo ""

read -p "Ready to open Render? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🌐 Opening Render...${NC}"
    if command -v open &> /dev/null; then
        open "https://render.com"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "https://render.com"
    else
        echo "Go to: https://render.com"
    fi
else
    echo -e "${YELLOW}👍 Visit render.com when you're ready!${NC}"
fi

echo ""
echo -e "${BLUE}📚 Next steps after deployment:${NC}"
echo "1. Test your backend API endpoint"
echo "2. Test your frontend site"
echo "3. Verify GitHub OAuth is working"
echo "4. Check logs if there are any issues"
