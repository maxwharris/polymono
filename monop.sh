#!/bin/bash

# Polymono Production Deployment Script
# For EC2 server with PM2 and Nginx

set -e

# Change to project directory
cd /var/www/monop

echo "========================================="
echo "  Polymono Production Deployment"
echo "========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Pull latest changes if git repo
if [ -d ".git" ]; then
    echo ""
    echo "Pulling latest changes..."
    git pull origin main
    print_status "Git pull complete"
fi

# Backend deployment
echo ""
echo "========================================="
echo "  Deploying Backend"
echo "========================================="

cd /var/www/monop/backend

echo "Installing backend dependencies..."
npm install --production
print_status "Backend dependencies installed"

# Stop existing PM2 process if running
if pm2 list | grep -q "monop-backend"; then
    echo "Stopping existing backend process..."
    pm2 stop monop-backend
    pm2 delete monop-backend
    print_status "Existing process stopped"
fi

# Start backend with PM2
echo "Starting backend with PM2..."
pm2 start index.js --name monop-backend --env production
print_status "Backend started"

# Save PM2 process list
pm2 save
print_status "PM2 process list saved"

# Frontend deployment
echo ""
echo "========================================="
echo "  Deploying Frontend"
echo "========================================="

cd /var/www/monop/frontend

echo "Installing frontend dependencies..."
npm install
print_status "Frontend dependencies installed"

echo "Building frontend for production..."
npm run build
print_status "Frontend build complete"

# Set proper permissions for Nginx
echo "Setting permissions..."
sudo chown -R www-data:www-data /var/www/monop/frontend/dist
sudo chmod -R 755 /var/www/monop/frontend/dist
print_status "Permissions set"

# Reload Nginx
echo ""
echo "========================================="
echo "  Reloading Nginx"
echo "========================================="

sudo nginx -t
if [ $? -eq 0 ]; then
    sudo systemctl reload nginx
    print_status "Nginx reloaded"
else
    print_warning "Nginx config test failed - not reloading"
    exit 1
fi

# Show status
echo ""
echo "========================================="
echo "  Deployment Complete"
echo "========================================="
echo ""
echo "Backend status:"
pm2 status monop-backend
echo ""
echo "To view backend logs:"
echo "  pm2 logs monop-backend"
echo ""
echo "To restart backend:"
echo "  pm2 restart monop-backend"
echo ""
print_status "Deployment successful!"
