# Deployment Guide - Intelligent Invoicing System

This guide provides comprehensive instructions for deploying the Intelligent Invoicing System to production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Docker Deployment](#docker-deployment)
4. [Production Configuration](#production-configuration)
5. [SSL/TLS Setup](#ssltls-setup)
6. [Monitoring & Logging](#monitoring--logging)
7. [Backup Strategy](#backup-strategy)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Operating System**: Ubuntu 20.04 LTS or newer (recommended)
- **Memory**: Minimum 4GB RAM (8GB+ recommended for production)
- **Storage**: Minimum 50GB SSD (100GB+ recommended)
- **CPU**: 2+ cores
- **Network**: Static IP address with domain name

### Required Software

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install additional tools
sudo apt install -y nginx certbot python3-certbot-nginx git curl wget
```

### Domain & DNS Setup

1. Point your domain to your server's IP address
2. Set up the following DNS records:
   ```
   A     yourdomain.com        -> YOUR_SERVER_IP
   A     www.yourdomain.com    -> YOUR_SERVER_IP
   A     api.yourdomain.com    -> YOUR_SERVER_IP
   A     n8n.yourdomain.com    -> YOUR_SERVER_IP
   ```

## Environment Setup

### 1. Create Application Directory

```bash
sudo mkdir -p /opt/intelligent-invoicing
sudo chown $USER:$USER /opt/intelligent-invoicing
cd /opt/intelligent-invoicing
```

### 2. Clone Repository

```bash
git clone https://github.com/yourusername/intelligent-invoicing.git .
```

### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

**Critical environment variables to configure:**

```bash
# Production settings
NODE_ENV=production
DOMAIN=yourdomain.com
SSL_ENABLED=true

# Database
DB_PASSWORD=your-secure-database-password

# JWT secrets (generate strong random keys)
JWT_SECRET=your-super-secure-jwt-secret-32-characters-min
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-32-characters-min

# OpenAI API
OPENAI_API_KEY=sk-your-openai-api-key

# Google Services
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_DRIVE_FOLDER_ID=your-drive-folder-id

# Email configuration
EMAIL_HOST=smtp.yourdomain.com
EMAIL_USER=noreply@yourdomain.com
EMAIL_PASSWORD=your-email-password

# n8n configuration
N8N_BASIC_AUTH_PASSWORD=secure-n8n-password
N8N_ENCRYPTION_KEY=your-n8n-encryption-key
```

## Docker Deployment

### 1. Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: intelligent_invoicing
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docs/DATABASE_SCHEMA.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
    networks:
      - intelligent-invoicing
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    networks:
      - intelligent-invoicing
    command: redis-server --appendonly yes --maxmemory 256mb
    deploy:
      resources:
        limits:
          memory: 512M

  backend:
    image: ghcr.io/yourusername/intelligent-invoicing-backend:latest
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - REDIS_URL=redis://redis:6379
    env_file:
      - .env
    volumes:
      - file_uploads:/app/uploads
      - backend_logs:/app/logs
    depends_on:
      - postgres
      - redis
    networks:
      - intelligent-invoicing
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M

  frontend:
    image: ghcr.io/yourusername/intelligent-invoicing-frontend:latest
    restart: unless-stopped
    depends_on:
      - backend
    networks:
      - intelligent-invoicing
    deploy:
      resources:
        limits:
          memory: 512M

  n8n:
    image: n8nio/n8n:latest
    restart: unless-stopped
    environment:
      - N8N_HOST=${DOMAIN}
      - N8N_PROTOCOL=https
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - WEBHOOK_URL=https://n8n.${DOMAIN}
    env_file:
      - .env
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      - postgres
    networks:
      - intelligent-invoicing
    deploy:
      resources:
        limits:
          memory: 1G

volumes:
  postgres_data:
  redis_data:
  n8n_data:
  file_uploads:
  backend_logs:

networks:
  intelligent-invoicing:
    driver: bridge
```

### 2. Start Services

```bash
# Build and start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

## Production Configuration

### 1. Nginx Reverse Proxy

Create `/etc/nginx/sites-available/intelligent-invoicing`:

```nginx
# Main application
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# API subdomain
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' 'https://yourdomain.com' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
    }
}

# n8n subdomain
server {
    listen 80;
    server_name n8n.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name n8n.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://localhost:5678;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/intelligent-invoicing /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## SSL/TLS Setup

### 1. Obtain SSL Certificates

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificates
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com -d n8n.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### 2. Auto-renewal Setup

```bash
# Add cron job for auto-renewal
sudo crontab -e

# Add this line:
0 12 * * * /usr/bin/certbot renew --quiet
```

## Monitoring & Logging

### 1. Application Logs

```bash
# View application logs
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f n8n

# Configure log rotation
sudo nano /etc/logrotate.d/intelligent-invoicing
```

Add to logrotate configuration:

```
/opt/intelligent-invoicing/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    copytruncate
    notifempty
}
```

### 2. System Monitoring

Install monitoring tools:

```bash
# Install Prometheus and Grafana (optional)
docker run -d --name=prometheus -p 9090:9090 prom/prometheus
docker run -d --name=grafana -p 3030:3000 grafana/grafana

# Install htop for system monitoring
sudo apt install htop
```

### 3. Health Checks

Create health check script `/opt/intelligent-invoicing/health-check.sh`:

```bash
#!/bin/bash

# Check application health
curl -f https://yourdomain.com/health || exit 1
curl -f https://api.yourdomain.com/health || exit 1
curl -f https://n8n.yourdomain.com/healthz || exit 1

echo "All services healthy"
```

Add to crontab:

```bash
*/5 * * * * /opt/intelligent-invoicing/health-check.sh
```

## Backup Strategy

### 1. Database Backups

Create backup script `/opt/intelligent-invoicing/backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/opt/backups/intelligent-invoicing"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Database backup
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U postgres intelligent_invoicing > $BACKUP_DIR/db_$DATE.sql

# File uploads backup
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz -C /var/lib/docker/volumes/intelligent-invoicing_file_uploads/_data .

# n8n data backup
tar -czf $BACKUP_DIR/n8n_$DATE.tar.gz -C /var/lib/docker/volumes/intelligent-invoicing_n8n_data/_data .

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

Schedule daily backups:

```bash
sudo crontab -e

# Add this line for daily backups at 2 AM
0 2 * * * /opt/intelligent-invoicing/backup.sh
```

### 2. Configuration Backups

```bash
# Backup configuration files
cp .env /opt/backups/intelligent-invoicing/env_backup_$(date +%Y%m%d)
cp docker-compose.prod.yml /opt/backups/intelligent-invoicing/compose_backup_$(date +%Y%m%d).yml
```

## Troubleshooting

### Common Issues

1. **Services not starting**
   ```bash
   # Check logs
   docker-compose -f docker-compose.prod.yml logs
   
   # Check system resources
   htop
   df -h
   ```

2. **Database connection issues**
   ```bash
   # Check database status
   docker-compose -f docker-compose.prod.yml exec postgres pg_isready
   
   # Connect to database
   docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d intelligent_invoicing
   ```

3. **SSL certificate issues**
   ```bash
   # Check certificate status
   sudo certbot certificates
   
   # Renew certificates
   sudo certbot renew
   ```

4. **High memory usage**
   ```bash
   # Check Docker stats
   docker stats
   
   # Restart services
   docker-compose -f docker-compose.prod.yml restart
   ```

### Performance Optimization

1. **Database optimization**
   - Enable query caching
   - Optimize indexes
   - Monitor slow queries

2. **Application optimization**
   - Enable Redis caching
   - Optimize API responses
   - Implement CDN for static assets

3. **Server optimization**
   - Configure swap space
   - Optimize Nginx settings
   - Enable compression

### Security Checklist

- [ ] Strong passwords for all services
- [ ] SSL/TLS certificates installed
- [ ] Firewall configured (only ports 80, 443, 22 open)
- [ ] Regular security updates
- [ ] Database access restricted
- [ ] Application logs monitored
- [ ] Backup strategy implemented
- [ ] API rate limiting configured

## Support

For additional support:
- Check the [troubleshooting guide](TROUBLESHOOTING.md)
- Review [application logs](LOGGING.md)
- Contact the development team

---

**Note**: Always test deployments in a staging environment before deploying to production.