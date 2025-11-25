// gRPC server for users service
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import logger from "./logger.js";
import { getDb } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load proto file
const PROTO_PATH = join(__dirname, "../../../libs/grpc-protos/users.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const usersProto = grpc.loadPackageDefinition(packageDefinition).ecomm.users;
const MTLS_ENABLED = process.env.GRPC_MTLS_ENABLED === "true";

// Simple certificate loader: env vars first, then file paths
function loadCert(contentOrPath) {
  if (!contentOrPath) return false;
  // If it looks like base64 or contains newlines, treat as content
  if (contentOrPath.includes("\n") || contentOrPath.length > 100) {
    return Buffer.from(contentOrPath, "utf-8");
  }
  // Otherwise treat as file path
  if (fs.existsSync(contentOrPath)) {
    return fs.readFileSync(contentOrPath);
  }
  return false;
}

function loadServerCerts() {
  const caCert = process.env.GRPC_CA_CERT
    ? Buffer.from(process.env.GRPC_CA_CERT, "utf-8")
    : process.env.GRPC_CA_CERT_PATH
    ? loadCert(process.env.GRPC_CA_CERT_PATH)
    : null;

  const serverCert = process.env.GRPC_SERVER_CERT
    ? Buffer.from(process.env.GRPC_SERVER_CERT, "utf-8")
    : process.env.GRPC_SERVER_CERT_PATH
    ? loadCert(process.env.GRPC_SERVER_CERT_PATH)
    : null;

  const serverKey = process.env.GRPC_SERVER_KEY
    ? Buffer.from(process.env.GRPC_SERVER_KEY, "utf-8")
    : process.env.GRPC_SERVER_KEY_PATH
    ? loadCert(process.env.GRPC_SERVER_KEY_PATH)
    : null;

  if (!caCert || !serverCert || !serverKey) {
    throw new Error(
      "Missing mTLS certificates. Set GRPC_CA_CERT, GRPC_SERVER_CERT, GRPC_SERVER_KEY (or *_PATH variants)"
    );
  }

  return { caCert, serverCert, serverKey };
}

// gRPC service implementation
const userService = {
  GetUser: async (call, callback) => {
    try {
      const { user_id } = call.request;

      if (!user_id) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: "user_id is required",
        });
      }

      const db = getDb();
      const { rows } = await db.query(
        "SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = $1",
        [user_id]
      );

      if (rows.length === 0) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: "User not found",
        });
      }

      const user = rows[0];

      callback(null, {
        id: user.id,
        email: user.email || "",
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        role: user.role || "consumer",
        created_at: user.created_at ? user.created_at.toISOString() : "",
      });

      logger.info(`gRPC GetUser called for user_id: ${user_id}`);
    } catch (error) {
      logger.error("gRPC GetUser error", {
        error: error.message,
        stack: error.stack,
      });
      callback({
        code: grpc.status.INTERNAL,
        message: "Internal server error",
      });
    }
  },

  GetUserEmail: async (call, callback) => {
    try {
      const { user_id } = call.request;

      if (!user_id) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: "user_id is required",
        });
      }

      const db = getDb();
      const { rows } = await db.query(
        "SELECT email, first_name, last_name FROM users WHERE id = $1",
        [user_id]
      );

      if (rows.length === 0) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: "User not found",
        });
      }

      const user = rows[0];

      callback(null, {
        email: user.email || "",
        first_name: user.first_name || "",
        last_name: user.last_name || "",
      });

      logger.info(`gRPC GetUserEmail called for user_id: ${user_id}`);
    } catch (error) {
      logger.error("gRPC GetUserEmail error", {
        error: error.message,
        stack: error.stack,
      });
      callback({
        code: grpc.status.INTERNAL,
        message: "Internal server error",
      });
    }
  },
};

let grpcServer = null;

function getServerCredentials() {
  if (!MTLS_ENABLED) {
    return grpc.ServerCredentials.createInsecure();
  }

  try {
    const { caCert, serverCert, serverKey } = loadServerCerts();
    logger.info("Loaded mTLS certificates for Users gRPC server");
    return grpc.ServerCredentials.createSsl(
      caCert,
      [{ private_key: serverKey, cert_chain: serverCert }],
      true
    );
  } catch (error) {
    logger.error("Failed to load gRPC server certificates", {
      error: error.message,
    });
    throw error;
  }
}

// Create and start gRPC server
export function startGrpcServer(port = 50051) {
  if (grpcServer) {
    logger.warn("gRPC server already started");
    return grpcServer;
  }

  grpcServer = new grpc.Server();
  grpcServer.addService(usersProto.UserService.service, userService);

  const serverUrl = `0.0.0.0:${port}`;
  const credentials = getServerCredentials();

  grpcServer.bindAsync(serverUrl, credentials, (error, boundPort) => {
    if (error) {
      logger.error("Failed to start gRPC server", { error: error.message });
      throw error;
    }

    grpcServer.start();
    logger.info(
      `gRPC server started on port ${boundPort} (mTLS: ${MTLS_ENABLED})`
    );
  });

  return grpcServer;
}

export function stopGrpcServer() {
  if (grpcServer) {
    grpcServer.tryShutdown((error) => {
      if (error) {
        logger.error("Error shutting down gRPC server", {
          error: error.message,
        });
      } else {
        logger.info("gRPC server stopped");
      }
    });
    grpcServer = null;
  }
}
