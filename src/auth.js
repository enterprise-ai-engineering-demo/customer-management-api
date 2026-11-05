const jwt = require('jsonwebtoken');
const { ApiError } = require('./errors');

function validateAuthConfig({
  secret,
  issuer = 'customer-management-demo',
  audience = 'customer-management-api',
} = {}) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) {
    throw new Error('JWT_SECRET must be set to a secret of at least 32 bytes.');
  }
  if (typeof issuer !== 'string' || !issuer.trim() ||
      typeof audience !== 'string' || !audience.trim()) {
    throw new Error('JWT_ISSUER and JWT_AUDIENCE must be non-empty strings.');
  }
  return { secret, issuer, audience };
}

function createAuthMiddleware(config) {
  const { secret, issuer, audience } = validateAuthConfig(config);

  return (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') || '');
    if (!match) {
      res.set('WWW-Authenticate', 'Bearer');
      return next(new ApiError(401, 'UNAUTHORIZED', 'A Bearer token is required.'));
    }

    try {
      req.auth = jwt.verify(match[1], secret, {
        algorithms: ['HS256'],
        issuer,
        audience,
      });
    } catch (error) {
      if (!(error instanceof jwt.JsonWebTokenError) &&
          !(error instanceof jwt.TokenExpiredError) &&
          !(error instanceof jwt.NotBeforeError)) {
        return next(error);
      }
      res.set('WWW-Authenticate', 'Bearer error="invalid_token"');
      return next(new ApiError(401, 'UNAUTHORIZED', 'The Bearer token is invalid or expired.'));
    }
    next();
  };
}

module.exports = { createAuthMiddleware, validateAuthConfig };
