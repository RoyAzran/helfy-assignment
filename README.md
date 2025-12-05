# Helfy Assignment - Full-Stack Authentication with TiDB CDC

A full-stack application demonstrating authentication, database integration, Change Data Capture (CDC), and real-time event processing with Apache Kafka.

## 🏗️ Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────────────┐
│   Client    │────▶│     API     │────▶│      TiDB Cluster           │
│  (Nginx)    │     │  (Node.js)  │     │  (PD + TiKV + TiDB)         │
│   :80       │     │   :3000     │     │       :4000                 │
└─────────────┘     └──────┬──────┘     └──────────────┬──────────────┘
                           │                           │
                           │                    ┌──────▼──────────┐
                           │                    │     TiCDC       │
                           │                    │  (CDC Engine)   │
                           │                    └──────┬──────────┘
                           │                           │
                    ┌──────┴───────────────────────────┘
                    │
                    ▼
           ┌────────────────┐
           │  Apache Kafka  │
           │   (Broker)     │
           └────────┬───────┘
                    │
         ┌──────────┴──────────┐
         │                     │
         ▼                     ▼
    ┌─────────────┐      ┌──────────────┐
    │   Consumer  │      │   Analytics  │
    │  (Node.js)  │      │   Systems    │
    └─────────────┘      └──────────────┘
```

## 📊 Services

| Service | Image | Purpose | Ports |
|---------|-------|---------|-------|
| **client** | nginx:alpine | Serves frontend HTML/JS | 80 |
| **api** | node:18-alpine | Backend REST API with authentication | 3000 |
| **pd** | pingcap/pd | TiDB Placement Driver - cluster metadata & scheduling | 2379 |
| **tikv** | pingcap/tikv | TiDB Key-Value storage engine - distributed data storage | - |
| **tidb** | pingcap/tidb | TiDB SQL layer - executes queries | 4000 |
| **ticdc** | pingcap/ticdc | Change Data Capture - captures ALL database changes in real-time | 8300 |
| **zookeeper** | wurstmeister/zookeeper | Kafka coordination & leader election | 2181 |
| **kafka** | wurstmeister/kafka | Distributed message broker - event streaming | 9092 |
| **consumer** | node:18-alpine | Kafka consumer - processes streamed events | - |

## 🚀 Quick Start

```bash
# Start everything with one command
docker-compose up --build

# Access the application
http://localhost
```

## 📁 Project Structure

```
helfy-assignment/
├── client/                          # Frontend
│   ├── public/
│   │   ├── index.html              # Login page
│   │   ├── dashboard.html          # Protected page
│   │   ├── app.js                  # Frontend logic
│   │   └── styles.css              # Styling
│   ├── nginx.conf                  # Nginx configuration
│   └── Dockerfile
├── api/                             # Backend API
│   ├── server.js                   # Express server + log4js logging
│   ├── db.js                       # TiDB connection pool
│   ├── logger.js                   # log4js setup
│   ├── package.json
│   ├── .env                        # Environment variables
│   └── Dockerfile
├── consumer/                        # Kafka Consumer (Event Processor)
│   ├── index.js                    # Kafka consumer + log4js logging
│   ├── logger.js                   # log4js setup
│   ├── package.json
│   └── Dockerfile
├── db/
│   └── schema.sql                  # Database schema & default user
├── docker-compose.yml              # Complete infrastructure
└── README.md                        # This file
```

## 📝 Logging Format

All logs use **log4js** in JSON format for easy parsing and monitoring.

### API Login Event Log
```json
{
  "timestamp": "2024-12-05T10:30:00.123Z",
  "userId": 1,
  "action": "LOGIN_SUCCESS",
  "ipAddress": "::ffff:172.18.0.1"
}
```

### Consumer CDC Event Log
```json
{
  "timestamp": "2024-12-05T10:30:00.890Z",
  "source": "TiDB-CDC",
  "topic": "tidb-cdc-events",
  "operation": "UPDATE",
  "database": "test",
  "table": "users",
  "data": {
    "id": 1,
    "username": "admin",
    "token": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

## 🛠️ Technology Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript, Nginx |
| **Backend** | Node.js 18, Express.js 4 |
| **Database** | TiDB (MySQL-compatible), TiKV, PD |
| **CDC/Streaming** | TiCDC, Apache Kafka, Zookeeper |
| **Logging** | log4js (structured JSON logging) |
| **Container** | Docker, Docker Compose |