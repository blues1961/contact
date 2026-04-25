function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.API_INTERNAL_PORT || 8000),
  appSlug: process.env.APP_SLUG || "con",
  appDepot: process.env.APP_DEPOT || "contact",
  appNo: Number(process.env.APP_NO || 4),
  jwtSecret: requireEnv("JWT_SECRET"),
  postgresUser: requireEnv("POSTGRES_USER"),
  postgresDb: requireEnv("POSTGRES_DB"),
  postgresPassword: requireEnv("POSTGRES_PASSWORD"),
  dbHost: process.env.DB_HOST || "db",
  dbPort: Number(process.env.DB_PORT || 5432),
  adminUsername: requireEnv("ADMIN_USERNAME"),
  adminEmail: requireEnv("ADMIN_EMAIL"),
  adminPassword: requireEnv("ADMIN_PASSWORD"),
  version: "0.1.0"
};

