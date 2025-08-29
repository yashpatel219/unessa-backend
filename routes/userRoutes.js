import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import axios from 'axios';

const router = express.Router();

// Webhook trigger function
const triggerWebhook = async (data, retries = 2, attempt = 1) => {
  try {
    console.log(`📡 Sending webhook attempt ${attempt}...`);
    const res = await axios.post(process.env.PABBLY_CONNECT_WEBHOOK_URL, data, {
      headers: { "Content-Type": "application/json" }
    });
    console.log("✅ Webhook triggered successfully:", res.status);
  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Response data:", err.response.data);
    }
    if (retries > 0) {
      const delay = attempt * 60000;
      console.log(`🔄 Retrying webhook in ${delay / 60000} minute(s)...`);
      setTimeout(() => {
        triggerWebhook(data, retries - 1, attempt + 1);
      }, delay);
    } else {
      console.error("🚨 Webhook failed after all retries");
    }
  }
};

// Check if user exists - UPDATED ENDPOINT
router.post('/check-user', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    res.json({ exists: !!user });
    
  } catch (err) {
    console.error('Check user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Register user
router.post('/register', async (req, res) => {
  try {
    const { name, email, number, avatar, username } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required', field: 'email' });
    if (!name) return res.status(400).json({ error: 'Name is required', field: 'name' });

    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email format', field: 'email' });
    }

    let finalUsername = username;
    if (!finalUsername) {
      const baseUsername = name.toLowerCase().replace(/\s+/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      finalUsername = `${baseUsername}${randomSuffix}`;
    }

    const newUser = new User({
      name: name.trim(),
      email: cleanEmail,
      number: number?.trim(),
      avatar,
      username: finalUsername,
      role: "Fundraiser_External"
    });

    await newUser.save();
    console.log("User registered successfully:", newUser.email);

    triggerWebhook({
      name: newUser.name,
      email: newUser.email,
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
        avatar: newUser.avatar,
        role: newUser.role
      },
      token
    });

  } catch (err) {
    console.error("Registration error:", err);
    if (err.code === 11000) {
      const field = err.message.includes('email') ? 'email' : 'username';
      return res.status(400).json({ error: `${field} already exists`, field });
    }
    if (err.name === 'ValidationError') {
      const errors = {};
      Object.keys(err.errors).forEach(key => { errors[key] = err.errors[key].message; });
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    res.status(500).json({ error: 'Registration failed', details: err.message });
  }
});

// Get user by email - UPDATED ENDPOINT
router.get('/get-user/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email.toLowerCase() });
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      name: user.name,
      username: user.username,
      id: user._id,
      avatar: user.avatar,
      role: user.role || "Fundraiser_External"
    });
  } catch (err) {
    console.error('Fetch Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update Quiz Status
router.post("/quiz-status", async (req, res) => {
  try {
    const { email, status } = req.body;
    if (!["notAttempted", "passed", "failed"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { quizStatus: status },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ success: true, quizStatus: user.quizStatus });
  } catch (err) {
    console.error("Error updating quiz status:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get Quiz Status
router.get("/quiz-status/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ quizStatus: user.quizStatus });
  } catch (err) {
    console.error("Error fetching quiz status:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/mark-tour-seen", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { hasSeenTour: true },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
