class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error.type === 'entity.parse.failed') {
    error = new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  } else if (error.type === 'entity.too.large') {
    error = new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds the 16 KB limit.');
  } else if (error.status === 415) {
    error = new ApiError(415, 'UNSUPPORTED_ENCODING', 'Request body encoding is not supported.');
  }

  if (!(error instanceof ApiError)) {
    console.error('Unhandled request error:', error);
    error = new ApiError(500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
  }

  const body = { code: error.code, message: error.message };
  if (error.details) body.details = error.details;
  res.status(error.status).json({ error: body });
}

module.exports = { ApiError, errorHandler };
