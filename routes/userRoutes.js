import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import axios from 'axios'; // Import axios for making the webhook request
// The crypto import is no longer needed as we are not handling passwords.

const router = express.Router();

// A conceptual webhook URL. You should store this in your .env file.
const PABBLY_CONNECT_WEBHOOK_URL = process.env.PABBLY_CONNECT_WEBHOOK_URL;

// Register (Save user)
router.post('/register', async (req, res) => {
  try {
    // Add request body validation
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
      // The password field has been removed
    });

    await newUser.save();
    
    console.log("User registered successfully:", newUser.email);
    
    // ✅ Trigger the webhook after successful registration
    if (PABBLY_CONNECT_WEBHOOK_URL) {
      try {
        await axios.post(PABBLY_CONNECT_WEBHOOK_URL, {
          name: newUser.name, // Sending the name
          number: newUser.number, // Sending the number
          email: newUser.email,
          username: newUser.username,
        });
        console.log('✅ Webhook sent to Pabbly Connect.');
      } catch (webhookError) {
        console.error('❌ Failed to send webhook to Pabbly Connect:', webhookError.message);
      }
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


router.get('/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Console and send required fields
    console.log('Name:', user.name);
    console.log('Username:', user.username);
    console.log('ID:', user._id.toString());

    res.json({
      name: user.name,
      username: user.username,
      id: user._id
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
