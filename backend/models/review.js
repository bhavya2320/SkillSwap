const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  reviewerId: { type: String, required: true },
  revieweeId: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);