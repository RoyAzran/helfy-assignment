# Setup and Running Instructions

## Prerequisites
- Docker installed
- Docker Compose installed

## Run the Project
The entire project can be started with a single command:

```bash
docker-compose up --build
```

This command will:
1. Build all Docker images (Client, API, Consumer)
2. Start the TiDB cluster (PD, TiKV, TiDB)
3. Start Apache Kafka and Zookeeper
4. Initialize the database schema
5. Start the CDC (Change Data Capture) pipeline
6. Launch the application services

## Access Points
- **Frontend Application**: http://localhost
- **Backend API**: http://localhost:3000
- **TiDB Database**: localhost:4000

## Stopping the Project
To stop all services and clean up:
```bash
docker-compose down
```
