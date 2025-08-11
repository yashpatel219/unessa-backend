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

    // --- Start of PDF content generation ---
    // Add content to the PDF using PDFKit's API
    doc.fontSize(25).text(`Offer Letter for ${name}`, {
      align: "center",
    });
    
    doc.moveDown();
    
    doc.fontSize(14).text(`Date: ${date}`);
    
    doc.moveDown();
    
    doc.fontSize(12).text(`Dear ${name},`, { align: "left" });
    
    doc.moveDown();
    
    doc.text("We are pleased to offer you the position of a Software Engineer at Unessa Foundation. Your passion and skills are a perfect fit for our team. We look forward to having you on board.");
    
    doc.moveDown();
    
    doc.text("This offer is contingent upon a successful background check and the verification of your right to work. We are confident you will be a great asset to our team and we look forward to your positive response.");
    
    doc.moveDown();
    
    doc.text("Sincerely,");
    
    doc.moveDown();
    
    doc.text("The Unessa Foundation Team");
    // --- End of PDF content generation ---

    // Finalize the PDF and end the stream *after* all content has been added
    doc.end();

    // Read the HTML template for the email body
    const templatePath = path.join(__dirname, "../templates/offer.html");
    let htmlContent = fs.readFileSync(templatePath, "utf-8");

    // Replace placeholders in the HTML
    htmlContent = htmlContent.replace("{{name}}", name);
    htmlContent = htmlContent.replace("{{date}}", date);

    // Create a Nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    // Send email with the HTML content and the generated PDF as an attachment
    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: email,
      subject: "🎉 Your Offer Letter from Unessa Foundation",
      html: htmlContent, // This is for the email body
      attachments: [
        {
          filename: "OfferLetter.pdf",
          path: pdfPath, // This is the path to the PDF file
        },
      ],
    });

    // Update user in the database
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
