#!/usr/bin/env bash
set -euo pipefail

# Simple deployment script for production server
# Usage:
#   ./scripts/deploy.sh <remote_host>
# Requires SSH access and docker/docker-compose installed on remote host.

REMOTE=$1
PROJECT_NAME=intelligent-invoicing

ssh $REMOTE "mkdir -p ~/$PROJECT_NAME"

tar cz --exclude .git -f /tmp/$PROJECT_NAME.tar.gz .
scp /tmp/$PROJECT_NAME.tar.gz $REMOTE:~/$PROJECT_NAME/
ssh $REMOTE "cd ~/$PROJECT_NAME && tar xzf $PROJECT_NAME.tar.gz && docker compose pull && docker compose up -d --build"

echo "Deployment to $REMOTE completed."