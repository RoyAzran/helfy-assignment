# TiDB Login App

A simple website with a Node.js backend and TiDB database, featuring a login screen and token-based authentication.

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

## Services

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

## Project Structure

```
├── docker-compose.yml      # Orchestration file for all services
├── README.md               # This file
├── PROJECT_STRUCTURE.md    # Detailed architecture documentation
├── api/                    # Backend Node.js REST API
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
├── client/                 # Frontend web application
│   ├── Dockerfile
│   ├── nginx.conf
│   └── public/
│       ├── app.js
│       ├── dashboard.html
│       └── index.html
├── consumer/               # Kafka consumer service
│   ├── Dockerfile
│   ├── index.js
│   └── package.json
└── db/                     # Database initialization
    └── schema.sql
```

## API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/` | GET | No | Health check - returns API status |
| `/health` | GET | No | Health check endpoint |
| `/api/login` | POST | No | Authenticates user, returns token |
| `/api/data` | GET | Yes | Protected route - requires valid token |

## Data Flow

### User Login Flow
```
User → Client (form) → API (/api/login) → TiDB (verify credentials)
                                       → Generate UUID token
                                       → Store token in DB
                                       → Kafka (publish login event)
                                       → Return token to client
```

### CDC Event Flow
```
Any DB Change → TiDB → TiCDC (captures change) → Kafka (tidb-cdc-events topic)
                                                        ↓
                                               Consumer (logs to console)
```

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
