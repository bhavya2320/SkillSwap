const User = require('../models/User');
const { allowedProfileFields } = require('../validators/userValidators');

const sanitizeUser = (user) => {
  const userObj = user.toObject ? user.toObject() : { ...user };
  delete userObj.passwordHash;
  return userObj;
};

const getUserProfile = async (req, res, next) => {
  try {
    const isPublicProfile = Boolean(req.params.id);
    const user = await User.findById(req.params.id || req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
    }

    const safeUser = sanitizeUser(user);
    if (isPublicProfile) {
      delete safeUser.email;
      delete safeUser.credits;
      delete safeUser.isEmailVerified;
    }

    return res.status(200).json({
      success: true,
      data: {
        user: safeUser,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const updateUserProfile = async (req, res, next) => {
  try {
    const targetUserId = req.params.id || req.userId;

    if (String(targetUserId) !== String(req.userId)) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own profile',
      });
    }

    const updates = Object.fromEntries(
      allowedProfileFields
        .filter((field) => Object.prototype.hasOwnProperty.call(req.body, field))
        .map((field) => [field, req.body[field]])
    );

    const updatedUser = await User.findByIdAndUpdate(
      targetUserId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: sanitizeUser(updatedUser),
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getUserProfile, updateUserProfile };
