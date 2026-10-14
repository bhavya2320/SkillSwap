const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  swapId: { type: String, required: true }, // Matches Member 3's Swap format
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },
  text: { type: String, required: true, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);