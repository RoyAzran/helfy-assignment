# Helfy Assignment - Full-Stack Authentication with TiDB CDC

A complete full-stack application demonstrating authentication, database integration, Change Data Capture (CDC), and real-time event processing with Apache Kafka.

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
| **db-init** | mysql:5.7 | One-time DB schema initialization | - |
| **cdc-init** | pingcap/ticdc | One-time CDC changefeed setup | - |

## 🔄 Data Flow & Event Pipeline

### Step-by-Step Process

```
1. USER LOGS IN
   └─► Client sends credentials to API

2. API VALIDATES & UPDATES DATABASE
   └─► INSERT/UPDATE in TiDB
   └─► Token stored in database

3. TICDC CAPTURES CHANGE (Real-Time)
   └─► Detects: "UPDATE users SET token = '...' WHERE id = 1"
   └─► Converts to structured CDC event

4. KAFKA RECEIVES EVENTS
   └─► Topic 1: "user-events" (from API)
   └─► Topic 2: "tidb-cdc-events" (from TiCDC)

5. CONSUMER PROCESSES & LOGS
   └─► Subscribes to both topics
   └─► Logs events in structured JSON format (log4js)
   └─► Enables monitoring, auditing, analytics
```

## ❓ Why This Complex Pipeline Instead of Just Reading from Database?

### The Traditional Approach (❌ Limited)
```
┌──────────┐
│  Client  │
└────┬─────┘
     │
     ▼
┌──────────┐      ┌──────────┐
│   API    │─────▶│  TiDB    │
└──────────┘      └──────────┘

Problems:
- ❌ No audit trail of who changed what and when
- ❌ Can't track intermediate states
- ❌ No real-time event notifications
- ❌ API must constantly poll database
- ❌ Can't replay changes
- ❌ Difficult to integrate multiple systems
- ❌ Poor scalability for large data volumes
```

### The Event-Driven Approach (✅ Enterprise)
```
┌──────────┐
│  Client  │
└────┬─────┘
     │
     ▼
┌──────────┐      ┌──────────┐
│   API    │─────▶│  TiDB    │
└──────────┘      └────┬─────┘
                       │
                       ▼
                  ┌──────────┐
                  │  TiCDC   │
                  └────┬─────┘
                       │
                       ▼
                  ┌──────────┐
              ┌──▶│  Kafka   │◀──┐
              │   └──────────┘   │
              │                  │
         ┌────▼────┐      ┌──────▼────┐
         │Consumer │      │ Analytics │
         │ Logging │      │  Engine   │
         └─────────┘      └───────────┘

Benefits:
✅ Complete audit trail of ALL changes
✅ Timestamps for every operation
✅ Can replay events from any point
✅ Decoupled systems (Consumer doesn't block DB)
✅ Real-time event streaming
✅ Multiple consumers can process independently
✅ Scales horizontally with Kafka partitions
✅ Perfect for microservices architecture
```

## 💎 Real-World Values This Pipeline Provides

### 1️⃣ **Audit & Compliance**
```json
{
  "timestamp": "2024-12-05T10:30:00Z",
  "operation": "UPDATE",
  "table": "users",
  "user_id": 1,
  "old_values": {"token": null},
  "new_values": {"token": "abc-123"},
  "source": "user_login"
}
```
✅ **Proof of what changed, when, and why**
✅ **GDPR/PCI-DSS compliance**

### 2️⃣ **Real-Time Notifications**
```
User logs in → Token updated → CDC event → Kafka → 
Consumer sends email/SMS/notification in REAL-TIME
(No polling needed!)
```

### 3️⃣ **Multi-System Integration**
```
User updates profile in SYSTEM A
  ↓ (CDC event)
  ↓ (Kafka)
SYSTEM B auto-syncs customer data
SYSTEM C updates analytics
SYSTEM D triggers recommendation engine
(All happen in real-time without APIs talking to each other)
```

### 4️⃣ **Event Replay & Recovery**
```
If a system crashes, it can:
1. Reconnect to Kafka
2. Replay events from last checkpoint
3. Recover to exact state without re-querying database
(No data loss, faster recovery)
```

