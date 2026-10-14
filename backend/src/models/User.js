const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    teachingSkills: {
      type: [String],
      default: [],
      validate: {
        validator: (skills) => skills.every((skill) => skill && skill.trim().length > 0),
        message: 'Each teaching skill must be a non-empty string',
      },
    },
    learningSkills: {
      type: [String],
      default: [],
      validate: {
        validator: (skills) => skills.every((skill) => skill && skill.trim().length > 0),
        message: 'Each learning skill must be a non-empty string',
      },
    },
    availability: {
      type: [String],
      default: [],
      validate: {
        validator: (slots) => slots.every((slot) => typeof slot === 'string' && slot.trim().length > 0),
        message: 'Availability entries must be non-empty strings',
      },
    },
    profileImageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    credits: {
      type: Number,
      default: 5,
      min: 0,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const User = mongoose.model('User', userSchema);

module.exports = User;
