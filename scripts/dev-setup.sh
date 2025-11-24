#!/bin/bash
# Development Environment Setup Script
# Sets up local development with Dex, MongoDB, and seeded data

set -e

echo "Papers2Code Development Environment Setup"
echo "=============================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env from template..."
    cp .env.example .env
    echo "Created .env - review and customize as needed"
fi

# Build and start containers
echo ""
echo "Building Docker containers..."
docker-compose -f docker-compose.dev.yml build

echo ""
echo "Starting services..."
docker-compose -f docker-compose.dev.yml up -d mongodb dex

echo ""
echo "Waiting for services to be ready..."
sleep 5

# Check if MongoDB is ready
echo "Checking MongoDB..."
until docker exec papers2code_dev_mongo mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
    echo "  Waiting for MongoDB..."
    sleep 2
done
echo "MongoDB is ready"

# Check if Dex is ready
echo "Checking Dex..."
until curl -f http://localhost:5556/dex/.well-known/openid-configuration > /dev/null 2>&1; do
    echo "  Waiting for Dex..."
    sleep 2
done
echo "Dex is ready"

echo ""
echo "Starting backend (will seed database)..."
docker-compose -f docker-compose.dev.yml up -d backend

echo ""
echo "Starting frontend..."
docker-compose -f docker-compose.dev.yml up -d frontend

echo ""
echo "Development environment is ready!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Service URLs:"
echo "   Frontend:  http://localhost:5173"
echo "   Backend:   http://localhost:5001"
echo "   Dex:       http://localhost:5556/dex"
echo "   MongoDB:   mongodb://localhost:27017"
echo ""
echo "Test Users (password: 'password' for all):"
echo "   GitHub Mock:"
echo "     - dev_github_user1@test.local"
echo "     - dev_github_user2@test.local"
echo "     - admin_dev@test.local (admin)"
echo ""
echo "   Google Mock:"
echo "     - dev_google_user1@gmail.test"
echo "     - dev_google_user2@gmail.test"
echo ""
echo "Useful Commands:"
echo "   View logs:     docker-compose -f docker-compose.dev.yml logs -f"
echo "   Stop:          docker-compose -f docker-compose.dev.yml down"
echo "   Reset data:    docker-compose -f docker-compose.dev.yml down -v"
echo "   Restart:       docker-compose -f docker-compose.dev.yml restart"
echo ""
echo "To test OAuth:"
echo "   1. Open http://localhost:5173"
echo "   2. Click 'Login with GitHub' or 'Login with Google'"
echo "   3. Dex will show login page - use any test user above"
echo "   4. You'll be logged in to Papers2Code!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