### 5️⃣ **Scalability**
```
Traditional API approach:
- 1000 users login → 1000 direct database hits
- Database becomes bottleneck

Event-driven approach:
- 1000 users login → Kafka handles all events
- Multiple consumers process independently
- Database load remains constant
- Each system processes at its own speed
```

### 6️⃣ **Analytics & Business Intelligence**
```
Every database change is automatically captured
↓
Kafka streams to data warehouse
↓
Real-time dashboards showing:
- User login patterns
- Peak usage times
- Error rates
- System health metrics
(Without ANY queries hitting production database)
```

### 7️⃣ **Decoupling & Microservices**
```
Without CDC:
API → Auth Service → User Service → Analytics Service
(Tightly coupled, synchronous, slow)

With CDC:
API → TiDB
        ↓ (CDC)
        ↓ (Kafka)
   Multiple independent consumers:
   - Auth Service
   - User Service
   - Analytics Service
   - Notification Service
   - Backup Service
(Loosely coupled, asynchronous, fast)
```

## 📈 Concrete Example: Login Event

### What Happens (Step by Step)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER CLICKS LOGIN (10:30:00.123)                             │
│    Input: admin / admin                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. API VALIDATES & UPDATES (10:30:00.456)                       │
│    - SELECT * FROM users WHERE username='admin'                 │
│    - Credentials valid ✓                                         │
│    - Generate token: "abc-123-def-456"                          │
│    - UPDATE users SET token='abc-123-def-456' WHERE id=1        │
│    - Log to API logs: {action: LOGIN_SUCCESS, userId: 1}        │
│    - Send event to Kafka "user-events" topic                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. TIDB STORES UPDATE (10:30:00.789)                            │
│    - Token value committed to disk                               │
│    - Row version incremented                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. TICDC DETECTS CHANGE (10:30:00.890)                          │
│    - Row: users, ID: 1                                           │
│    - Operation: UPDATE                                           │
│    - Old: {id: 1, username: 'admin', token: null}              │
│    - New: {id: 1, username: 'admin', token: 'abc-123-def-456'} │
│    - Sends to Kafka "tidb-cdc-events" topic                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. CONSUMER PROCESSES EVENTS (10:30:00.945)                     │
│    Receives 2 events:                                            │
│                                                                  │
│    A) User Event (from user-events topic):                      │
│       {timestamp, action: LOGIN_SUCCESS, userId: 1, ip: ...}    │
│                                                                  │
│    B) CDC Event (from tidb-cdc-events topic):                   │
│       {timestamp, operation: UPDATE, table: users,               │
│        oldData: {token: null}, newData: {token: abc-123...}}   │
│                                                                  │
│    Logs both in structured JSON format                          │
│    Can trigger: email, notifications, analytics, backup, etc.  │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 Key Differences

| Aspect | Simple DB Query | Event-Driven CDC |
|--------|-----------------|-----------------|
| **Real-time** | ❌ Polling required | ✅ Instant notification |
| **Audit Trail** | ❌ Manual logging | ✅ Automatic for ALL changes |
| **Scalability** | ❌ DB load increases | ✅ Horizontal scaling |
| **Multiple Consumers** | ❌ DB bottleneck | ✅ Independent processing |
| **Event Replay** | ❌ Not possible | ✅ Full history available |
| **Decoupling** | ❌ Tight coupling | ✅ Loose coupling |
| **Analytics** | ❌ Slow, impacts DB | ✅ Real-time, no impact |
| **Compliance** | ❌ Manual audit logs | ✅ Complete audit trail |

## 🚀 Quick Start

```bash
# Start everything with one command
docker-compose up --build

# Watch the pipeline in action
# Terminal 1: API logs
docker logs helfy-assignment-api-1 -f

# Terminal 2: Consumer logs
docker logs helfy-assignment-consumer-1 -f

# Terminal 3: Test login
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

**See logs appear in BOTH terminals in real-time!**

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
│   ├── wait-for-services.js        # Service health checks
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

## 🔌 API Endpoints

### POST /api/login
Authenticate user and receive authentication token.

**Request:**
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin"
  }'
```

