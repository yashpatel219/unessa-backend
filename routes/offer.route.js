import express from "express";
import { generateAndSendOffer } from "../controllers/offer.controller.js";
const router = express.Router();

router.post("/generate-offer", generateAndSendOffer);

export default router;
