import express from 'express';
import crypto from 'crypto';

const router = express.Router();
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

router.post('/', (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.body;

  if (!signature || !rawBody) {
    return res.status(400).send('Bad Request');
  }

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (expectedSignature === signature) {
    console.log('✅ Webhook verified');

    try {
      const event = JSON.parse(rawBody.toString());

      if (event.event === 'payment.captured') {
        const paymentData = event.payload.payment.entity;
        console.log('💰 Payment captured:', paymentData.id, paymentData.amount);
        // TODO: Update your database/order status here
      }

      res.status(200).json({ status: 'ok' });
    } catch (err) {
      console.error('❌ Failed to parse JSON:', err);
      res.status(400).send('Invalid JSON');
    }
  } else {
    console.warn('❌ Invalid signature');
    res.status(400).json({ status: 'invalid signature' });
  }
});

export default router;
