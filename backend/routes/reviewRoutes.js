const express = require('express');
const router = express.Router();
const { protect } = require('../src/middleware/authMiddleware');
const reviewController = require('../controllers/reviewController');

router.get('/', protect, reviewController.getReviews);
router.post('/', protect, reviewController.addReview);

module.exports = router;