**Response:**
```json
{
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "userId": 1,
  "username": "admin"
}
```

### GET /health
Check system health status.

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "kafka": true
}
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

### Consumer User Event Log
```json
{
  "timestamp": "2024-12-05T10:30:00.456Z",
  "source": "kafka-user-events",
  "event": "LOGIN_SUCCESS",
  "userId": 1,
  "username": "admin",
  "ip": "::ffff:172.18.0.1"
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

## 🗄️ Database Schema

```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    token VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Default user for testing
INSERT INTO users (username, password) VALUES ('admin', 'admin');
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
| **Authentication** | UUID tokens, HTTP headers |

## 🔐 Security Features

- ✅ Username/password authentication
- ✅ UUID token generation
- ✅ Token-based session management
- ✅ Token stored in database
- ✅ Complete audit trail of all changes
- ✅ IP address logging for security monitoring

## 📊 Environment Variables

```env
# API Configuration
PORT=3000

# TiDB Configuration
TIDB_HOST=tidb
TIDB_PORT=4000
TIDB_USER=root
TIDB_PASSWORD=
TIDB_DATABASE=test
TIDB_SSL=false

# Kafka Configuration
KAFKA_BROKERS=kafka:9092
```

## 🚦 Monitoring & Debugging

### View API Logs
```bash
docker logs helfy-assignment-api-1 -f
```

### View Consumer Logs
```bash
docker logs helfy-assignment-consumer-1 -f
```

### Check TiDB Connection
```bash
docker exec -it helfy-assignment-tidb-1 mysql -uroot -h127.0.0.1 -Dtest -e "SELECT * FROM users;"
```

### Check Kafka Topics
```bash
docker exec -it helfy-assignment-kafka-1 \
  /opt/kafka/bin/kafka-topics.sh \
  --list --bootstrap-server localhost:9092
```

### Check CDC Status
```bash
docker exec -it helfy-assignment-api-1 node -e "
const http = require('http');
http.get('http://ticdc:8300/api/v1/changefeeds', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(JSON.parse(data)));
});
"
```

## 🧪 Testing the Pipeline

### 1. Start Everything
```bash
docker-compose up --build -d
sleep 30  # Wait for services
```

### 2. Open Multiple Terminals
```bash
# Terminal 1: Watch API logs
docker logs helfy-assignment-api-1 -f

# Terminal 2: Watch Consumer logs  
docker logs helfy-assignment-consumer-1 -f

# Terminal 3: Test logins
```

### 3. Test Login Multiple Times
```bash
for i in {1..3}; do
  echo "Login attempt $i:"
  curl -X POST http://localhost:3000/api/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin"}'
  echo ""
  sleep 2
done
```

**Result:** See logs appear in BOTH Terminal 1 and Terminal 2 in real-time!

## 🛑 Stopping & Cleanup

```bash
# Stop all containers
docker-compose down

# Stop and remove volumes (complete cleanup)
docker-compose down -v

# View all containers status
docker-compose ps
```

## 🎓 Learning Points

This project demonstrates:

1. **Full-Stack Development** - Frontend, API, Database integration
2. **Microservices Architecture** - Decoupled, scalable components
3. **Event-Driven Systems** - Real-time event processing
4. **CDC Technology** - Database change capture & streaming
5. **Message Queues** - Kafka for async communication
6. **DevOps/SRE** - Docker, Compose, monitoring, logging
7. **Structured Logging** - Enterprise-grade log4js usage
8. **Audit & Compliance** - Complete change tracking
9. **Scalability Patterns** - Horizontal scaling with Kafka

## 📚 Further Reading

- **TiDB**: https://docs.pingcap.com/tidb/stable
- **TiCDC**: https://docs.pingcap.com/tidb/stable/ticdc-overview
- **Apache Kafka**: https://kafka.apache.org/documentation
- **log4js**: https://log4js-node.github.io/log4js-node/
- **Event-Driven Architecture**: https://www.confluent.io/blog/event-driven-architecture/

## 📄 License

This is a learning project for educational purposes.
