
const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: ["signup_bonus", "teaching_reward", "learning_cost"],
      required: true,
    },
    description: { type: String, required: true },
    swapId: { type: String, default: null },
    lessonRole: {
      type: String,
      enum: ["requester", "receiver"],
      default: null,
    },
  },
  { timestamps: true }
);

// A user can have only one transaction of each type
// for each lesson in a swap.
transactionSchema.index(
  { swapId: 1, lessonRole: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      swapId: { $type: "string" },
      lessonRole: { $type: "string" },
      type: { $in: ["teaching_reward", "learning_cost"] },
    },
  }
);

module.exports = mongoose.model("Transaction", transactionSchema);
