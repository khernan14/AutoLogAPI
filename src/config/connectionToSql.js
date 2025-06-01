import mysql from "mysql2/promise"; // usa versión con promesas

const pool = mysql.createPool({
  host: process.env.DB_HOST || "mysql.railway.internal",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_DATABASE || "railway",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // ssl: { rejectUnauthorized: true }, ❌ NO uses esto para host interno
});

pool
  .getConnection()
  .then((conn) => {
    console.log("✅ Conexión exitosa a la base de datos MySQL");
    conn.release();
  })
  .catch((err) => {
    console.error("❌ Error al conectar a la base de datos:", err.message);
  });

export default pool;
