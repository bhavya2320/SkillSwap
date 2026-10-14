
const mongoose = require('mongoose');
const Session = require('../models/session');
const Swap = require('../models/Swap');

const isParticipant = (swap, userId) =>
  [String(swap.requesterId), String(swap.receiverId)]
    .includes(String(userId));

exports.getSessions = async (req, res) => {
  try {
    const userId = String(req.userId);
    const sessions = await Session.find({
      $or: [{ requesterId: userId }, { receiverId: userId }],
    }).sort({ date: 1, time: 1 });

    return res.status(200).json({
      success: true,
      count: sessions.length,
      sessions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve sessions',
    });
  }
};

// Schedule a session for an accepted swap
exports.scheduleSession = async (req, res) => {
  try {
    const { swapId, receiverId, date, time } = req.body;
    const requesterId = String(req.userId);

    if (
      !swapId ||
      !mongoose.Types.ObjectId.isValid(swapId) ||
      !receiverId ||
      !date ||
      !time
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid swapId, receiverId, date, and time are required',
      });
    }

    // Require a real calendar date in YYYY-MM-DD format.

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const parsedDate = datePattern.test(date)
      ? new Date(`${date}T00:00:00.000Z`)
      : null;

    if (
      !parsedDate ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== date
    ) {
      return res.status(400).json({
        success: false,
        message: 'date must be a valid YYYY-MM-DD date',
      });
    }


    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      return res.status(400).json({
        success: false,
        message: 'time must use 24-hour HH:mm format',
      });
    }

    const swap = await Swap.findById(swapId);

    if (!swap) {
      return res.status(404).json({
        success: false,
        message: 'Swap not found',
      });
    }

    if (swap.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Only accepted swaps can have sessions scheduled',
      });
    }

    if (!isParticipant(swap, requesterId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this swap',
      });
    }

    const expectedReceiverId =
      String(swap.requesterId) === requesterId
        ? String(swap.receiverId)
        : String(swap.requesterId);

    if (String(receiverId) !== expectedReceiverId) {
      return res.status(400).json({
        success: false,
        message: 'receiverId must be the other swap participant',
      });
    }

    const session = await Session.create({
      swapId: String(swap._id),
      requesterId,
      receiverId: expectedReceiverId,
      date,
      time,
    });

    return res.status(201).json({ success: true, session });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to schedule session',
    });
  }
};

// Mark a session completed only when its swap participant is authorized.
exports.completeSession = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'A valid session ID is required',
      });
    }

    const session = await Session.findById(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    const swap = await Swap.findById(session.swapId);

    if (!swap) {
      return res.status(404).json({
        success: false,
        message: 'Associated swap not found',
      });
    }

    if (!isParticipant(swap, req.userId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this swap',
      });
    }

    if (session.status !== 'scheduled') {
      return res.status(409).json({
        success: false,
        message: 'Only scheduled sessions can be completed',
      });
    }

    session.status = 'completed';
    await session.save();

    // This does not transfer credits. The existing completeSwap endpoint
    // remains responsible for lesson completion and credit transfers.
    return res.status(200).json({ success: true, session });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to complete session',
    });
  }
};
