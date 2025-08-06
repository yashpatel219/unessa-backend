import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import pdf from "html-pdf-node";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const generateAndSendOffer = async (req, res) => {
  try {
    const { userId, email, name } = req.body;

    const date = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const templatePath = path.join(__dirname, "../templates/offer.html");
    let html = fs.readFileSync(templatePath, "utf8");
    html = html.replace(/{{name}}/g, name).replace(/{{date}}/g, date);

    const pdfPath = path.join(__dirname, `../public/offer-${userId}.pdf`);
    const file = { content: html };
    const options = { format: "A4" };

    const pdfBuffer = await pdf.generatePdf(file, options);
    fs.writeFileSync(pdfPath, pdfBuffer);

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
      attachments: [{ filename: "OfferLetter.pdf", path: pdfPath }],
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
