/**
 * Zod validation middleware factory.
 * Usage: validate(schema) where schema validates req.body
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    req.validated = result.data;
    next();
  };
}

/**
 * Validate query parameters.
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return res.status(400).json({ error: 'Invalid query parameters', details: errors });
    }
    req.validatedQuery = result.data;
    next();
  };
}
