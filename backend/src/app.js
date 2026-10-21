
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const skillRoutes = require('../routes/skillRoutes');
const swapRoutes = require('../routes/swapRoutes');
const creditRoutes = require('../routes/creditRoutes');

const messageRoutes = require('../routes/messageRoutes');
const sessionRoutes = require('../routes/sessionRoutes');
const reviewRoutes = require('../routes/reviewRoutes');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

const {
  notFound,
  errorHandler
} = require('./middleware/errorMiddleware');

const app = express();

// Allowed frontend origins
const allowedOrigins = [
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://skillswap-frontend-9gl5p40h9-bhavya2320s-projects.vercel.app',
  process.env.FRONTEND_ORIGIN
].filter(Boolean);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      'img-src': ["'self'", 'data:', 'https:']
    }
  }
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.error('Blocked by CORS. Request origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.post('/api/auth/register', authLimiter);
app.post('/api/auth/login', authLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SkillSwap backend is running',
    database: {
      status: mongoose.connection.readyState === 1
        ? 'connected'
        : 'disconnected'
    }
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy'
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SkillSwap API is running!'
  });
});

// Authentication and user profiles
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Skills, swaps and credits
app.use('/api/skills', skillRoutes);
app.use('/api/swaps', swapRoutes);
app.use('/api/credits', creditRoutes);

// Messages, sessions and reviews
app.use('/api/messages', messageRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/reviews', reviewRoutes);

// Error handlers
app.use(notFound);
app.use(errorHandler);

module.exports = app;
