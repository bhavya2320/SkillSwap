const express = require("express");
const router = express.Router();
const { protect } = require("../src/middleware/authMiddleware");

const {
  getBalance,
  getTransactions,
} = require("../controllers/creditController");

router.use(protect);
router.get("/:userId/balance", getBalance);
router.get("/:userId/transactions", getTransactions);

module.exports = router;