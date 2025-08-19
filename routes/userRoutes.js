import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import axios from 'axios';   // ✅ Added axios for webhook call

const router = express.Router();

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

    // ✅ Trigger Pabbly Webhook
    try {
      await axios.post(process.env.PABBLY_CONNECT_WEBHOOK_URL, {
        name: newUser.name,
        number: newUser.number
      });
      console.log("Webhook triggered successfully");
    } catch (webhookErr) {
      console.error("Webhook error:", webhookErr.message);
    }

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

// POST /api/users/check
router.post("/check", async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user) {
      const token = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
      res.json({ exists: true, user, token });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    console.error("Error checking user:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get('/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    console.log('Name:', user.name);
    console.log('Username:', user.username);
    console.log('ID:', user._id.toString());

    res.json({
      name: user.name,
      username: user.username,
      id: user._id,
      avatar : user.avatar,
    });
  } catch (err) {
    console.error('Fetch Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user details by email
router.get("/getUser/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ message: "Server error" });
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
      { email },
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
    const user = await User.findOne({ email: req.params.email });
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
      { email },
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

