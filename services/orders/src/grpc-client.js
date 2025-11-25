// gRPC client for orders service to call users service
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import logger from "@ecomm/logger";

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

function loadClientCerts() {
  const caCert =
    process.env.GRPC_CA_CERT ||
    (process.env.GRPC_CA_CERT_PATH &&
      loadCert(process.env.GRPC_CA_CERT_PATH)) ||
    "../../../scripts/certs/ca-cert.pem";

  const clientCert =
    process.env.GRPC_CLIENT_CERT ||
    (process.env.GRPC_CLIENT_CERT_PATH &&
      loadCert(process.env.GRPC_CLIENT_CERT_PATH)) ||
    "../../../scripts/certs/orders-service/client-cert.pem";

  const clientKey =
    process.env.GRPC_CLIENT_KEY ||
    (process.env.GRPC_CLIENT_KEY_PATH &&
      loadCert(process.env.GRPC_CLIENT_KEY_PATH)) ||
    "../../../scripts/certs/orders-service/client-key.pem";

  if (!caCert || !clientCert || !clientKey) {
    throw new Error(
      "Missing mTLS certificates. Set GRPC_CA_CERT, GRPC_CLIENT_CERT, GRPC_CLIENT_KEY (or *_PATH variants)"
    );
  }

  return { caCert, clientCert, clientKey };
}

function getGrpcCredentials() {
  if (!MTLS_ENABLED) {
    return grpc.credentials.createInsecure();
  }

  try {
    const { caCert, clientCert, clientKey } = loadClientCerts();
    logger.info("Loaded mTLS credentials for Orders gRPC client");
    return grpc.credentials.createSsl(caCert, clientKey, clientCert);
  } catch (error) {
    logger.error("Failed to load gRPC client certificates", {
      error: error.message,
    });
    throw error;
  }
}

let usersClient = null;

// Get or create gRPC client
export function getUsersClient() {
  if (usersClient) {
    return usersClient;
  }

  const usersServiceUrl = process.env.GRPC_USERS_ENDPOINT || "localhost:50051";
  const credentials = getGrpcCredentials();

  usersClient = new usersProto.UserService(usersServiceUrl, credentials);
  logger.info(
    `gRPC client connected to users service at ${usersServiceUrl} (mTLS: ${MTLS_ENABLED})`
  );
  return usersClient;
}

// Get user by ID
export async function getUser(userId) {
  const client = getUsersClient();

  return new Promise((resolve, reject) => {
    client.GetUser({ user_id: userId }, (error, response) => {
      if (error) {
        logger.error("gRPC GetUser error", { error: error.message, userId });
        reject(error);
        return;
      }
      resolve(response);
    });
  });
}

// Get user email by ID
export async function getUserEmail(userId) {
  const client = getUsersClient();

  return new Promise((resolve, reject) => {
    client.GetUserEmail({ user_id: userId }, (error, response) => {
      if (error) {
        logger.error("gRPC GetUserEmail error", {
          error: error.message,
          userId,
        });
        reject(error);
        return;
      }
      resolve(response);
    });
  });
}
