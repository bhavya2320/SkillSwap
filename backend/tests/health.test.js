const request = require('supertest');
const app = require('../src/app');

describe('Health API', () => {
  it('reports that the backend is running and includes database status', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: 'SkillSwap backend is running',
      database: {
        status: expect.stringMatching(/^(connected|disconnected)$/),
      },
    });
    expect(response.headers['content-security-policy']).toContain("img-src 'self' data: https:");
  });
});
