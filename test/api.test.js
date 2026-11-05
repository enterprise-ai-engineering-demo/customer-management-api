const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');

const auth = {
  secret: 'test-only-secret-with-at-least-32-bytes',
  issuer: 'customer-management-demo',
  audience: 'customer-management-api',
};
function token(options = {}, secret = auth.secret) {
  return jwt.sign({}, secret, {
    algorithm: 'HS256',
    issuer: auth.issuer,
    audience: auth.audience,
    subject: 'test-user',
    expiresIn: '1h',
    ...options,
  });
}
function client(app = createApp({ auth })) {
  return {
    get: (path) => request(app).get(path).auth(token(), { type: 'bearer' }),
    post: (path) => request(app).post(path).auth(token(), { type: 'bearer' }),
  };
}
function assertError(response, status, code) {
  assert.equal(response.status, status);
  assert.deepEqual(Object.keys(response.body), ['error']);
  assert.equal(response.body.error.code, code);
  assert.equal(typeof response.body.error.message, 'string');
}

test('health is public and uses the success envelope', async () => {
  const response = await request(createApp({ auth })).get('/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { data: { status: 'ok' } });
});

test('all customer endpoints require a Bearer token', async () => {
  const app = createApp({ auth });
  for (const [method, path] of [
    ['get', '/api/customers'],
    ['get', '/api/customers/unknown'],
    ['post', '/api/customers'],
  ]) {
    const response = await request(app)[method](path);
    assertError(response, 401, 'UNAUTHORIZED');
    assert.equal(response.headers['www-authenticate'], 'Bearer');
  }
});

test('rejects malformed, expired, wrong-signature, wrong-issuer and wrong-audience tokens', async () => {
  const app = createApp({ auth });
  for (const value of [
    'Basic abc',
    'Bearer garbage',
    `Bearer ${token({ expiresIn: -1 })}`,
    `Bearer ${token({}, 'another-test-only-secret-of-32-bytes')}`,
    `Bearer ${token({ issuer: 'other' })}`,
    `Bearer ${token({ audience: 'other' })}`,
    `Bearer ${token({ algorithm: 'HS384' })}`,
    `Bearer ${token({ notBefore: '1h' })}`,
  ]) {
    const response = await request(app).get('/api/customers').set('Authorization', value);
    assertError(response, 401, 'UNAUTHORIZED');
  }
});

test('lists samples and gets customer details', async () => {
  const api = client();
  const list = await api.get('/api/customers');
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 2);
  const response = await api.get(`/api/customers/${list.body.data[0].id}`);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { data: list.body.data[0] });
});

test('creates, normalizes and persists a customer within the app instance', async () => {
  const api = client();
  const response = await api.post('/api/customers').send({
    name: ' New Customer ',
    email: ' NEW@example.com ',
    company: ' Demo Inc ',
  });
  assert.equal(response.status, 201);
  const customer = response.body.data;
  assert.match(customer.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(customer, {
    id: customer.id, name: 'New Customer', email: 'new@example.com', company: 'Demo Inc',
  });
  assert.equal(response.headers.location, `/api/customers/${customer.id}`);
  const detail = await api.get(response.headers.location);
  assert.deepEqual(detail.body, response.body);
  const list = await api.get('/api/customers');
  assert.equal(list.body.data.length, 3);
  assert.deepEqual(list.body.data[2], customer);
  assert.equal((await client().get('/api/customers')).body.data.length, 2);
});

test('company is optional and duplicate emails are rejected case-insensitively', async () => {
  const api = client();
  const input = { name: 'Demo', email: 'demo@example.com' };
  assert.equal((await api.post('/api/customers').send(input)).status, 201);
  const duplicate = await api.post('/api/customers').send({ ...input, email: 'DEMO@example.com' });
  assertError(duplicate, 409, 'CUSTOMER_EXISTS');
});

test('validates required fields, types, lengths, email and unknown fields', async () => {
  const api = client();
  for (const body of [
    {}, [], null,
    { name: ' ', email: 'a@example.com' },
    { name: 123, email: 'a@example.com' },
    { name: 'A', email: 'invalid' },
    { name: 'A', email: 123 },
    { name: 'A'.repeat(101), email: 'a@example.com' },
    { name: 'A', email: `${'a'.repeat(250)}@example.com` },
    { name: 'A', email: 'a@example.com', company: '' },
    { name: 'A', email: 'a@example.com', company: null },
    { name: 'A', email: 'a@example.com', company: 'a'.repeat(201) },
    { name: 'A', email: 'a@example.com', id: 'client-id' },
  ]) {
    const response = await api.post('/api/customers').send(body);
    // JSON primitives are rejected by the JSON parser before field validation.
    assert.equal(response.status, 400);
    assert.ok(['VALIDATION_ERROR', 'INVALID_JSON'].includes(response.body.error.code));
  }
  const response = await api.post('/api/customers').send({});
  assert.ok(response.body.error.details.some((detail) => detail.field === 'name'));
  assert.equal((await api.get('/api/customers')).body.data.length, 2);
});

test('handles malformed JSON and oversized bodies consistently', async () => {
  const api = client();
  const malformed = await api.post('/api/customers').set('Content-Type', 'application/json').send('{');
  assertError(malformed, 400, 'INVALID_JSON');
  const oversized = await api.post('/api/customers').send({ name: 'a'.repeat(17000) });
  assertError(oversized, 413, 'PAYLOAD_TOO_LARGE');
});

test('returns consistent errors for missing customers and unknown routes', async () => {
  const api = client();
  assertError(await api.get('/api/customers/unknown'), 404, 'CUSTOMER_NOT_FOUND');
  assertError(await api.get('/unknown'), 404, 'NOT_FOUND');
});

test('fails fast without a sufficiently long authentication secret', () => {
  assert.throws(() => createApp(), /JWT_SECRET/);
  assert.throws(() => createApp({ auth: { secret: 'short' } }), /JWT_SECRET/);
});
