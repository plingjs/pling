export class GatewayError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "GatewayError";
    this.code = code;
    this.status = status;
  }
}

export function asGatewayError(error) {
  if (error instanceof GatewayError) return error;
  return new GatewayError("INTERNAL_ERROR", error instanceof Error ? error.message : String(error), 500);
}
