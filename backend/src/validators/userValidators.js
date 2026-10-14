const { body } = require('express-validator');

const allowedProfileFields = [
  'name',
  'bio',
  'teachingSkills',
  'learningSkills',
  'availability',
  'profileImageUrl',
];

const updateUserValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),

  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio must be 500 characters or fewer'),

  body('teachingSkills')
    .optional()
    .isArray({ min: 0 })
    .withMessage('Teaching skills must be an array of strings'),

  body('learningSkills')
    .optional()
    .isArray({ min: 0 })
    .withMessage('Learning skills must be an array of strings'),

  body('availability')
    .optional()
    .isArray({ min: 0 })
    .withMessage('Availability must be an array of strings'),

  body('profileImageUrl')
    .optional({ checkFalsy: true })
    .trim()
    .isURL()
    .withMessage('Profile image URL must be a valid URL'),

  body().custom((value) => {
    const invalidKeys = Object.keys(value).filter((key) => !allowedProfileFields.includes(key));
    if (invalidKeys.length > 0) {
      throw new Error(`Protected or unsupported profile fields are not allowed: ${invalidKeys.join(', ')}`);
    }
    return true;
  }),
];

module.exports = { allowedProfileFields, updateUserValidation };
