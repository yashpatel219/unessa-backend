import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import axios from 'axios';

const router = express.Router();

// ✅ Helper function to send webhook with retry
const triggerWebhook = async (data, retries = 2) => {
  try {
    await axios.post(process.env.PABBLY_CONNECT_WEBHOOK_URL, data);
    console.log("Webhook triggered successfully");
  } catch (err) {
    console.error("Webhook error:", err.message);

    if (retries > 0) {
      const delay = (3 - retries) * 60000; // 1st retry = 1 min, 2nd retry = 2 min
      console.log(`Retrying webhook in ${delay / 60000} minute(s)...`);
      setTimeout(() => {
        triggerWebhook(data, retries - 1);
      }, delay);
    } else {
      console.error("❌ Webhook failed after all retries");
    }
  }
};

// Register (Save user)
router.post('/register', async (req, res) => {
  try {
    console.log('Registration request body:', req.body);
    const { name, email, number, avatar, username } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({ error: 'Email is required', field: 'email' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Name is required', field: 'name' });
    }

    // Clean and validate email format
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email format', field: 'email' });
    }

    // Generate username if not provided
    let finalUsername = username;
    if (!finalUsername) {
      const baseUsername = name.toLowerCase().replace(/\s+/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      finalUsername = `${baseUsername}${randomSuffix}`;
    }

    // Create new user with cleaned data
    const newUser = new User({
      name: name.trim(),
      email: cleanEmail,
      number: number?.trim(),
      avatar,
      username: finalUsername
    });

    await newUser.save();
    console.log("User registered successfully:", newUser.email);

    // ✅ Trigger webhook with retries (1 min, 2 min)
    triggerWebhook({
      name: newUser.name,
      number: newUser.number
    });

    const token = jwt.sign(
      { id: newUser._id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        username: newUser.username,
        avatar: newUser.avatar
      },
      token
    });
  } catch (err) {
    console.error("Registration error:", err);

    // Handle duplicate key errors
    if (err.code === 11000) {
      const field = err.message.includes('email') ? 'email' : 'username';
      return res.status(400).json({
        error: `${field} already exists`,
        field
      });
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
      const errors = {};
      Object.keys(err.errors).forEach(key => {
        errors[key] = err.errors[key].message;
      });
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    res.status(500).json({
      error: 'Registration failed',
      details: err.message
    });
  }
});

export default router;


