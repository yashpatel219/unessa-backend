// server.js (updated)
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import bodyParser from 'body-parser';
import http from 'http';
import { Server as IOServer } from 'socket.io';

import userRoutes from './routes/userRoutes.js';
import webhookRoutes from './routes/webhook.js';
import paymentRoutes from './routes/paymentRoutes.js';
import offerRoutes from './routes/offer.route.js';

import Payment from './models/Payment.js';
import User from './models/User.js';

dotenv.config();

const app = express();

// ✅ Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ✅ CORS configuration (add frontend origins)
const allowedOrigins = [
  "https://volunteerdashboard-production.up.railway.app",
  "http://localhost:5173",
  "http://localhost:3000", // optional dev port if used
];

// Express CORS
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));

// Preflight
app.options("*", cors());

// Body parsers
app.use(express.json());
app.use(express.static("public"));
app.use("/public", express.static("public"));

// Webhook must use raw parser
app.use('/api/webhook', bodyParser.raw({ type: 'application/json' }));

// Routes (keep these)
app.use('/api/webhook', webhookRoutes);
app.use('/api/users', userRoutes);
app.use('/api', paymentRoutes);
app.use('/offer', offerRoutes);

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);

const io = new IOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Socket.IO connection logging
io.on('connection', (socket) => {
  console.log(`🟢 Socket connected: ${socket.id}`);

  socket.on('disconnect', (reason) => {
    console.log(`🔴 Socket disconnected: ${socket.id} — reason: ${reason}`);
  });
});

// Expose io if other modules need it (optional)
// export { io }; // uncomment if you want to import io in other route files

// ✅ Create Razorpay Order
app.post("/create-order", async (req, res) => {
  try {
    const { name, email, phone, amount, anonymous, address } = req.body;

    if (!amount) {
      return res.status(400).json({ error: "Amount is required" });
    }

    const total = amount * 100; // in paise

    const order = await razorpay.orders.create({
      amount: total,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: { name, email, phone, anonymous, address },
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
      name: anonymous ? "Anonymous Donor" : name,
    });

  } catch (err) {
    console.error("🔴 Create Order Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ✅ Verify Payment
app.post('/verify-payment', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment verification parameters' });
  }

  const generated_signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest('hex');

  if (generated_signature === razorpay_signature) {
    return res.json({ status: 'Payment verified successfully' });
  } else {
    return res.status(400).json({ error: 'Invalid signature' });
  }
});

// ✅ Save Payment & Update User Amount — now emits socket event
app.post('/save-payment', async (req, res) => {
  try {
    const {
      refName, name, email, phone, amount, anonymous, address,
      razorpay_order_id, razorpay_payment_id
    } = req.body;

    // 1. Save the payment
    const payment = new Payment({
      refName,
      name,
      email,
      phone,
      amount,
      anonymous,
      address,
      razorpay_order_id,
      razorpay_payment_id,
    });

    await payment.save();
    console.log('✅ Payment saved:', payment._id?.toString() || payment);

    // 2. Update user's amount based on refName (username)
    let updatedUser = null;
    if (refName) {
      updatedUser = await User.findOneAndUpdate(
        { username: refName },
        { $inc: { amount: amount } },
        { new: true }
      );

      if (!updatedUser) {
        console.warn(`⚠️ Referred user '${refName}' not found`);
      } else {
        console.log(`✅ Updated ${refName}'s amount:`, updatedUser.amount);
      }
    }

    // 3. Emit socket event to notify clients in real-time
    // Payload can include refName and amount; clients can decide to refresh or filter
    io.emit('paymentSuccess', { refName: refName || null, amount });
    console.log(`🔔 Emitted paymentSuccess event (refName=${refName}, amount=${amount})`);

    res.status(201).json({ success: true, message: "Payment saved successfully!" });

  } catch (err) {
    console.error("❌ Save Payment Error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ✅ DB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// ✅ Global Error Handler
app.use((err, req, res, next) => {
  console.error("🔥 Global Error Handler:", err.stack);
  res.status(500).json({ error: "Something went wrong" });
});

// ✅ Start HTTP server (used by socket.io)
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
