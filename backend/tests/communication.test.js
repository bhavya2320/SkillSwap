
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../src/app');
const User = require('../src/models/User');
const Swap = require('../models/Swap');
const Message = require('../models/message');
const Session = require('../models/session');
const Review = require('../models/review');

let mongoServer;
let requester;
let receiver;
let outsider;
let requesterToken;
let receiverToken;
let outsiderToken;
let acceptedSwap;

const makeToken = (user) =>
  jwt.sign(
    { userId: String(user._id) },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

const auth = (token) => ({
  Authorization: `Bearer ${token}`,
});

const createSwap = (overrides = {}) =>
  Swap.create({
    requesterId: String(requester._id),
    requesterName: requester.name,
    receiverId: String(receiver._id),
    receiverName: receiver.name,
    skillOffered: 'Python',
    skillWanted: 'Machine Learning',
    status: 'accepted',
    ...overrides,
  });

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

  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Swap.deleteMany({}),
    Message.deleteMany({}),
    Session.deleteMany({}),
    Review.deleteMany({}),
  ]);

  requester = await User.create({
    name: 'Requester User',
    email: 'requester@example.com',
    passwordHash: 'test-hash',
  });

  receiver = await User.create({
    name: 'Receiver User',
    email: 'receiver@example.com',
    passwordHash: 'test-hash',
  });

  outsider = await User.create({
    name: 'Outsider User',
    email: 'outsider@example.com',
    passwordHash: 'test-hash',
  });

  requesterToken = makeToken(requester);
  receiverToken = makeToken(receiver);
  outsiderToken = makeToken(outsider);

  acceptedSwap = await createSwap();
});

describe('Communication API authentication', () => {
  it('rejects unauthenticated message requests', async () => {
    const response = await request(app)
      .post('/api/messages')
      .send({});

    expect(response.status).toBe(401);
  });

  it('rejects unauthenticated session requests', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .send({});

    expect(response.status).toBe(401);
  });

  it('rejects unauthenticated review requests', async () => {
    const response = await request(app)
      .post('/api/reviews')
      .send({});

    expect(response.status).toBe(401);
  });
});

describe('Messages API', () => {
  it('sends and retrieves messages between swap participants', async () => {
    const sent = await request(app)
      .post('/api/messages')
      .set(auth(requesterToken))
      .send({
        swapId: String(acceptedSwap._id),
        receiverId: String(receiver._id),
        text: 'Hello, ready to learn?',
      });

    expect(sent.status).toBe(201);
    expect(sent.body.success).toBe(true);
    expect(sent.body.message.text).toBe('Hello, ready to learn?');

    const received = await request(app)
      .get(`/api/messages/${acceptedSwap._id}`)
      .set(auth(receiverToken));

    expect(received.status).toBe(200);
    expect(received.body.success).toBe(true);
    expect(received.body.messages).toHaveLength(1);
  });

  it('rejects messages from users outside the swap', async () => {
    const response = await request(app)
      .post('/api/messages')
      .set(auth(outsiderToken))
      .send({
        swapId: String(acceptedSwap._id),
        receiverId: String(receiver._id),
        text: 'Unauthorized message',
      });

    expect(response.status).toBe(403);
  });

  it('rejects empty message text', async () => {
    const response = await request(app)
      .post('/api/messages')
      .set(auth(requesterToken))
      .send({
        swapId: String(acceptedSwap._id),
        receiverId: String(receiver._id),
        text: '   ',
      });

    expect(response.status).toBe(400);
  });
});

describe('Sessions API', () => {
  it('schedules a session for an accepted swap', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .set(auth(requesterToken))
      .send({
        swapId: String(acceptedSwap._id),
        receiverId: String(receiver._id),
        date: '2026-10-20',
        time: '17:00',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.session.status).toBe('scheduled');
  });

  it('rejects an invalid calendar date', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .set(auth(requesterToken))
      .send({
        swapId: String(acceptedSwap._id),
        receiverId: String(receiver._id),
        date: '2026-02-30',
        time: '17:00',
      });

    expect(response.status).toBe(400);
  });

  it('prevents outsiders from completing a session', async () => {
    const session = await Session.create({
      swapId: String(acceptedSwap._id),
      requesterId: String(requester._id),
      receiverId: String(receiver._id),
      date: '2026-10-20',
      time: '17:00',
    });

    const response = await request(app)
      .put(`/api/sessions/${session._id}/complete`)
      .set(auth(outsiderToken));

    expect(response.status).toBe(403);

    const unchanged = await Session.findById(session._id);
    expect(unchanged.status).toBe('scheduled');
  });

  it('completes a scheduled session without transferring credits', async () => {
    const session = await Session.create({
      swapId: String(acceptedSwap._id),
      requesterId: String(requester._id),
      receiverId: String(receiver._id),
      date: '2026-10-20',
      time: '17:00',
    });

    const creditsBefore = await User.findById(requester._id);

    const response = await request(app)
      .put(`/api/sessions/${session._id}/complete`)
      .set(auth(requesterToken));

    expect(response.status).toBe(200);
    expect(response.body.session.status).toBe('completed');

    const creditsAfter = await User.findById(requester._id);
    expect(creditsAfter.credits).toBe(creditsBefore.credits);
  });
});

describe('Reviews API', () => {
  it('creates a review for a completed session', async () => {
    const session = await Session.create({
      swapId: String(acceptedSwap._id),
      requesterId: String(requester._id),
      receiverId: String(receiver._id),
      date: '2026-10-20',
      time: '17:00',
      status: 'completed',
    });

    const response = await request(app)
      .post('/api/reviews')
      .set(auth(requesterToken))
      .send({
        sessionId: String(session._id),
        rating: 5,
        comment: 'Great learning experience!',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.review.rating).toBe(5);
    expect(response.body.review.reviewerId).toBe(String(requester._id));
    expect(response.body.review.revieweeId).toBe(String(receiver._id));
  });

  it('rejects reviews for sessions that are not completed', async () => {
    const session = await Session.create({
      swapId: String(acceptedSwap._id),
      requesterId: String(requester._id),
      receiverId: String(receiver._id),
      date: '2026-10-20',
      time: '17:00',
      status: 'scheduled',
    });

    const response = await request(app)
      .post('/api/reviews')
      .set(auth(requesterToken))
      .send({
        sessionId: String(session._id),
        rating: 5,
      });

    expect(response.status).toBe(400);
  });

  it('rejects duplicate reviews from the same participant', async () => {
    const session = await Session.create({
      swapId: String(acceptedSwap._id),
      requesterId: String(requester._id),
      receiverId: String(receiver._id),
      date: '2026-10-20',
      time: '17:00',
      status: 'completed',
    });

    const reviewData = {
      sessionId: String(session._id),
      rating: 4,
      comment: 'Good session',
    };

    const first = await request(app)
      .post('/api/reviews')
      .set(auth(requesterToken))
      .send(reviewData);

    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/reviews')
      .set(auth(requesterToken))
      .send(reviewData);

    expect(second.status).toBe(409);
  });
});
