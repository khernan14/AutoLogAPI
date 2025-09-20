// src/api/routes/search.routes.js
import { Router } from "express";
import { globalSearch } from "../../controllers/AutoLog/help/search.controller.js";
import { getPreview } from "../../controllers/AutoLog/help/preview.controller.js";
const router = Router();

router.get("/search", globalSearch);
router.get("/preview", getPreview);

export default router;
