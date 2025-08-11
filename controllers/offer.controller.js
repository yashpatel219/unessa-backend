import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { chromium } from 'playwright'; // Import Playwright's Chromium browser
import User from '../models/User.js';
import { executablePath } from '@playwright/browser-chromium';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const executablePath = require('@playwright/browser-chromium').executablePath();
export const generateAndSendOffer = async (req, res) => {
  let pdfPath; // Declare outside of try block for access in cleanup
  let browser; // Playwright browser instance
  
  try {
    const { userId, email, name } = req.body;
    const browser = await playwright.chromium.launch({
      headless: true,
      // Use the executablePath option to point to the correct browser binary
      executablePath: executablePath()
    });
    // const page = await browser.newPage();
    // Validate required fields
    if (!userId || !email || !name) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const date = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // 1. Prepare HTML Content
    // Read and process the offer.html template
    const templatePath = path.join(__dirname, '../templates/offer.html');
    const offerContent = fs.readFileSync(templatePath, 'utf8');
    
    // Replace placeholders
    const processedHtml = offerContent
      .replace(/{{name}}/g, name)
      .replace(/{{date}}/g, date);

    // 2. Generate PDF using Playwright
    const offersDir = path.join(__dirname, '../public/offers');
    
    // Ensure the offers directory exists
    if (!fs.existsSync(offersDir)) {
      fs.mkdirSync(offersDir, { recursive: true });
    }
    
    pdfPath = path.join(offersDir, `offer-${userId}.pdf`);

    // Launch a headless Chromium browser instance
    browser = await chromium.launch();
    const page = await browser.newPage();

    // Set the HTML content directly on the page, so Playwright can render it
    await page.setContent(processedHtml, {
      waitUntil: 'networkidle' // Wait for the page and network to be idle
    });

    // Generate the PDF from the rendered page
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true, // Ensure background colors/images are included
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });

    // 3. Send email
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
      text: `Dear ${name}, \n\nPlease find your official offer letter attached. We are excited for you to join our team!\n\nBest regards,\nHR Team`,
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

    res.status(200).json({
      success: true,
      message: 'Offer letter generated and sent successfully'
    });

  } catch (error) {
    console.error('Error in generateAndSendOffer:', error);
    
    // Clean up the failed PDF file if it was created
    if (pdfPath && fs.existsSync(pdfPath)) {
      try {
        fs.unlinkSync(pdfPath);
      } catch (unlinkError) {
        console.error(`Failed to delete file: ${pdfPath}`, unlinkError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to generate and send offer letter',
      error: error.message
    });
  } finally {
    // Ensure the browser is closed, even if an error occurs
    if (browser) {
      await browser.close();
    }
  }
};
