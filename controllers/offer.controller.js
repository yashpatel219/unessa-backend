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

    const date = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Load the template
    const templatePath = path.join(__dirname, "../templates/offer.html");
    // const content = fs.readFileSync(templatePath, "binary");
    let html = fs.readFileSync(templatePath, "utf8");
    html = html.replace(/{{name}}/g, name).replace(/{{date}}/g, date);

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfPath = path.join(__dirname, `../public/offer-${userId}.pdf`);
    await page.pdf({ path: pdfPath, format: "A4" });
    await browser.close();


    // Send email with attachment
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

    // Update user in database
    await User.findByIdAndUpdate(userId,{
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
