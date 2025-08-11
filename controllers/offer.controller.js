import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import { jsPDF } from "jspdf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const generateAndSendOffer = async (req, res) => {
  try {
    const { userId, email, name } = req.body;

    const date = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Create a new PDF document
    const doc = new jsPDF();

    // Set font and add content
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(`Offer Letter for ${name}`, 105, 20, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Date: ${date}`, 105, 35, { align: "center" });

    doc.text(`Dear ${name},`, 20, 50);
    doc.text(
      "We are pleased to offer you the position of a Software Engineer at Unessa Foundation. " +
      "Your passion and skills are a perfect fit for our team. " +
      "We look forward to having you on board.",
      20, 60, { maxWidth: 170 }
    );

    // Save the PDF to a file
    const pdfPath = path.join(__dirname, `../public/offer-${userId}.pdf`);
    const pdfBuffer = doc.output("arraybuffer");
    fs.writeFileSync(pdfPath, Buffer.from(pdfBuffer));

    // Read and process email template
    const templatePath = path.join(__dirname, "../templates/offer.html");
    let htmlContent = fs.readFileSync(templatePath, "utf-8");
    htmlContent = htmlContent.replace("{{name}}", name);
    htmlContent = htmlContent.replace("{{date}}", date);

    // Configure email transporter
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    // Send email with attachment
    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: email,
      subject: "🎉 Your Offer Letter from Unessa Foundation",
      html: htmlContent,
      attachments: [
        {
          filename: "OfferLetter.pdf",
          path: pdfPath,
          contentType: "application/pdf",
        },
      ],
    });

    // Update user in database
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
