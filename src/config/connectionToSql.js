import mysql from "mysql2";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "nozomi.proxy.rlwy.net",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_DATABASE || "railway",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: true,
  },
});

pool
  .getConnection()
  .then(() => {
    console.log("✅ Conexión exitosa a la base de datos MySQL");
  })
  .catch((err) => {
    console.error("❌ Error al conectar a la base de datos:", err.message);
  });

export default pool;
