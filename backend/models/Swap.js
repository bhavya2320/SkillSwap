const mongoose = require("mongoose");

const swapSchema = new mongoose.Schema(
  {
    requesterId: { type: String, required: true },
    requesterName: { type: String, required: true },
    receiverId: { type: String, required: true },
    receiverName: { type: String, required: true },
    skillOffered: { type: String, required: true, trim: true },
    skillWanted: { type: String, required: true, trim: true },
    requesterLessonStatus: { type: String, enum: ["pending", "completed"], default: "pending",},
    receiverLessonStatus: { type: String, enum: ["pending", "completed"], default: "pending",},

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "completed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Swap", swapSchema);