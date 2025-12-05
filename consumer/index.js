const { Kafka } = require('kafkajs');
const log4js = require('log4js');

log4js.configure({
    appenders: { 
        console: { type: 'console', layout: { type: 'pattern', pattern: '%m' } } 
    },
    categories: { 
        default: { appenders: ['console'], level: 'info' } 
    }
});
const logger = log4js.getLogger();

const kafka = new Kafka({
    clientId: 'cdc-consumer',
    brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(',')
});

const consumer = kafka.consumer({ groupId: 'cdc-consumer-group' });

const run = async () => {
    console.log('Starting CDC Consumer...');
    
    let connected = false;
    let retries = 0;
    while (!connected && retries < 30) {
        try {
            await consumer.connect();
            connected = true;
            console.log('Connected to Kafka');
        } catch (err) {
            retries++;
            console.log(`Kafka not ready, retrying in 5s... (attempt ${retries}/30)`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    if (!connected) {
        console.error('Failed to connect to Kafka after 30 attempts');
        process.exit(1);
    }

    await consumer.subscribe({ topic: 'tidb-cdc-events', fromBeginning: true });
    await consumer.subscribe({ topic: 'user-logins', fromBeginning: true });
    console.log('Subscribed to topics: tidb-cdc-events, user-logins');

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const value = message.value ? message.value.toString() : null;
            
            if (value) {
                try {
                    const parsed = JSON.parse(value);
                    
                    if (topic === 'tidb-cdc-events') {
                        const logEntry = {
                            timestamp: new Date().toISOString(),
                            source: 'TiDB-CDC',
                            topic: topic,
                            partition: partition,
                            offset: message.offset,
                            operation: parsed.type || parsed.isDdl ? 'DDL' : 'DML',
                            database: parsed.database || 'unknown',
                            table: parsed.table || 'unknown',
                            data: parsed.data || parsed
                        };
                        logger.info(JSON.stringify(logEntry));
                    } else if (topic === 'user-logins') {
                        const logEntry = {
                            timestamp: new Date().toISOString(),
                            source: 'UserActivity',
                            topic: topic,
                            event: 'LOGIN',
                            userId: parsed.userId,
                            username: parsed.username,
                            loginTime: parsed.timestamp
                        };
                        logger.info(JSON.stringify(logEntry));
                    }
                } catch (e) {
                    logger.error(JSON.stringify({
                        timestamp: new Date().toISOString(),
                        error: 'Parse error',
                        message: e.message,
                        rawValue: value.substring(0, 200)
                    }));
                }
            }
        },
    });
};

run().catch(err => {
    console.error('Consumer error:', err);
    process.exit(1);
});
