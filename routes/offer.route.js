import express from "express";
import { generateAndSendOffer } from "../controllers/offer.controller.js";
const router = express.Router();

router.post("/generate-offer", generateAndSendOffer);
router.get("/download/:userId", async (req, res) => {
  try {
    const offer = await Offer.findOne({ userId: req.params.userId });

    if (!offer || !offer.pdf) {
      return res.status(404).send("Offer not found.");
    }

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="OfferLetter.pdf"`,
    });

    res.send(offer.pdf);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).send("Error fetching PDF.");
  }
});

export default router;
