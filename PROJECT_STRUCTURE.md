# Project Structure Explanation

This document provides a detailed overview of the project's file and directory structure, explaining the purpose of each component in the Dockerized application.

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────────────┐
│   Client    │────▶│     API     │────▶│      TiDB Cluster           │
│  (Nginx)    │     │  (Node.js)  │     │  (PD + TiKV + TiDB)         │
│   :80       │     │   :3000     │     │       :4000                 │
└─────────────┘     └──────┬──────┘     └──────────────┬──────────────┘
                           │                           │
                           │                           │ CDC Events
                           ▼                           ▼
                    ┌─────────────┐             ┌─────────────┐
                    │    Kafka    │◀────────────│   TiCDC     │
                    │    :9092    │             │   :8300     │
                    └──────┬──────┘             └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Consumer   │
                    │  (Node.js)  │
                    └─────────────┘
```

---

## Root Directory

### `docker-compose.yml`
The central orchestration file that defines all services and their interactions:

| Service | Image | Purpose | Ports |
|---------|-------|---------|-------|
| **client** | nginx:alpine | Serves frontend HTML/JS | 80 |
| **api** | node:18-alpine | Backend REST API | 3000 |
| **pd** | pingcap/pd | TiDB Placement Driver - cluster metadata & scheduling | 2379 |
| **tikv** | pingcap/tikv | TiDB Key-Value storage engine | - |
| **tidb** | pingcap/tidb | TiDB SQL layer | 4000 |
| **ticdc** | pingcap/ticdc | Change Data Capture - streams DB changes | 8300 |
| **zookeeper** | wurstmeister/zookeeper | Kafka coordination service | 2181 |
| **kafka** | wurstmeister/kafka | Message broker | 9092 |
| **consumer** | node:18-alpine | Processes Kafka messages | - |
| **db-init** | mysql:5.7 | One-time DB schema initialization | - |
| **cdc-init** | pingcap/ticdc | One-time CDC changefeed setup | - |

### `README.md`
Contains project overview, prerequisites, and instructions for building and running the application.

### `PROJECT_STRUCTURE.md`
This file - explains the project architecture and components.

---

## `api/` Directory
The backend Node.js REST API service.

### `api/Dockerfile`
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```
- **Base Image**: Node.js 18 on Alpine Linux (lightweight)
- **Build Steps**: Copy package.json → Install dependencies → Copy source code
- **Runtime**: Starts the Express server on port 3000

### `api/package.json`
Defines project metadata and dependencies:

| Dependency | Purpose |
|------------|---------|
| `express` | Web framework for REST API routes |
| `mysql2` | MySQL-compatible driver for TiDB connection |
| `kafkajs` | Apache Kafka client for publishing events |
| `cors` | Middleware to allow cross-origin requests |
| `body-parser` | Parses incoming JSON request bodies |
| `uuid` | Generates unique authentication tokens |
| `dotenv` | Loads environment variables from .env files |
| `log4js` | **Structured JSON logging** (required by assignment) |

### `api/server.js`
The main application entry point with the following components:

**1. Logger Configuration (log4js)**
```javascript
log4js.configure({
    appenders: { console: { type: 'console' } },
    categories: { default: { appenders: ['console'], level: 'info' } }
});
```
- Outputs structured JSON logs to console
- Logs user activity (login success/failure) with timestamp, userId, action, IP

**2. Database Connection**
```javascript
const pool = mysql.createPool({
    host: process.env.TIDB_HOST || 'tidb',
    port: process.env.TIDB_PORT || 4000,
    ...
});
```
- Creates a connection pool to TiDB
- Uses environment variables for configuration

**3. Kafka Producer**
```javascript
const kafka = new Kafka({
    clientId: 'auth-service',
    brokers: ['kafka:9092']
});
const producer = kafka.producer();
```
- Connects to Kafka as a producer
- Publishes login events to `user-logins` topic

