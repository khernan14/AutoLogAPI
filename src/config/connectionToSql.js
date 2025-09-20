// src/config/connectionToSql.js
import mysql from "mysql2/promise";
import dns from "dns";

// Fuerza prioridad IPv4 para evitar conexiones AAAA/IPv6
dns.setDefaultResultOrder("ipv4first");

const host =
  process.env.MYSQLHOST ||
  process.env.DB_HOST || // fallback si usas tu propio naming
  "mysql.railway.internal";

const port = Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306);

const user = process.env.MYSQLUSER || process.env.DB_USER || "root";

const password = process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || "";

const database =
  process.env.MYSQLDATABASE || process.env.DB_DATABASE || "railway";

// Si tu proveedor de MySQL exige SSL (PlanetScale / servicios managed con TLS), pon SSL en true.
const USE_SSL = String(process.env.MYSQL_SSL || "").toLowerCase() === "true";

const pool = mysql.createPool({
  host,
  port,
  user,
  password,
  database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ...(USE_SSL ? { ssl: { rejectUnauthorized: false } } : {}),
});

pool
  .getConnection()
  .then((conn) => {
    console.log("✅ Conexión MySQL OK:", {
      host,
      port,
      database,
      ssl: USE_SSL,
    });
    conn.release();
  })
  .catch((err) => {
    console.error("❌ Error al conectar a MySQL:", err?.message);
  });

export default pool;
