const express = require("express");
const router = express.Router();
const { protect } = require("../src/middleware/authMiddleware");

const {
  createSwap,
  getSwaps,
  updateSwapStatus,
  completeSwap,
} = require("../controllers/swapController");

router.use(protect);
router.post("/", createSwap);
router.get("/", getSwaps);
router.patch("/:id/status", updateSwapStatus);
router.patch("/:id/complete", completeSwap);

module.exports = router;