import express from 'express';
import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import User from '../models/User.js';

const router = express.Router();

// helper to convert UTC date to IST string dd-mm-yyyy
function formatDateToIST(date) {
  // IST is UTC+5:30
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffsetMs);
  const day = String(istDate.getDate()).padStart(2, '0');
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const year = istDate.getFullYear();
  return `${day}-${month}-${year}`;
}

// @route   GET /donations
// @desc    List donations, optionally filtered by refname (username)
router.get('/donations', async (req, res) => {
  try {
    const { username } = req.query;

    const filter = {};
    if (username) {
      filter.refName = username; // Ensure this matches the field name in your Payment model
    }

    const payments = await Payment.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const formattedPayments = payments.map(payment => ({
      ...payment,
      formattedDate: formatDateToIST(payment.createdAt)
    }));

    res.status(200).json(formattedPayments);
  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/store-payment', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      name,
      email,
      phone,
      amount,
      orderId,
      paymentId,
      upiId,
      refname
    } = req.body;

    // Basic validation
    if (!name || !email || !amount || !orderId || !paymentId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    // 1. Save the payment
    const newPayment = new Payment({
      name,
      email,
      phone,
      amount: numericAmount,
      orderId,
      paymentId,
      upiId,
      refname
    });

    await newPayment.save({ session });

    // 2. Update referred user's amount if refname exists
    if (refname) {
      const updatedUser = await User.findOneAndUpdate(
        { username: refname },
        { $inc: { amount: numericAmount } },
        { new: true, session }
      );

      if (!updatedUser) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ success: false, message: 'Referred user not found' });
      }
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ success: true, message: 'Payment stored and user updated' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error storing payment:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
