import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import axios from 'axios';   // :white_check_mark: Added axios for webhook call
const router = express.Router();
// Register (Save user)
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
      const delay = (attempt) * 60000; // 1st retry = 1 min, 2nd retry = 2 min
      console.log(`🔄 Retrying webhook in ${delay / 60000} minute(s)...`);
      setTimeout(() => {
        triggerWebhook(data, retries - 1, attempt + 1);
      }, delay);
    } else {
      console.error("🚨 Webhook failed after all retries");
    }
  }
};
// Register (Save user)
// Register (Save user)
router.post('/register', async (req, res) => {
  try {
    console.log('Registration request body:', req.body);
    const { name, email, number, avatar, username, role } = req.body;

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

    // ✅ Default role is "Fundraiser_External"
    const finalRole = role || "Fundraiser_External";

    // Create new user
    const newUser = new User({
      name: name.trim(),
      email: cleanEmail,
      number: number?.trim(),
      avatar,
      username: finalUsername,
      role: finalRole,
        internshipStartDate: new Date(), 
    });

    await newUser.save();
    console.log("✅ User registered successfully:", newUser.email, "Role:", newUser.role);

    // ✅ Trigger Pabbly Webhook with retries
    triggerWebhook({
      name: newUser.name,
      email: newUser.email,
      number: newUser.number,
      role: newUser.role
    });

    const token = jwt.sign(
      { id: newUser._id, email: newUser.email, role: newUser.role },
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
    console.error("❌ Registration error:", err);

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
// Get user's internship start date
// Get user's internship start date
router.get("/start-date/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: "User not found" });

    // ✅ Use internshipStartDate or fallback to generatedAt
    const startDate = user.internshipStartDate || user.generatedAt || new Date();

    res.json({ startDate });
  } catch (err) {
    console.error("Error fetching start date:", err);
    res.status(500).json({ message: "Server error" });
  }
});



// POST /api/users/check
// POST /api/users/check
router.post("/check", async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user) {
      res.json({ exists: true, user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        role: user.role    // ✅ include role here
      }});
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    console.error("Error checking user:", err);
    res.status(500).json({ message: "Server error" });
  }
});

  // Get user details by email
router.get('/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      name: user.name,
      username: user.username,
      id: user._id,
      avatar: user.avatar,
      role: user.role   // ✅ add role
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
