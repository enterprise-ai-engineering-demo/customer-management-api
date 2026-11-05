const express = require('express');
const { createAuthMiddleware } = require('./auth');
const { createCustomerStore, validateCustomer } = require('./customers');
const { ApiError, errorHandler } = require('./errors');

function createApp({ auth } = {}) {
  const authenticate = createAuthMiddleware(auth);
  const customers = createCustomerStore();
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', (req, res) => {
    res.json({ data: { status: 'ok' } });
  });

  const router = express.Router();
  router.use(authenticate, express.json({ limit: '16kb' }));
  router.get('/', (req, res) => {
    res.json({ data: customers.list() });
  });
  router.get('/:id', (req, res, next) => {
    const customer = customers.find(req.params.id);
    if (!customer) {
      return next(new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found.'));
    }
    res.json({ data: customer });
  });
  router.post('/', validateCustomer, (req, res) => {
    const customer = customers.create(req.validatedCustomer);
    res.location(`/api/customers/${customer.id}`).status(201).json({ data: customer });
  });
  app.use('/api/customers', router);

  app.use((req, res, next) => {
    next(new ApiError(404, 'NOT_FOUND', 'Route not found.'));
  });
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
