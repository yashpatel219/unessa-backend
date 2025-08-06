import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  refName: String,
  name: String,
  email: String,
  phone: String,
  amount: Number,
  anonymous: Boolean,
  address: String,
  razorpay_order_id: String,
  razorpay_payment_id: String,
  createdAt: { type: Date, default: Date.now },
});

// Virtual to format createdAt to dd-mm-yyyy in IST
paymentSchema.virtual('formattedDate').get(function () {
  const istTime = new Date(this.createdAt.getTime() + (5.5 * 60 * 60 * 1000)); // IST offset
  const day = String(istTime.getDate()).padStart(2, '0');
  const month = String(istTime.getMonth() + 1).padStart(2, '0');
  const year = istTime.getFullYear();
  return `${day}-${month}-${year}`;
});

// Ensure virtuals are included when using .toJSON() or .toObject()
paymentSchema.set('toJSON', { virtuals: true });
paymentSchema.set('toObject', { virtuals: true });

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