**4. API Routes**

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/` | GET | No | Health check - returns API status |
| `/health` | GET | No | Health check endpoint |
| `/api/login` | POST | No | Authenticates user, returns token |
| `/api/data` | GET | Yes | Protected route - requires valid token |

**5. Authentication Middleware**
```javascript
const authenticate = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    // Validates token against database
};
```
- Extracts Bearer token from Authorization header
- Verifies token exists in database
- Attaches user object to request if valid

---

## `client/` Directory
The frontend web application served by Nginx.

### `client/Dockerfile`
```dockerfile
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY public /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```
- **Base Image**: Nginx on Alpine Linux
- **Configuration**: Custom nginx.conf for API proxying
- **Static Files**: HTML/JS copied to Nginx web root

### `client/nginx.conf`
```nginx
server {
    listen 80;
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://api:3000/api/;
    }
}
```
- Serves static files from `/usr/share/nginx/html`
- **Reverse Proxy**: Routes `/api/*` requests to the backend API service
- Enables frontend to call API without CORS issues

### `client/public/index.html`
The login page containing:
- Username input field
- Password input field
- Login button
- Form validation
- Error message display

### `client/public/dashboard.html`
Protected dashboard page:
- Displays after successful login
- Shows user information
- Fetches protected data from API
- Logout functionality

### `client/public/app.js`
Client-side JavaScript handling:
- Form submission via `fetch()` API
- Stores JWT token in `localStorage`
- Redirects to dashboard on success
- Displays error messages on failure
- Sends token in Authorization header for protected requests

---

## `consumer/` Directory
Kafka consumer service that processes messages in real-time.

### `consumer/Dockerfile`
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "index.js"]
```
- Similar structure to API Dockerfile
- Runs the consumer application

### `consumer/package.json`
| Dependency | Purpose |
|------------|---------|
| `kafkajs` | Kafka client for consuming messages |
| `log4js` | Structured JSON logging |

### `consumer/index.js`
Kafka consumer application:

**1. Topic Subscriptions**
```javascript
await consumer.subscribe({ topic: 'tidb-cdc-events', fromBeginning: true });
await consumer.subscribe({ topic: 'user-logins', fromBeginning: true });
```
- **tidb-cdc-events**: Database change events from TiCDC
- **user-logins**: Login events from the API

**2. Message Processing**
```javascript
await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
        // Parse and log messages
    }
});
```
- Processes each message as it arrives
- Logs CDC events with database, table, operation type
- Logs user activity events with userId, username, timestamp

**3. Output Format**
```json
// CDC Event
{"timestamp":"...","source":"TiDB-CDC","topic":"tidb-cdc-events","operation":"DML","database":"test","table":"users","data":{...}}

// User Login Event  
{"timestamp":"...","source":"UserActivity","topic":"user-logins","event":"LOGIN","userId":1,"username":"admin"}
```

---

## `db/` Directory
Database initialization files.

### `db/schema.sql`
```sql
USE test;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    auth_token VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (username, email, password) 
VALUES ('admin', 'admin@example.com', 'admin')
ON DUPLICATE KEY UPDATE password='admin';
```

**Purpose:**
- Selects the `test` database
- Creates `users` table with required columns
- Inserts default admin user for testing
- `ON DUPLICATE KEY` prevents errors on restart

**Table Schema:**
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Auto-incrementing primary key |
| username | VARCHAR(255) | Unique username |
| email | VARCHAR(255) | Unique email address |
| password | VARCHAR(255) | Password (plaintext for demo) |
| auth_token | VARCHAR(255) | Current session token |
| created_at | TIMESTAMP | Account creation time |

---

## `.github/` Directory

### `.github/copilot-instructions.md`
Configuration file for GitHub Copilot with project-specific instructions and checklist for development workflow.

---

## Data Flow

### 1. User Login Flow
```
User → Client (form) → API (/api/login) → TiDB (verify credentials)
                                       → Generate UUID token
                                       → Store token in DB
                                       → Kafka (publish login event)
                                       → Return token to client
```

### 2. CDC Event Flow
```
Any DB Change → TiDB → TiCDC (captures change) → Kafka (tidb-cdc-events topic)
                                                        ↓
                                               Consumer (logs to console)
```

### 3. Protected Request Flow
```
Client (with token) → API (/api/data) → Middleware (validate token)
                                      → TiDB (verify token exists)
                                      → Return protected data
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | API server port |
| TIDB_HOST | tidb | TiDB hostname |
| TIDB_PORT | 4000 | TiDB port |
| TIDB_USER | root | Database user |
| TIDB_PASSWORD | (empty) | Database password |
| TIDB_DATABASE | test | Database name |
| KAFKA_BROKERS | kafka:9092 | Kafka broker addresses |

---

## Running the Project

### Start All Services
```bash
docker-compose up --build
```

### Access Points
- **Frontend**: http://localhost
- **API**: http://localhost:3000
- **TiDB**: localhost:4000

### Default Credentials
- Username: `admin`
- Password: `admin`

### View Logs
```bash
# API logs (login activity)
docker logs helfy-assignment-api-1

# Consumer logs (CDC + login events)
docker logs helfy-assignment-consumer-1

# TiCDC logs
docker logs helfy-assignment-ticdc-1
```

### Stop All Services
```bash
docker-compose down
```

### Clean Everything (including volumes)
```bash
docker-compose down -v --remove-orphans
```
