require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2');
const { v4: uuidv4 } = require('uuid');
const { Kafka } = require('kafkajs');
const log4js = require('log4js');

const app = express();
const port = process.env.PORT || 3000;

log4js.configure({
    appenders: { 
        console: { type: 'console' } 
    },
    categories: { 
        default: { appenders: ['console'], level: 'info' } 
    }
});
const logger = log4js.getLogger();

app.use(cors());
app.use(bodyParser.json());

const dbConfig = {
    host: process.env.TIDB_HOST || '127.0.0.1',
    port: process.env.TIDB_PORT || 4000,
    user: process.env.TIDB_USER || 'root',
    password: process.env.TIDB_PASSWORD || '',
    database: process.env.TIDB_DATABASE || 'test'
};

if (process.env.TIDB_SSL === 'true') {
    dbConfig.ssl = {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    };
}

const pool = mysql.createPool(dbConfig);

pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to TiDB:', err);
    } else {
        console.log('Successfully connected to TiDB');
        connection.release();
    }
});

const kafka = new Kafka({
    clientId: 'auth-service',
    brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(',')
});

const producer = kafka.producer();

const connectProducer = async () => {
    try {
        await producer.connect();
        console.log('Connected to Kafka');
    } catch (error) {
        console.error('Error connecting to Kafka:', error);
    }
};
connectProducer();

const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    const query = 'SELECT * FROM users WHERE auth_token = ?';
    pool.query(query, [token], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(403).json({ message: 'Forbidden: Invalid token' });
        }

        req.user = results[0];
        next();
    });
};

app.get('/', (req, res) => {
    res.json({ message: 'API is running', version: '1.0.0' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
    
    pool.query(query, [username, password], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (results.length > 0) {
            const user = results[0];
            const token = uuidv4();

            logger.info(JSON.stringify({
                timestamp: new Date().toISOString(),
                userId: user.id,
                action: 'LOGIN_SUCCESS',
                ipAddress: ipAddress
            }));

            const updateQuery = 'UPDATE users SET auth_token = ? WHERE id = ?';
            pool.query(updateQuery, [token, user.id], async (updateErr) => {
                if (updateErr) {
                    console.error('Error updating token:', updateErr);
                    return res.status(500).json({ message: 'Error generating token' });
                }

                try {
                    await producer.send({
                        topic: 'user-logins',
                        messages: [
                            { value: JSON.stringify({ userId: user.id, username: user.username, timestamp: new Date().toISOString() }) },
                        ],
                    });
                    console.log('Login event sent to Kafka');
                } catch (kafkaError) {
                    console.error('Error sending to Kafka:', kafkaError);
                }

                res.json({ 
                    message: 'Login successful', 
                    token,
                    user: { id: user.id, username: user.username, email: user.email }
                });
            });
        } else {
            logger.warn(JSON.stringify({
                timestamp: new Date().toISOString(),
                userId: null,
                action: 'LOGIN_FAILED',
                ipAddress: ipAddress,
                usernameAttempt: username
            }));
            res.status(401).json({ message: 'Invalid credentials' });
        }
    });
});

app.get('/api/data', authenticate, (req, res) => {
    res.json({ 
        message: 'This is protected data', 
        user: req.user.username 
    });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
