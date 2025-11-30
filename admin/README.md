# Conditions Bot - Admin Dashboard

A simple admin web interface to view metrics and monitor the Conditions Telegram bot.

## Features

- **Subscriber Metrics**: Total subscribers and recent sign-ups
- **Delivery Statistics**: Total and recent bulletin deliveries
- **Cron Execution Monitoring**: Track scheduled job executions and their success rates
- **Popular Massifs**: See which massifs have the most subscribers
- **Storage Bucket Files**: View files in the Google Cloud Storage bucket

## Running with Docker

### 1. Create environment file

```bash
cd admin
cp .env.example .env
```

Edit `.env` and fill in your database and Google Cloud credentials:

```env
PGHOST=your-database-host
PGDATABASE=conditions
PGUSER=postgres
PGPASSWORD=your_password
PGPORT=5432

GOOGLE_PROJECT_ID=your-project-id
STORAGE_BUCKET_NAME=conditions-450312-functions

PORT=3000
```

### 2. Build the Docker image

```bash
docker build -t conditions-admin .
```

### 3. Run the container

```bash
docker run -p 3000:3000 --env-file .env conditions-admin
```

The admin dashboard will be available at http://localhost:3000

## Running without Docker

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Start the server

```bash
npm start
```

The dashboard will be available at http://localhost:3000

## API Endpoints

The admin server exposes the following REST API endpoints:

- `GET /api/health` - Health check
- `GET /api/subscribers` - Subscriber metrics
- `GET /api/deliveries` - Delivery statistics
- `GET /api/massifs/popular` - Most subscribed massifs
- `GET /api/cron/executions` - Recent cron job executions
- `GET /api/cron/stats` - Cron execution statistics
- `GET /api/storage/files` - Files in the storage bucket

## Notes

- The dashboard auto-refreshes stats every 30 seconds
- For production use, consider adding authentication
- Storage bucket access requires appropriate Google Cloud credentials
