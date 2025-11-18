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

// Create consumer
let consumerInstance = null;

export async function getConsumer(groupId) {
  const kafka = getKafka();
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  logger.info(`Kafka consumer connected with group: ${groupId}`);
  return consumer;
}

// Subscribe to topic with handler
export async function subscribe(topic, groupId, handler) {
  const consumer = await getConsumer(groupId);
  
  await consumer.subscribe({ topic });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const value = JSON.parse(message.value.toString());
        logger.debug(`Received message from topic: ${topic}`, { partition, key: message.key?.toString() });
        await handler(value, message);
      } catch (error) {
        logger.error(`Error processing message from topic: ${topic}`, { error: error.message });
        throw error;
      }
    },
  });

  return consumer;
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
