import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const generateAndSendOffer = async (req, res) => {
  try {
    const { userId, email, name } = req.body;

    if (!userId || !email || !name) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const date = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Load and customize HTML template
    const templatePath = path.join(__dirname, "../templates/offer.html");
    let html = fs.readFileSync(templatePath, "utf8");
    html = html.replace(/{{name}}/g, name).replace(/{{date}}/g, date);

    // Ensure public directory exists
    const publicDir = path.join(__dirname, "../public");
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Generate PDF using Puppeteer
    const pdfPath = path.join(publicDir, `offer-${userId}.pdf`);

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 800 }); // optional
      await page.setContent(html, { waitUntil: "domcontentloaded" });
      await page.pdf({ path: pdfPath, format: "A4" });

      await browser.close();
    } catch (puppeteerError) {
      if (browser) await browser.close();
      console.error("Puppeteer PDF generation error:", puppeteerError);
      return res.status(500).json({ message: "Failed to generate offer PDF" });
    }

    // Send email with PDF attachment
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: email,
      subject: "🎉 Your Offer Letter from Unessa Foundation",
      text: `Congratulations ${name}!\n\nPlease find your offer letter attached.\n\nRegards,\nUnessa Foundation`,
      attachments: [
        {
          filename: "OfferLetter.pdf",
          path: pdfPath,
        },
      ],
    });

    // Update user document in database
    await User.findByIdAndUpdate(
      userId,
      {
        quizPassed: true,
        generatedAt: new Date(),
        offerLetterPath: `/offer-${userId}.pdf`,
      },
      { new: true }
    );

    res.status(200).json({ message: "Offer letter sent and saved." });
  } catch (error) {
    console.error("Offer generation error:", error);
    res.status(500).json({ message: "Failed to send offer letter." });
  }
};
