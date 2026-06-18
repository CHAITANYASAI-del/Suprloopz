// Wraps an async route handler so thrown/rejected errors reach the error
// middleware instead of crashing the process.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
