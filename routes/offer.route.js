import express from "express";
import { generateAndSendOffer } from "../controllers/offer.controller.js";
import User from "../models/User.js";
const router = express.Router();

router.post("/generate-offer", generateAndSendOffer);
app.get("/offer/:userId", async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user || !user.pdf) {
    return res.status(404).send("Offer not found");
  }
  res.setHeader("Content-Type", "application/pdf");
  res.send(user.pdf);
});

export default router;
