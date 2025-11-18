// gRPC server for users service
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from './logger.js';
import { getDb } from './db.js';

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

// gRPC service implementation
const userService = {
  GetUser: async (call, callback) => {
    try {
      const { user_id } = call.request;
      
      if (!user_id) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'user_id is required',
        });
      }

      const db = getDb();
      const { rows } = await db.query(
        'SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = $1',
        [user_id]
      );

      if (rows.length === 0) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: 'User not found',
        });
      }

      const user = rows[0];
      
      callback(null, {
        id: user.id,
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        role: user.role || 'consumer',
        created_at: user.created_at ? user.created_at.toISOString() : '',
      });

      logger.info(`gRPC GetUser called for user_id: ${user_id}`);
    } catch (error) {
      logger.error('gRPC GetUser error', { error: error.message, stack: error.stack });
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error',
      });
    }
  },

  GetUserEmail: async (call, callback) => {
    try {
      const { user_id } = call.request;
      
      if (!user_id) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'user_id is required',
        });
      }

      const db = getDb();
      const { rows } = await db.query(
        'SELECT email, first_name, last_name FROM users WHERE id = $1',
        [user_id]
      );

      if (rows.length === 0) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: 'User not found',
        });
      }

      const user = rows[0];
      
      callback(null, {
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
      });

      logger.info(`gRPC GetUserEmail called for user_id: ${user_id}`);
    } catch (error) {
      logger.error('gRPC GetUserEmail error', { error: error.message, stack: error.stack });
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error',
      });
    }
  },
};

// Create and start gRPC server
let grpcServer = null;

export function startGrpcServer(port = 50051) {
  if (grpcServer) {
    logger.warn('gRPC server already started');
    return grpcServer;
  }

  grpcServer = new grpc.Server();
  
  grpcServer.addService(usersProto.UserService.service, userService);
  
  const serverUrl = `0.0.0.0:${port}`;
  
  grpcServer.bindAsync(
    serverUrl,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        logger.error('Failed to start gRPC server', { error: error.message });
        return;
      }
      
      grpcServer.start();
      logger.info(`gRPC server started on port ${port}`);
    }
  );

  return grpcServer;
}

export function stopGrpcServer() {
  if (grpcServer) {
    grpcServer.tryShutdown((error) => {
      if (error) {
        logger.error('Error shutting down gRPC server', { error: error.message });
      } else {
        logger.info('gRPC server stopped');
      }
    });
    grpcServer = null;
  }
}

