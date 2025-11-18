// gRPC client for orders service to call users service
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from '@ecomm/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load proto file
const PROTO_PATH = join(__dirname, '../../../libs/grpc-protos/users.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const usersProto = grpc.loadPackageDefinition(packageDefinition).ecomm.users;

let usersClient = null;

// Get or create gRPC client
export function getUsersClient() {
  if (usersClient) {
    return usersClient;
  }

  const usersServiceUrl = process.env.GRPC_USERS_ENDPOINT || 'localhost:50051';
  
  usersClient = new usersProto.UserService(
    usersServiceUrl,
    grpc.credentials.createInsecure()
  );

  logger.info(`gRPC client connected to users service at ${usersServiceUrl}`);
  return usersClient;
}

// Get user by ID
export function getUser(userId) {
  return new Promise((resolve, reject) => {
    const client = getUsersClient();
    
    client.GetUser({ user_id: userId }, (error, response) => {
      if (error) {
        logger.error('gRPC GetUser error', { error: error.message, userId });
        reject(error);
        return;
      }
      resolve(response);
    });
  });
}

// Get user email by ID
export function getUserEmail(userId) {
  return new Promise((resolve, reject) => {
    const client = getUsersClient();
    
    client.GetUserEmail({ user_id: userId }, (error, response) => {
      if (error) {
        logger.error('gRPC GetUserEmail error', { error: error.message, userId });
        reject(error);
        return;
      }
      resolve(response);
    });
  });
}

