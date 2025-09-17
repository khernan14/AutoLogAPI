import { Router } from "express";
import {
  authenticate,
  authorizeByPermisos,
} from "../../middleware/auth.middleware.js";

import {
  createFaq,
  updateFaq,
  deleteFaq,
} from "../../controllers/AutoLog/help/faqs.controller.js";

import {
  createTutorial,
  updateTutorial,
  deleteTutorial,
  replaceTutorialSteps,
  replaceTutorialAttachments,
} from "../../controllers/AutoLog/help/tutorials.controller.js";

import {
  createOverallStatus,
  upsertService,
} from "../../controllers/AutoLog/help/system.controller.js";

import {
  createChangelog,
  updateChangelog,
  deleteChangelog,
} from "../../controllers/AutoLog/help/changelogs.controller.js";

const router = Router();
const canManage = [authenticate, authorizeByPermisos(["help_manage"])];

// FAQs
router.post("/admin/help/faqs", ...canManage, createFaq);
router.put("/admin/help/faqs/:id", ...canManage, updateFaq);
router.delete("/admin/help/faqs/:id", ...canManage, deleteFaq);

// Tutorials
router.post("/admin/help/tutorials", ...canManage, createTutorial);
router.put("/admin/help/tutorials/:id", ...canManage, updateTutorial);
router.delete("/admin/help/tutorials/:id", ...canManage, deleteTutorial);
router.post(
  "/admin/help/tutorials/:id/steps",
  ...canManage,
  replaceTutorialSteps
);
router.post(
  "/admin/help/tutorials/:id/attachments",
  ...canManage,
  replaceTutorialAttachments
);

// System
router.post("/admin/help/status/overall", ...canManage, createOverallStatus);
router.post("/admin/help/status/services", ...canManage, upsertService);

// Changelogs
router.post("/admin/help/changelogs", ...canManage, createChangelog);
router.put("/admin/help/changelogs/:id", ...canManage, updateChangelog);
router.delete("/admin/help/changelogs/:id", ...canManage, deleteChangelog);

export default router;
