import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken'; 
const router = express.Router();

// Register (Save user)
// Register (Save user)
// Add at the top of userRoutes.js

router.post('/register', async (req, res) => {
  try {
    const { name, email, number, avatar, username } = req.body;
    // :white_check_mark: Use provided username, else generate a new one
    let finalUsername = username;
    if (!finalUsername) {
      const baseUsername = name.toLowerCase().replace(/\s+/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      finalUsername = `${baseUsername}${randomSuffix}`;
    }
    const newUser = new User({ name, email, number, avatar, username: finalUsername });
    await newUser.save();
    console.log("User saved with username:", newUser.username);
    const token = jwt.sign(
      { id: newUser._id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.status(201).json({
      message: 'User saved successfully',
      username: newUser.username,
      token,
      user: newUser,
      token
    });
  } catch (err) {
    console.error("Error saving user:", err);
    res.status(500).json({ error: 'Failed to save user' });
  }
});



// POST /api/users/check
router.post("/check", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user) {
      // ✅ Generate JWT
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


router.get('/details/:email', async (req, res) => {
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
