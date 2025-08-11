import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import User from '../models/User.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const generateAndSendOffer = async (req, res) => {
  let pdfPath;
  
  try {
    const { userId, email, name } = req.body;

    // Validate required fields
    if (!userId || !email || !name) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const date = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // 1. Generate PDF
    pdfPath = path.join(__dirname, `../public/offers/offer-${userId}.pdf`);
    
    // Ensure the offers directory exists
    const dir = path.join(__dirname, '../public/offers');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create PDF document
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Read and process ONLY the offer.html template
    const templatePath = path.join(__dirname, '../templates/offer.html');
    let offerContent = fs.readFileSync(templatePath, 'utf8');
    
    // Replace placeholders in offer template only
    offerContent = offerContent
      .replace(/{{name}}/g, name)
      .replace(/{{date}}/g, date);

    // Convert HTML to plain text for PDF
    const pdfContent = offerContent
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\n\s*\n/g, '\n') // Remove excessive newlines
      .trim();

    // Add content to PDF
    doc.font('Helvetica')
       .fontSize(12)
       .text(pdfContent, {
         align: 'left',
         lineGap: 5,
         paragraphGap: 10
       });

    // Finalize PDF
    doc.end();

    // Wait for PDF generation to complete
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    // 2. Prepare email content (using original email.html WITHOUT placeholder replacement)
    const emailTemplatePath = path.join(__dirname, '../templates/email.html');
    const emailHtmlContent = fs.readFileSync(emailTemplatePath, 'utf8');

    // 3. Send email with attachment
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"HR Team" <${process.env.MAIL_USER}>`,
      to: email,
      subject: `Your Offer Letter - ${name}`,
      html: emailHtmlContent, // Using original template without replacements
      attachments: [
        {
          filename: `Offer_Letter_${name.replace(/\s+/g, '_')}.pdf`,
          path: pdfPath,
          contentType: 'application/pdf'
        }
      ]
    });

    // 4. Update user record
    await User.findByIdAndUpdate(
      userId,
      {
        offerLetterSent: true,
        offerLetterPath: `/offers/offer-${userId}.pdf`,
        offerSentDate: new Date()
      },
      { new: true }
    );

    // 5. Send success response
    res.status(200).json({
      success: true,
      message: 'Offer letter generated and sent successfully'
    });

  } catch (error) {
    console.error('Error in generateAndSendOffer:', error);
    
    // Clean up failed PDF file if it exists
    if (pdfPath && fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to generate and send offer letter',
      error: error.message
    });
  }
};
