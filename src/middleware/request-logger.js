// src/middlewares/request-logger.js
import logger from "../utils/logger.js";

export const requestLogger = (req, res, next) => {
  const { method, originalUrl } = req;
  logger.info({ method, url: originalUrl }, "incoming request");
  res.on("finish", () => {
    logger.info(
      { method, url: originalUrl, status: res.statusCode },
      "response"
    );
  });
  next();
};
