const express = require('express');
const { getUserProfile, updateUserProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { updateUserValidation } = require('../validators/userValidators');
const { param, validationResult } = require('express-validator');

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
    });
  }
  return next();
};

router.get('/', protect, getUserProfile);
router.get('/:id', getUserProfile);
router.put('/', protect, updateUserValidation, handleValidationErrors, updateUserProfile);
router.put(
  '/:id',
  protect,
  param('id').isMongoId().withMessage('Invalid user ID'),
  updateUserValidation,
  handleValidationErrors,
  updateUserProfile
);

module.exports = router;
