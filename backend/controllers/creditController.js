
const User = require("../src/models/User");
const Transaction = require("../models/Transaction");
const mongoose = require("mongoose");

const isOwnAccount = (userId, req, res) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    res.status(400).json({ message: "A valid user ID is required" });
    return false;
  }

  if (String(userId) !== String(req.userId)) {
    res.status(403).json({ message: "You can only view your own credits" });
    return false;
  }

  return true;
};

// View a user's actual credit balance
exports.getBalance = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isOwnAccount(userId, req, res)) return;

    const user = await User.findById(userId).select("credits");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json({
      userId,
      balance: user.credits,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// View transaction history
exports.getTransactions = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isOwnAccount(userId, req, res)) return;

    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 });

    res.json({ count: transactions.length, transactions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
