import express from "express";
import { generateAndSendOffer } from "../controllers/offer.controller.js";
import User from "../models/User.js";
const router = express.Router();

router.post("/generate-offer", generateAndSendOffer);
router.get("/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user || !user.pdf) {
      return res.status(404).send("Offer not found");
    }

    res.setHeader("Content-Type", "application/pdf");
    res.send(user.pdf);
  } catch (err) {
    console.error("Failed to fetch offer:", err);
    res.status(500).send("Server error");
  }
});


export default router;
