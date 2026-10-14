const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');
const Skill = require('../models/Skill');
const Swap = require('../models/Swap');
const Session = require('../models/session');
const Review = require('../models/review');
const Transaction = require('../models/Transaction');

let mongoServer;

beforeAll(async () => {
  process.env.JWT_SECRET = 'platform-test-secret';
  process.env.FRONTEND_ORIGIN = 'http://localhost:5500';
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongoServer.getUri();
  await require('../src/config/db')();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Skill.deleteMany({}),
    Swap.deleteMany({}),
    Session.deleteMany({}),
    Review.deleteMany({}),
    Transaction.deleteMany({})
  ]);
});

const makeUser = async (name, email, credits = 5) => User.create({
  name,
  email,
  passwordHash: 'test-password-hash',
  credits
});

const tokenFor = (user) => jwt.sign(
  { userId: String(user._id) },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

const authenticated = (method, path, user) => request(app)[method](path)
  .set('Authorization', `Bearer ${tokenFor(user)}`);

describe('authenticated platform APIs', () => {
  it('requires authentication and enforces skill ownership for edits', async () => {
    const owner = await makeUser('Skill Owner', 'owner@example.com');
    const other = await makeUser('Other Member', 'other@example.com');

    expect((await request(app).get('/api/skills')).status).toBe(401);

    const created = await authenticated('post', '/api/skills', owner)
      .send({
        userId: String(other._id),
        userName: other.name,
        name: 'JavaScript',
        type: 'teach'
      });

    expect(created.status).toBe(201);
    expect(created.body.skill.userId).toBe(String(owner._id));
    expect(created.body.skill.userName).toBe(owner.name);

    const forbiddenEdit = await authenticated('put', `/api/skills/${created.body.skill._id}`, other)
      .send({ name: 'Renamed' });
    expect(forbiddenEdit.status).toBe(404);

    const updated = await authenticated('put', `/api/skills/${created.body.skill._id}`, owner)
      .send({ name: 'Modern JavaScript', level: 'Advanced' });
    expect(updated.status).toBe(200);
    expect(updated.body.skill.name).toBe('Modern JavaScript');
    expect(updated.body.skill.level).toBe('Advanced');

    const forbiddenDelete = await authenticated('delete', `/api/skills/${created.body.skill._id}`, other);
    expect(forbiddenDelete.status).toBe(404);

    const deleted = await authenticated('delete', `/api/skills/${created.body.skill._id}`, owner);
    expect(deleted.status).toBe(200);
  });

  it('creates and lists swaps for the authenticated user and accepts only as receiver', async () => {
    const requester = await makeUser('Requester', 'requester@example.com');
    const receiver = await makeUser('Receiver', 'receiver@example.com');
    await Skill.create([
      { userId: String(requester._id), userName: requester.name, name: 'JavaScript', type: 'teach' },
      { userId: String(receiver._id), userName: receiver.name, name: 'Python', type: 'teach' }
    ]);

    const created = await authenticated('post', '/api/swaps', requester)
      .send({
        requesterId: String(receiver._id),
        requesterName: 'Forged identity',
        receiverId: String(receiver._id),
        receiverName: 'Forged receiver',
        skillOffered: 'JavaScript',
        skillWanted: 'Python'
      });

    expect(created.status).toBe(201);
    expect(created.body.swap.requesterId).toBe(String(requester._id));
    expect(created.body.swap.requesterName).toBe(requester.name);
    expect(created.body.swap.receiverName).toBe(receiver.name);
    expect(await Swap.findById(created.body.swap._id).then((swap) => swap.status)).toBe('pending');

    const duplicate = await authenticated('post', '/api/swaps', requester)
      .send({
        receiverId: String(receiver._id),
        skillOffered: 'javascript',
        skillWanted: 'python'
      });
    expect(duplicate.status).toBe(409);

    const requesterList = await authenticated('get', '/api/swaps?userId=another-user', requester);
    expect(requesterList.body.swaps).toHaveLength(1);

    const unauthorizedAccept = await authenticated('patch', `/api/swaps/${created.body.swap._id}/status`, requester)
      .send({ status: 'accepted', userId: String(receiver._id) });
    expect(unauthorizedAccept.status).toBe(404);

    const accepted = await authenticated('patch', `/api/swaps/${created.body.swap._id}/status`, receiver)
      .send({ status: 'accepted' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.swap.status).toBe('accepted');

    const refreshedRequesterList = await authenticated('get', '/api/swaps', requester);
    expect(refreshedRequesterList.body.swaps[0].status).toBe('accepted');
  });

  it('allows the recipient to reject a pending request once and reports the status to both users', async () => {
    const requester = await makeUser('Reject Requester', 'reject-requester@example.com');
    const receiver = await makeUser('Reject Receiver', 'reject-receiver@example.com');
    await Skill.create([
      { userId: String(requester._id), userName: requester.name, name: 'Watercolor', type: 'teach' },
      { userId: String(receiver._id), userName: receiver.name, name: 'Photography', type: 'teach' }
    ]);

    const created = await authenticated('post', '/api/swaps', requester)
      .send({
        receiverId: String(receiver._id),
        skillOffered: 'Watercolor',
        skillWanted: 'Photography'
      });
    expect(created.status).toBe(201);

    const rejected = await authenticated('patch', `/api/swaps/${created.body.swap._id}/status`, receiver)
      .send({ status: 'rejected' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.swap.status).toBe('rejected');

    const requesterList = await authenticated('get', '/api/swaps', requester);
    const receiverList = await authenticated('get', '/api/swaps', receiver);
    expect(requesterList.body.swaps[0].status).toBe('rejected');
    expect(receiverList.body.swaps[0].status).toBe('rejected');

    const repeatedReject = await authenticated('patch', `/api/swaps/${created.body.swap._id}/status`, receiver)
      .send({ status: 'rejected' });
    expect(repeatedReject.status).toBe(404);
  });

  it('restricts credit history to the authenticated account', async () => {
    const owner = await makeUser('Credit Owner', 'credits@example.com', 12);
    const other = await makeUser('Credit Other', 'credit-other@example.com');

    const balance = await authenticated('get', `/api/credits/${owner._id}/balance`, owner);
    expect(balance.status).toBe(200);
    expect(balance.body.balance).toBe(12);

    const privateBalance = await authenticated('get', `/api/credits/${owner._id}/balance`, other);
    expect(privateBalance.status).toBe(403);

    const transactions = await authenticated('get', `/api/credits/${owner._id}/transactions`, owner);
    expect(transactions.status).toBe(200);
    expect(transactions.body.transactions).toEqual([]);
  });

  it('transfers credits once per completed lesson and finishes both sides of a swap', async () => {
    const requester = await makeUser('Teacher One', 'teacher-one@example.com');
    const receiver = await makeUser('Teacher Two', 'teacher-two@example.com');
    const swap = await Swap.create({
      requesterId: String(requester._id),
      requesterName: requester.name,
      receiverId: String(receiver._id),
      receiverName: receiver.name,
      skillOffered: 'Design',
      skillWanted: 'Writing',
      status: 'accepted'
    });

    const requesterLesson = await authenticated('patch', `/api/swaps/${swap._id}/complete`, requester)
      .send({ lessonRole: 'requester', userId: String(receiver._id) });
    expect(requesterLesson.status).toBe(200);
    expect(requesterLesson.body.swap.requesterLessonStatus).toBe('completed');

    const duplicate = await authenticated('patch', `/api/swaps/${swap._id}/complete`, requester)
      .send({ lessonRole: 'requester' });
    expect(duplicate.status).toBe(409);

    const receiverLesson = await authenticated('patch', `/api/swaps/${swap._id}/complete`, receiver)
      .send({ lessonRole: 'receiver' });
    expect(receiverLesson.status).toBe(200);
    expect(receiverLesson.body.swap.status).toBe('completed');

    const refreshedRequester = await User.findById(requester._id);
    const refreshedReceiver = await User.findById(receiver._id);
    expect(refreshedRequester.credits).toBe(5);
    expect(refreshedReceiver.credits).toBe(5);
    expect(await Transaction.countDocuments({ swapId: String(swap._id) })).toBe(4);

    const balance = await authenticated('get', `/api/credits/${requester._id}/balance`, requester);
    const history = await authenticated('get', `/api/credits/${requester._id}/transactions`, requester);
    expect(balance.body.balance).toBe(5);
    expect(history.body.transactions).toHaveLength(2);
  });

  it('lists only participant sessions and reviews and hides sensitive public profile fields', async () => {
    const participant = await makeUser('Participant', 'participant@example.com');
    const other = await makeUser('Other', 'other-participant@example.com');
    const swap = await Swap.create({
      requesterId: String(participant._id),
      requesterName: participant.name,
      receiverId: String(other._id),
      receiverName: other.name,
      skillOffered: 'Design',
      skillWanted: 'Writing',
      status: 'accepted'
    });
    const session = await Session.create({
      swapId: String(swap._id),
      requesterId: String(participant._id),
      receiverId: String(other._id),
      date: '2026-10-15',
      time: '17:00',
      status: 'completed'
    });
    const review = await Review.create({
      sessionId: String(session._id),
      reviewerId: String(participant._id),
      revieweeId: String(other._id),
      rating: 5,
      comment: 'Helpful session'
    });

    const sessions = await authenticated('get', '/api/sessions', participant);
    expect(sessions.status).toBe(200);
    expect(sessions.body.sessions.map((item) => item._id)).toContain(String(session._id));

    const ownReviews = await authenticated('get', '/api/reviews', participant);
    expect(ownReviews.status).toBe(200);
    expect(ownReviews.body.reviews.map((item) => item._id)).toContain(String(review._id));

    const sessionReviews = await authenticated('get', `/api/reviews?sessionId=${session._id}`, other);
    expect(sessionReviews.status).toBe(200);
    expect(sessionReviews.body.reviews).toHaveLength(1);

    const publicProfile = await request(app).get(`/api/users/${participant._id}`);
    expect(publicProfile.status).toBe(200);
    expect(publicProfile.body.data.user.email).toBeUndefined();
    expect(publicProfile.body.data.user.credits).toBeUndefined();
    expect(publicProfile.body.data.user.passwordHash).toBeUndefined();
  });
});
