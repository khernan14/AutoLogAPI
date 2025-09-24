import { Router } from "express";
import {
  listFaqs,
  getFaqBySlug,
  voteFaqHelpful,
} from "../../controllers/AutoLog/help/faqs.controller.js";
import {
  listTutorials,
  getTutorialBySlug,
} from "../../controllers/AutoLog/help/tutorials.controller.js";
import {
  getOverallStatus,
  listServices,
} from "../../controllers/AutoLog/help/system.controller.js";
import {
  listChangelogs,
  getChangelogBySlug,
  getPinnedChangelogs,
} from "../../controllers/AutoLog/help/changelogs.controller.js";

const router = Router();

/** FAQs */
router.get("/help/faqs", listFaqs);
router.get("/help/faqs/:slug", getFaqBySlug);
router.post("/help/faqs/:id/helpful", voteFaqHelpful);

/** Tutorials */
router.get("/help/tutorials", listTutorials);
router.get("/help/tutorials/:slug", getTutorialBySlug);

/** System status */
router.get("/help/status/overall", getOverallStatus);
router.get("/help/status/services", listServices);

/** Changelogs */
// 👇 primero las rutas fijas
router.get("/help/changelogs/pinned", getPinnedChangelogs);
// 👇 luego la paramétrica
router.get("/help/changelogs/:slug", getChangelogBySlug);
router.get("/help/changelogs", listChangelogs);

export default router;
