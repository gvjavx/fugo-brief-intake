import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../server/app.js';

// These cases are all rejected before the database is touched, so no Postgres is needed.

const validBrief = {
  name: 'Rina',
  email: 'rina@kopisenja.id',
  company: 'PT Kopi Senja',
  needs: 'Website company profile dengan katalog produk.',
  budget: 'Rp25-50 juta',
  timeline: '2099-01-31',
};

describe('POST /api/briefs validation', () => {
  it('rejects an invalid email', async () => {
    const res = await request(app).post('/api/briefs').send({ ...validBrief, email: 'rina@' });
    expect(res.status).toBe(400);
    expect(res.body.fields.email).toBeDefined();
  });

  it('rejects a timeline in the past', async () => {
    const res = await request(app).post('/api/briefs').send({ ...validBrief, timeline: '2020-01-01' });
    expect(res.status).toBe(400);
    expect(res.body.fields.timeline).toEqual(['Tanggal tidak boleh di masa lalu']);
  });

  it('rejects a budget outside the offered ranges', async () => {
    const res = await request(app).post('/api/briefs').send({ ...validBrief, budget: 'Rp1 miliar' });
    expect(res.status).toBe(400);
    expect(res.body.fields.budget).toBeDefined();
  });

  it('reports every missing required field', async () => {
    const res = await request(app).post('/api/briefs').send({});
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields).sort()).toEqual(
      ['budget', 'company', 'email', 'name', 'needs', 'timeline'],
    );
  });
});

describe('admin routes', () => {
  it('refuse requests without a session', async () => {
    expect((await request(app).get('/api/admin/briefs')).status).toBe(401);
    expect((await request(app).post('/api/admin/briefs/1/reprocess')).status).toBe(401);
  });

  it('refuse a forged session cookie', async () => {
    const res = await request(app).get('/api/admin/briefs').set('Cookie', 'fugo_session=not-a-jwt');
    expect(res.status).toBe(401);
  });

  it('login rejects a wrong password and accepts the right one', async () => {
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.local', password: 'nope' });
    expect(wrong.status).toBe(401);

    const ok = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.local', password: 'test-password' });
    expect(ok.status).toBe(200);
    const cookie = ok.headers['set-cookie'];
    expect(cookie[0]).toMatch(/fugo_session=.+HttpOnly/);

    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.body.email).toBe('admin@test.local');
  });
});
