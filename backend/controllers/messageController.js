
const mongoose = require('mongoose');
const Message = require('../models/message');
const Swap = require('../models/Swap');

// Send a message between participants of an accepted or completed swap
exports.sendMessage = async (req, res) => {
  try {
    const { swapId, receiverId, text } = req.body;
    const senderId = String(req.userId);

    if (!swapId || !mongoose.Types.ObjectId.isValid(swapId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid swapId is required',
      });
    }

    if (!receiverId || !text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'receiverId and a non-empty message text are required',
      });
    }

    const swap = await Swap.findById(swapId);

    if (!swap) {
      return res.status(404).json({
        success: false,
        message: 'Swap not found',
      });
    }

    if (!['accepted', 'completed'].includes(swap.status)) {
      return res.status(400).json({
        success: false,
        message: 'Messages are allowed only for accepted or completed swaps',
      });
    }

    const requesterId = String(swap.requesterId);
    const swapReceiverId = String(swap.receiverId);

    if (![requesterId, swapReceiverId].includes(senderId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this swap',
      });
    }

    const expectedReceiverId =
      senderId === requesterId ? swapReceiverId : requesterId;

    if (String(receiverId) !== expectedReceiverId) {
      return res.status(400).json({
        success: false,
        message: 'receiverId must be the other swap participant',
      });
    }

    const message = await Message.create({
      swapId: String(swap._id),
      senderId,
      receiverId: expectedReceiverId,
      text: text.trim(),
    });

    return res.status(201).json({ success: true, message });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to send message',
    });
  }
};

// Get messages only if the authenticated user belongs to this swap
exports.getMessages = async (req, res) => {
  try {
    const { swapId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(swapId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid swapId is required',
      });
    }

    const swap = await Swap.findById(swapId);

    if (!swap) {
      return res.status(404).json({
        success: false,
        message: 'Swap not found',
      });
    }

    const userId = String(req.userId);
    const participants = [
      String(swap.requesterId),
      String(swap.receiverId),
    ];

    if (!participants.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this swap',
      });
    }

    const messages = await Message.find({
      swapId: String(swap._id),
    }).sort({ createdAt: 1 });

    return res.status(200).json({ success: true, messages });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve messages',
    });
  }
};
