import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import axios from "axios";
import User from "../models/User.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const generateAndSendOffer = async (req, res) => {
  try {
    const { userId, email, name } = req.body;

     if (!userId || !name) {
      return res.status(400).json({ message: "Missing required fields: userId or name" });
    }

    // Fetch user from DB (to get email if not passed)
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const finalEmail = email || user.email;

    if (!finalEmail || !/\S+@\S+\.\S+/.test(finalEmail)) {
      return res.status(400).json({ message: "Invalid or missing email address" });
    }


    const date = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Load HTML template and replace placeholders
    const templatePath = path.join(__dirname, "../templates/offer.html");
    let html = fs.readFileSync(templatePath, "utf8");
    html = html.replace(/{{name}}/g, name).replace(/{{date}}/g, date);

   const pdfResponse = await axios.post(
      "https://api.html2pdf.app/v1/generate",
      {
        html,
        apiKey: "9bWLC9jTNMAG0aJcTXbGnDr5HSxqSpxjDfH2LbWhyJGAEcC08yPyygF3YSdjpQLF",
      },
      {
        responseType: "arraybuffer",
      }
    );

    const buffer = Buffer.from(pdfResponse.data); 

  


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
      to: findEmail,
      subject: "🎉 Your Offer Letter from Unessa Foundation",
      text: `Congratulations ${name}!\n\nPlease find your offer letter attached.\n\nRegards,\nUnessa Foundation`,
      attachments: [
        {
          filename: "OfferLetter.pdf",
          content: buffer,
        },
      ],
    });

    await User.findByIdAndUpdate(
      userId,
      {
        quizPassed: true,
        generatedAt: new Date(),
          pdf: buffer,
        offerLetterPath: null,
      },
      { new: true }
    );

    res.status(200).json({ message: "Offer letter sent and saved." });
  } catch (error) {
    console.error("Offer generation error:", error);
    res.status(500).json({ message: "Failed to send offer letter." });
  }
};

export const getOfferLetter = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user || !user.pdf) {
      return res.status(404).json({ message: "Offer letter not found" });
    }

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=OfferLetter.pdf",
    });

    res.send(user.pdf);
  } catch (error) {
    console.error("Error fetching offer letter:", error);
    res.status(500).json({ message: "Failed to retrieve offer letter" });
  }
};
