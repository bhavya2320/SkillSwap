
const mongoose = require('mongoose');
const Review = require('../models/review');
const Session = require('../models/session');

exports.getReviews = async (req, res) => {
  try {
    const userId = String(req.userId);
    let filter;

    if (req.query.sessionId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.sessionId)) {
        return res.status(400).json({
          success: false,
          message: 'A valid sessionId is required',
        });
      }

      const session = await Session.findById(req.query.sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found',
        });
      }

      if (![String(session.requesterId), String(session.receiverId)].includes(userId)) {
        return res.status(403).json({
          success: false,
          message: 'You are not a participant in this session',
        });
      }

      filter = { sessionId: String(session._id) };
    } else {
      filter = { $or: [{ reviewerId: userId }, { revieweeId: userId }] };
    }

    const reviews = await Review.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve reviews',
    });
  }
};

exports.addReview = async (req, res) => {
  try {
    const { sessionId, rating, comment } = req.body;
    const reviewerId = String(req.userId);

    if (
      !sessionId ||
      !mongoose.Types.ObjectId.isValid(sessionId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'A valid sessionId is required',
      });
    }

    const numericRating = Number(rating);

    if (
      rating === undefined ||
      rating === null ||
      rating === '' ||
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be an integer between 1 and 5',
      });
    }

    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    if (session.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Only completed sessions can be reviewed',
      });
    }

    const requesterId = String(session.requesterId);
    const receiverId = String(session.receiverId);

    if (![requesterId, receiverId].includes(reviewerId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this session',
      });
    }

    const revieweeId =
      reviewerId === requesterId ? receiverId : requesterId;

    const existingReview = await Review.findOne({
      sessionId: String(session._id),
      reviewerId,
    });

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: 'You have already reviewed this session',
      });
    }

    const review = await Review.create({
      sessionId: String(session._id),
      reviewerId,
      revieweeId,
      rating: numericRating,
      comment:
        typeof comment === 'string' ? comment.trim() : '',
    });

    return res.status(201).json({
      success: true,
      review,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to submit review',
    });
  }
};
