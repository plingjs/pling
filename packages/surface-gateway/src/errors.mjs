export class GatewayError extends Error {
  constructor(code, message, status = 400, options) {
    super(message, options);
    this.name = "GatewayError";
    this.code = code;
    this.status = status;
  }
}

export function asGatewayError(error) {
  if (error instanceof GatewayError) return error;
  return new GatewayError("INTERNAL_ERROR", "Internal gateway error.", 500, {
    cause: error,
  });
}
