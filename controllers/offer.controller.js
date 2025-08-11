import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import PDFDocument from "pdfkit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const generateAndSendOffer = async (req, res) => {
  try {
    const { userId, email, name } = req.body;

    const date = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const pdfPath = path.join(__dirname, `../public/offer-${userId}.pdf`);
    const doc = new PDFDocument();
    
    // Create a write stream and wait for it to finish
    const pdfStream = fs.createWriteStream(pdfPath);
    doc.pipe(pdfStream);

    // Add content to the PDF
    doc.fontSize(25).text(`Offer Letter for ${name}`, { align: "center" });
    doc.moveDown();
    doc.fontSize(16).text(`Date: ${date}`);
    doc.moveDown();
    doc.fontSize(12).text("Dear " + name + ",", { align: "left" });
    doc.text("We are pleased to offer you the position of a Software Engineer at Unessa Foundation. Your passion and skills are a perfect fit for our team. We look forward to having you on board.");
    
    doc.end();

    // Wait for the PDF to finish writing
    await new Promise((resolve, reject) => {
      pdfStream.on('finish', resolve);
      pdfStream.on('error', reject);
    });

    // Rest of your code (email sending and database update)
    const templatePath = path.join(__dirname, "../templates/offer.html");
    let htmlContent = fs.readFileSync(templatePath, "utf-8");
    htmlContent = htmlContent.replace("{{name}}", name);
    htmlContent = htmlContent.replace("{{date}}", date);

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
      html: htmlContent,
      attachments: [
        {
          filename: "OfferLetter.pdf",
          path: pdfPath,
        },
      ],
    });

    await User.findByIdAndUpdate(userId, {
      quizPassed: true,
      generatedAt: new Date(),
      offerLetterPath: `/offer-${userId}.pdf`,
    }, { new: true });

    res.status(200).json({ message: "Offer letter sent and saved." });
  } catch (error) {
    console.error("Offer generation error:", error);
    res.status(500).json({ message: "Failed to send offer letter." });
  }
};
