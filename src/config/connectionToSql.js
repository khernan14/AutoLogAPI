import mysql from "mysql2/promise";
import dns from "dns";
import logger from "../utils/logger.js";

// Prioriza IPv4
dns.setDefaultResultOrder("ipv4first");

const host =
  process.env.MYSQLHOST || process.env.DB_HOST || "mysql.railway.internal";
const port = Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306);
const user = process.env.MYSQLUSER || process.env.DB_USER || "root";
const password = process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || "";
const database =
  process.env.MYSQLDATABASE || process.env.DB_DATABASE || "railway";
const USE_SSL = String(process.env.MYSQL_SSL || "").toLowerCase() === "true";

const pool = mysql.createPool({
  host,
  port,
  user,
  password,
  database,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10_000, // ✅ deja este, remueve acquireTimeout
  multipleStatements: false, // ✅ importante
  supportBigNumbers: true,
  bigNumberStrings: true,
  timezone: "Z",
  ...(USE_SSL ? { ssl: { rejectUnauthorized: false } } : {}),
});

// Inicializa una vez (PROMISE connection) y aplica modos de sesión
try {
  const conn = await pool.getConnection(); // ← conexión "promisificada"
  try {
    await conn.query("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await conn.query(
      "SET SESSION sql_mode = 'STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'"
    );
  } catch (err) {
    logger.warn({ err }, "No se pudieron aplicar SQL modes de sesión");
  }
  await conn.ping();
  conn.release();
  logger.info({ db: database, host }, "MySQL pool listo");
} catch (err) {
  logger.error({ err }, "Error al conectar a MySQL en el arranque");
}

export default pool;
