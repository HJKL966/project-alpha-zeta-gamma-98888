import { Router, type IRouter } from "express";
import { handleWebhookUpdate, WEBHOOK_PATH } from "../lib/bot";

const router: IRouter = Router();

router.post(WEBHOOK_PATH.replace(/^\/api/, ""), (req, res) => {
  const secretHeader = req.header("x-telegram-bot-api-secret-token");
  const result = handleWebhookUpdate(req.body, secretHeader);
  res.status(result.status).json({ ok: result.ok });
});

export default router;
