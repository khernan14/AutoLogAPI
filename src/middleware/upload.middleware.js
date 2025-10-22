import multer from "multer";
import path from "path";
import fs from "fs";

const uploadsRoot =
  process.env.UPLOADS_PATH || path.join(process.cwd(), "src", "uploads");
fs.mkdirSync(uploadsRoot, { recursive: true });

// Tipos permitidos
const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/bmp",
  "image/webp",
  "image/tiff",
  "image/heif",
  "image/heic",
];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) return cb(null, true);
  cb(
    new Error("Tipo de archivo no permitido. Solo se permiten imágenes."),
    false
  );
};

// Factory para crear uploaders por subcarpeta
export function makeUploader(subfolder = "registros") {
  const destinationDir = path.join(uploadsRoot, subfolder);
  fs.mkdirSync(destinationDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, destinationDir),
    filename: (req, file, cb) => {
      const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname || "");
      cb(null, unique + ext);
    },
  });

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 1024 * 1024 * 5 }, // 5MB
  });
}

// Compatibilidad con lo que ya usabas (registros)
const upload = makeUploader("registros");

export default upload;
