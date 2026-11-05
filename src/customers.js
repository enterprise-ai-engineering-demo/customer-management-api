const { randomUUID } = require('node:crypto');
const { ApiError } = require('./errors');

const sampleCustomers = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Alex Morgan',
    email: 'alex.morgan@example.com',
    company: 'Northwind Demo',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Jordan Lee',
    email: 'jordan.lee@example.com',
    company: 'Contoso Demo',
  },
];

function createCustomerStore() {
  const customers = sampleCustomers.map((customer) => ({ ...customer }));
  return {
    list: () => customers,
    find: (id) => customers.find((customer) => customer.id === id),
    create(input) {
      if (customers.some((customer) => customer.email === input.email)) {
        throw new ApiError(409, 'CUSTOMER_EXISTS', 'A customer with this email already exists.');
      }
      const customer = { id: randomUUID(), ...input };
      customers.push(customer);
      return customer;
    },
  };
}

function validateCustomer(req, res, next) {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return next(new ApiError(400, 'VALIDATION_ERROR', 'A JSON object is required.'));
  }

  const details = [];
  for (const key of Object.keys(body)) {
    if (!['name', 'email', 'company'].includes(key)) {
      details.push({ field: key, message: 'Unknown field.' });
    }
  }
  for (const [field, max] of [['name', 100], ['email', 254], ['company', 200]]) {
    if (field === 'company' && body[field] === undefined) continue;
    if (typeof body[field] !== 'string' || !body[field].trim() ||
        body[field].trim().length > max) {
      details.push({ field, message: `Must be a non-empty string of at most ${max} characters.` });
    }
  }
  if (typeof body.email === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    details.push({ field: 'email', message: 'Must be a valid email address.' });
  }
  if (details.length) {
    return next(new ApiError(400, 'VALIDATION_ERROR', 'Customer validation failed.', details));
  }

  req.validatedCustomer = {
    name: body.name.trim(),
    email: body.email.trim().toLowerCase(),
    ...(body.company !== undefined ? { company: body.company.trim() } : {}),
  };
  next();
}

module.exports = { createCustomerStore, validateCustomer };
