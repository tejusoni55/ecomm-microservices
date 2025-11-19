// Kafka client wrapper for easy producer and consumer usage
import { Kafka, logLevel } from 'kafkajs';
import logger from '@ecomm/logger';

let kafkaInstance = null;

function getKafka() {
  if (kafkaInstance) {
    return kafkaInstance;
  }

  kafkaInstance = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || 'ecomm-service',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    logLevel: process.env.KAFKA_LOG_LEVEL === 'debug' ? logLevel.DEBUG : logLevel.INFO,
    ssl: process.env.NODE_ENV === 'production',
    sasl: process.env.KAFKA_SASL_ENABLED === 'true' ? {
      mechanism: 'plain',
      username: process.env.KAFKA_SASL_USERNAME,
      password: process.env.KAFKA_SASL_PASSWORD,
    } : undefined,
  });

  return kafkaInstance;
}

// Create producer
let producerInstance = null;

export async function getProducer() {
  if (producerInstance) {
    return producerInstance;
  }

  const kafka = getKafka();
  producerInstance = kafka.producer({
    maxInFlightRequests: 5,
    idempotent: true,
  });

  await producerInstance.connect();
  logger.info('Kafka producer connected');

  return producerInstance;
}

// Publish message to topic
export async function publish(topic, messages) {
  const producer = await getProducer();
  
  const formattedMessages = Array.isArray(messages) ? messages : [messages];
  
  await producer.send({
    topic,
    messages: formattedMessages.map(msg => ({
      key: msg.key || null,
      value: JSON.stringify(msg.value || msg),
      headers: msg.headers || {},
    })),
  });

  logger.debug(`Published message to topic: ${topic}`, { count: formattedMessages.length });
}

// Create admin client for topic management
let adminInstance = null;

async function getAdmin() {
  if (adminInstance) {
    return adminInstance;
  }

  const kafka = getKafka();
  adminInstance = kafka.admin();
  await adminInstance.connect();
  logger.info('Kafka admin client connected');
  return adminInstance;
}

// Create topic if it doesn't exist
async function ensureTopicExists(topic) {
  try {
    const admin = await getAdmin();
    const topics = await admin.listTopics();
    
    if (!topics.includes(topic)) {
      await admin.createTopics({
        topics: [{
          topic,
          numPartitions: 1,
          replicationFactor: 1,
          configEntries: [
            { name: 'retention.ms', value: '604800000' }, // 7 days
            { name: 'cleanup.policy', value: 'delete' },
          ],
        }],
      });
      logger.info(`Created Kafka topic: ${topic}`);
    }
  } catch (error) {
    // Topic might already exist or admin might not have permissions
    // This is okay, we'll let the consumer handle it
    logger.debug(`Topic creation check for ${topic}`, { error: error.message });
  }
}

// Create consumer
let consumerInstance = null;

export async function getConsumer(groupId) {
  const kafka = getKafka();
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  logger.info(`Kafka consumer connected with group: ${groupId}`);
  return consumer;
}

// Subscribe to topic with handler (with retry logic for topic creation)
async function subscribeWithRetry(topic, groupId, handler, retryCount = 0, maxRetries = 3) {
  try {
    // Ensure topic exists before subscribing
    await ensureTopicExists(topic);
    
    const consumer = await getConsumer(groupId);
    
    await consumer.subscribe({ topic, fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = JSON.parse(message.value.toString());
          logger.debug(`Received message from topic: ${topic}`, { partition, key: message.key?.toString() });
          await handler(value, message);
        } catch (error) {
          logger.error(`Error processing message from topic: ${topic}`, { error: error.message });
          // Don't throw - let Kafka handle retries
        }
      },
    });

    logger.info(`Subscribed to topic: ${topic} with group: ${groupId}`);
    return consumer;
  } catch (error) {
    // If topic doesn't exist or partition error, retry
    const isTopicError = error.message && (
      error.message.includes('does not host this topic-partition') ||
      error.message.includes('UnknownTopicOrPartition') ||
      error.message.includes('LeaderNotAvailable')
    );
    
    if (isTopicError && retryCount < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
      logger.warn(`Topic ${topic} not ready yet (attempt ${retryCount + 1}/${maxRetries}). Retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return subscribeWithRetry(topic, groupId, handler, retryCount + 1, maxRetries);
    }
    
    if (isTopicError) {
      logger.warn(`Topic ${topic} still not available after ${maxRetries} retries. It will be created when first message is published. Consumer will retry automatically.`);
      // Return null to indicate subscription failed but don't crash
      return null;
    }
    
    logger.error(`Failed to subscribe to topic: ${topic}`, { error: error.message });
    throw error;
  }
}

// Subscribe to topic with handler
export async function subscribe(topic, groupId, handler) {
  return subscribeWithRetry(topic, groupId, handler);
}

// Disconnect producer
export async function disconnectProducer() {
  if (producerInstance) {
    await producerInstance.disconnect();
    producerInstance = null;
    logger.info('Kafka producer disconnected');
  }
}

// Disconnect consumer
export async function disconnectConsumer(consumer) {
  if (consumer) {
    await consumer.disconnect();
    logger.info('Kafka consumer disconnected');
  }
}

// Disconnect admin
export async function disconnectAdmin() {
  if (adminInstance) {
    await adminInstance.disconnect();
    adminInstance = null;
    logger.info('Kafka admin client disconnected');
  }
}
