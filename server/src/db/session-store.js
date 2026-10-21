import session from "express-session";
import MySQLStoreFactory from "express-mysql-session";

const MySQLStore = MySQLStoreFactory(session);

function getDatabaseConfig() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be configured to use MySQL sessions.");
  }

  let url;

  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid database URL.");
  }

  if (url.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must use the mysql: protocol.");
  }

  if (!url.hostname || !url.username || !url.pathname || url.pathname === "/") {
    throw new Error("DATABASE_URL is missing required connection details.");
  }

  const config = {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    connectionLimit: 2,
    waitForConnections: true,
    enableKeepAlive: true,
  };

  // Enable this for database providers that require TLS, such as Aiven.
  if (process.env.SESSION_DB_SSL === "true") {
    config.ssl = {};
  }

  return config;
}

const databaseConfig = getDatabaseConfig();

export const sessionStore = new MySQLStore({
  clearExpired: true,
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: 8 * 60 * 60 * 1000,
  createDatabaseTable: true,
  endConnectionOnClose: true,
  schema: {
    tableName: "solyce_sessions",
  },
  connectionLimit: databaseConfig.connectionLimit,
  waitForConnections: databaseConfig.waitForConnections,
  enableKeepAlive: databaseConfig.enableKeepAlive,
  host: databaseConfig.host,
  port: databaseConfig.port,
  user: databaseConfig.user,
  password: databaseConfig.password,
  database: databaseConfig.database,
  ssl: databaseConfig.ssl,
});
