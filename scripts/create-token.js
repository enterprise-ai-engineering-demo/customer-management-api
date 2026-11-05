const jwt = require('jsonwebtoken');
const { loadConfig } = require('../src/config');

const { auth } = loadConfig();
const token = jwt.sign({}, auth.secret, {
  algorithm: 'HS256',
  subject: 'demo-user',
  issuer: auth.issuer,
  audience: auth.audience,
  expiresIn: '1h',
});
console.log(token);
