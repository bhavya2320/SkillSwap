const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

let mongoServer;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '7d';
  process.env.FRONTEND_ORIGIN = 'http://localhost:3000';

  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();

  const connectDB = require('../src/config/db');
  await connectDB();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe('User profile API', () => {
  it('gets the authenticated user profile', async () => {
    const user = await User.create({
      name: 'Profile User',
      email: 'profile@example.com',
      passwordHash: await bcrypt.hash('StrongPass123!', 12),
      credits: 5,
    });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    const response = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user._id).toBe(String(user._id));
    expect(response.body.data.user.passwordHash).toBeUndefined();
  });

  it('updates profile fields without changing protected data', async () => {
    const user = await User.create({
      name: 'Update User',
      email: 'update@example.com',
      passwordHash: await bcrypt.hash('StrongPass123!', 12),
      credits: 5,
      bio: 'Old bio',
      teachingSkills: ['JavaScript'],
      learningSkills: ['Python'],
      availability: ['Monday 5 PM'],
    });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    const response = await request(app)
      .put('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Name',
        bio: 'New bio',
        teachingSkills: ['JavaScript', 'Node.js'],
        learningSkills: ['Python', 'React'],
        availability: ['Monday 5 PM', 'Thursday 6 PM'],
      });

    expect(response.status).toBe(200);
    expect(response.body.data.user.name).toBe('Updated Name');
    expect(response.body.data.user.bio).toBe('New bio');
    expect(response.body.data.user.credits).toBe(5);
    expect(response.body.data.user.passwordHash).toBeUndefined();
  });

  it('updates only the authenticated user through the id route and returns the saved document', async () => {
    const user = await User.create({
      name: 'Route User',
      email: 'route@example.com',
      passwordHash: await bcrypt.hash('StrongPass123!', 12),
      bio: 'Old bio',
      teachingSkills: ['JavaScript'],
      learningSkills: ['Python'],
      credits: 5,
      role: 'user',
    });
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    const response = await request(app)
      .put(`/api/users/${user._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        bio: 'Updated bio',
        teachingSkills: ['Node.js'],
        learningSkills: ['React'],
      });

    expect(response.status).toBe(200);
    expect(response.body.data.user.bio).toBe('Updated bio');
    expect(response.body.data.user.teachingSkills).toEqual(['Node.js']);
    expect(response.body.data.user.learningSkills).toEqual(['React']);

    const savedUser = await User.findById(user._id);
    expect(savedUser.bio).toBe('Updated bio');
    expect(savedUser.teachingSkills).toEqual(['Node.js']);
    expect(savedUser.learningSkills).toEqual(['React']);
    expect(savedUser.credits).toBe(5);
    expect(savedUser.role).toBe('user');
  });

  it('does not allow updating another user through the id route', async () => {
    const user = await User.create({
      name: 'Authenticated User',
      email: 'authenticated@example.com',
      passwordHash: await bcrypt.hash('StrongPass123!', 12),
    });
    const otherUser = await User.create({
      name: 'Other User',
      email: 'other@example.com',
      passwordHash: await bcrypt.hash('StrongPass123!', 12),
      bio: 'Original bio',
    });
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    const response = await request(app)
      .put(`/api/users/${otherUser._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'Changed bio' });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect((await User.findById(otherUser._id)).bio).toBe('Original bio');
  });

  it('rejects protected field updates', async () => {
    const user = await User.create({
      name: 'Protected User',
      email: 'protected@example.com',
      passwordHash: await bcrypt.hash('StrongPass123!', 12),
      credits: 5,
    });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    const response = await request(app)
      .put('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ credits: 10 });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});
