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

    // Pipe the PDF content to a writeable file stream
    doc.pipe(fs.createWriteStream(pdfPath));

    // Add content to the PDF using PDFKit's API
    doc.fontSize(25).text(`Offer Letter for ${name}`, {
      align: "center",
    });
    doc.moveDown();
    doc.fontSize(16).text(`Date: ${date}`);
    doc.moveDown();
    doc.fontSize(12).text("Dear " + name + ",", { align: "left" });
    doc.text("We are pleased to offer you the position of a Software Engineer at Unessa Foundation. Your passion and skills are a perfect fit for our team. We look forward to having you on board.");
    
    // Finalize the PDF and end the stream
    doc.end();

    // 1. Read the HTML template file
    const templatePath = path.join(__dirname, "../templates/offer.html");
    let htmlContent = fs.readFileSync(templatePath, "utf-8");

    // 2. Replace placeholders in the HTML with dynamic data
    htmlContent = htmlContent.replace("{{name}}", name);
    htmlContent = htmlContent.replace("{{date}}", date);

    // 3. Create a Nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    // 4. Send email with the HTML content and attachment
    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: email,
      subject: "🎉 Your Offer Letter from Unessa Foundation",
      html: htmlContent, // Use the processed HTML content
      attachments: [
        {
          filename: "OfferLetter.pdf",
          path: pdfPath,
        },
      ],
    });

    // 5. Update user in the database
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
