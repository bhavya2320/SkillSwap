const express = require('express');
const router = express.Router();
const { protect } = require('../src/middleware/authMiddleware');
const messageController = require('../controllers/messageController');

router.post('/', protect, messageController.sendMessage);
router.get('/:swapId', protect, messageController.getMessages);

module.exports = router;