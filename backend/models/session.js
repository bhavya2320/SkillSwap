const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  swapId: { type: String, required: true },
  requesterId: { type: String, required: true },
  receiverId: { type: String, required: true },
  date: { type: String, required: true }, // e.g. '2026-10-15'
  time: { type: String, required: true }, // e.g. '17:00'
  status: { type: String, enum: ['scheduled', 'completed', 'canceled'], default: 'scheduled' }
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);