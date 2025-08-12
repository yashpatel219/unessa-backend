import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { chromium } from 'playwright-core';
import User from '../models/User.js';

// The require statement is used to get the default export from the package
const executablePath = require('@playwright/browser-chromium');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const generateAndSendOffer = async (req, res) => {
  let browser; // Playwright browser instance
  
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

    // 1. Prepare HTML Content
    const templatePath = path.join(__dirname, '../templates/offer.html');
    const offerContent = fs.readFileSync(templatePath, 'utf8');
    
    const processedHtml = offerContent
      .replace(/{{name}}/g, name)
      .replace(/{{date}}/g, date);

    // 2. Generate PDF using Playwright
    // Launch a headless Chromium browser instance
    browser = await chromium.launch({
      headless: true,
      executablePath: executablePath()
    });
    
    const page = await browser.newPage();

    // Set the HTML content directly on the page, so Playwright can render it
    await page.setContent(processedHtml, {
      waitUntil: 'networkidle'
    });

    // Generate the PDF as a buffer (in-memory) instead of saving to a file
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
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
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });

    // 4. Respond to the request
    res.status(200).json({
      success: true,
      message: 'Offer letter generated and sent successfully'
    });

  } catch (error) {
    console.error('Error in generateAndSendOffer:', error);
    
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
