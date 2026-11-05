# Customer Management API

A lightweight Node.js + Express REST API for an enterprise multi-repository demo.
Customers are held in memory with two fictional sample records. Changes disappear
when the process restarts; each process has its own dataset. No database or external
services are required.

## Local setup

Requires Node.js 22.9+ and npm.

```bash
npm ci
cp .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Paste the generated value into `JWT_SECRET` in `.env`, then run:

```bash
npm start
```

The API listens on port **4000** by default. Configuration is read from `.env`
(existing environment variables take precedence):

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4000` | Listening port, 1-65535 |
| `JWT_SECRET` | None, required | Shared signing secret of at least 32 bytes |
| `JWT_ISSUER` | `customer-management-demo` | Expected JWT issuer |
| `JWT_AUDIENCE` | `customer-management-api` | Expected JWT audience |

Never commit `.env` or real tokens. Startup fails if configuration is invalid.

## Authentication

All `/api/customers` routes require `Authorization: Bearer <JWT>`. `/health`
is public. JWT verification is isolated in `src/auth.js`; it checks the signature,
HS256 algorithm, issuer, audience, and expiration/not-before claims when present.
The middleware exposes verified claims as `req.auth`.

Generate a demo token from the same configuration in a second terminal:

```bash
export TOKEN="$(npm run --silent token)"
```

The helper issues a one-hour token for `demo-user`. It is a local demo utility,
not a login endpoint or a production identity provider. Another demo service may
issue tokens with the configured shared secret, issuer, audience, and HS256.
Always issue expiring tokens. For a real identity provider, replace the verifier
in the auth module (for example with an appropriate JWKS verifier); never weaken
verification or expose the signing secret to clients.

## API

All successful responses use `{ "data": ... }`. All errors use
`{ "error": { "code": "...", "message": "...", "details": [...] } }`;
`details` is included only for field validation errors.

| Method | Path | Success | Description |
| --- | --- | --- | --- |
| GET | `/health` | 200 | `{ "data": { "status": "ok" } }` |
| GET | `/api/customers` | 200 | Customer array in `data` |
| GET | `/api/customers/:id` | 200 | Customer object in `data` |
| POST | `/api/customers` | 201 | Created customer in `data`, with `Location` header |

### Customer fields

| Field | Rules |
| --- | --- |
| `id` | Server-generated UUID; read-only |
| `name` | Required non-empty string, at most 100 characters after trimming |
| `email` | Required valid email string, at most 254 characters after trimming; normalized to lowercase and unique |
| `company` | Optional non-empty string, at most 200 characters after trimming |

Unknown fields are rejected. POST bodies must be JSON objects sent with
`Content-Type: application/json`, with a maximum body size of 16 KB.
There is no pagination, update, or delete endpoint in this demo.

### Sample requests

```bash
curl http://localhost:4000/health

curl http://localhost:4000/api/customers \
  -H "Authorization: Bearer $TOKEN"

curl http://localhost:4000/api/customers/11111111-1111-4111-8111-111111111111 \
  -H "Authorization: Bearer $TOKEN"

curl -i http://localhost:4000/api/customers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Taylor Smith","email":"taylor@example.com","company":"Demo Corp"}'
```

Example customer detail response:

```json
{
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Alex Morgan",
    "email": "alex.morgan@example.com",
    "company": "Northwind Demo"
  }
}
```

### Errors

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Missing/invalid customer fields or non-object body |
| 400 | `INVALID_JSON` | Malformed JSON or JSON primitive |
| 401 | `UNAUTHORIZED` | Missing, invalid, or expired token |
| 404 | `CUSTOMER_NOT_FOUND` | Customer does not exist |
| 404 | `NOT_FOUND` | Unknown route |
| 409 | `CUSTOMER_EXISTS` | Email already exists |
| 413 | `PAYLOAD_TOO_LARGE` | JSON body exceeds 16 KB |
| 415 | `UNSUPPORTED_ENCODING` | Unsupported request body encoding |
| 500 | `INTERNAL_ERROR` | Unexpected server error (logged server-side) |

Example validation error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Customer validation failed.",
    "details": [
      { "field": "name", "message": "Must be a non-empty string of at most 100 characters." }
    ]
  }
}
```

## Tests and structure

```bash
npm test
```

Tests use Node's built-in test runner and Supertest, with isolated in-memory data
and test-only signing configuration. No `.env` file or running server is needed.
They cover health, authentication, customer reads/creation, normalization,
duplicates, validation, malformed/oversized bodies, and missing resources.

`src/app.js` exports `createApp({ auth })` separately from the listener in
`src/server.js`. `src/customers.js` owns the data and validation,
`src/auth.js` owns authentication, and `src/errors.js` provides shared error handling.
