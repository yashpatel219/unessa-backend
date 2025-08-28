import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  number: String,
  avatar: String,
  username: { type: String, unique: true },
  amount: { type: Number, default: 0 },
  quizPassed: { type: Boolean, default: false },
  offerLetterPath: { type: String, default: null },
  generatedAt: { type: Date, default: Date.now },
  internshipStartDate: { type: Date, default: Date.now }, // ✅ Added field
  quizStatus: {
    type: String,
    enum: ["notAttempted", "passed", "failed"],
    default: "notAttempted",
  },
  hasSeenTour: { type: Boolean, default: false },
  role: {
    type: String,
    enum: ["Fundraiser_External", "Volunteer_Internal"],
    default: "Fundraiser_External",
  },
});

export default mongoose.model("User", userSchema);
