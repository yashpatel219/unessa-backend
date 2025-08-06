import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import fetch from "node-fetch";
import User from "../models/User.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const generateAndSendOffer = async (req, res) => {
  try {
    const { userId, email, name } = req.body;

    const date = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Load HTML template and replace placeholders
    const templatePath = path.join(__dirname, "../templates/offer.html");
    let html = fs.readFileSync(templatePath, "utf8");
    html = html.replace(/{{name}}/g, name).replace(/{{date}}/g, date);

    // Use external API to generate PDF
    const pdfResponse = await fetch("https://api.html2pdf.app/v1/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html,
        apiKey: "9bWLC9jTNMAG0aJcTXbGnDr5HSxqSpxjDfH2LbWhyJGAEcC08yPyygF3YSdjpQLF" // Replace with your free API key from https://html2pdf.app
      })
    });

const arrayBuffer = await pdfResponse.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);

    await Offer.create({
      userId,
      name,
      email,
      pdf: pdfBuffer
    });

    // const pdfPath = path.join(__dirname, `../public/offer-${userId}.pdf`);
    // fs.writeFileSync(pdfPath, buffer);

    // Send email
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
