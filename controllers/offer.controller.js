import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import User from '../models/User.js';
import handlebars from 'handlebars'; // For template processing

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

    // Load and process HTML template for PDF content
    const templatePath = path.join(__dirname, '../templates/offer.html');
    const htmlTemplate = fs.readFileSync(templatePath, 'utf8');
    
    // Compile template with Handlebars
    const template = handlebars.compile(htmlTemplate);
    const htmlContent = template({ name, date });

    // Convert HTML to PDF content (simplified approach)
    // Note: For complex HTML, consider using html-pdf or puppeteer instead
    const pdfContent = htmlContent
      .replace(/<[^>]*>/g, '') // Basic HTML stripping
      .replace(/\n\s*\n/g, '\n'); // Remove extra newlines

    // Add content to PDF
    doc.font('Helvetica')
       .fontSize(12)
       .text(pdfContent, {
         align: 'left',
         lineGap: 5,
         paragraphGap: 10
       });

    // Add signature line
    doc.moveDown(2);
    doc.text('Sincerely,', { continued: true })
       .text('\n\n_________________________\nHR Manager\nCompany Name');

    // Finalize PDF
    doc.end();

    // Wait for PDF generation to complete
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    // 2. Prepare email content using the same template
    const emailTemplatePath = path.join(__dirname, '../templates/email.html');
    const emailHtmlTemplate = fs.readFileSync(emailTemplatePath, 'utf8');
    const emailTemplate = handlebars.compile(emailHtmlTemplate);
    const emailHtmlContent = emailTemplate({ name, date });

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
      html: emailHtmlContent,
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
