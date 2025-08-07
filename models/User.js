// models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  number: String,
  avatar: String,
  username: { type: String, unique: true },
  amount: {
    type: Number,
    default: 0
  },
  quizPassed: { type: Boolean, default: false },
  offerLetterPath: { type: String, default: null },
  pdf: Buffer,
  generatedAt: { type: Date, default: Date.now },
  quizStatus: {
    type: String,
    enum: ["notAttempted", "passed", "failed"],
    default: "notAttempted",
  },
  hasSeenTour: { type: Boolean, default: true }

});

export default mongoose.model('User', userSchema);
