import pool from "../../../config/connectionToSql.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

/** Público: último overall status */
export const getOverallStatus = asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(
    "SELECT overall_status, description, status_timestamp FROM system_overall_status_log ORDER BY status_timestamp DESC, id DESC LIMIT 1"
  );
  res.set("Cache-Control", "public, max-age=60");
  res.json(rows[0] || null);
});

/** Público: lista de servicios */
export const listServices = asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(
    "SELECT id, name, group_name, status, message, lastUpdated, display_order FROM system_services ORDER BY display_order ASC, id ASC"
  );
  res.set("Cache-Control", "public, max-age=60");
  res.json(rows);
});

/** Admin: insertar un overall status (nuevo log) */
export const createOverallStatus = asyncHandler(async (req, res) => {
  const { overall_status, description = null } = req.body;
  if (!overall_status)
    return res.status(400).json({ message: "overall_status requerido" });

  await pool.query(
    "INSERT INTO system_overall_status_log (overall_status, description, status_timestamp) VALUES (?, ?, CURRENT_TIMESTAMP)",
    [overall_status, description]
  );
  const [rows] = await pool.query(
    "SELECT overall_status, description, status_timestamp FROM system_overall_status_log ORDER BY status_timestamp DESC, id DESC LIMIT 1"
  );
  res.status(201).json(rows[0]);
});

/** Admin: crear/actualizar servicio (upsert por nombre) */
export const upsertService = asyncHandler(async (req, res) => {
  const {
    name,
    status,
    message = null,
    group_name = null,
    display_order = null,
  } = req.body;
  if (!name || !status)
    return res.status(400).json({ message: "name y status requeridos" });

  await pool.query(
    `INSERT INTO system_services (name, status, message, group_name, display_order)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       message = VALUES(message),
       group_name = VALUES(group_name),
       display_order = VALUES(display_order),
       lastUpdated = CURRENT_TIMESTAMP`,
    [name, status, message, group_name, display_order]
  );

  const [[row]] = await pool.query(
    "SELECT * FROM system_services WHERE name = ? LIMIT 1",
    [name]
  );
  res.status(201).json(row);
});
