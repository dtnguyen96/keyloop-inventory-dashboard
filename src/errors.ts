/**
 * Typed error classes for the inventory dashboard API.
 * All thrown errors should be instances of AppError or its subclasses.
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    // Restore prototype chain (required when extending built-ins in TypeScript)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class VehicleNotFoundError extends AppError {
  constructor(id: string) {
    super('VEHICLE_NOT_FOUND', 404, `Vehicle with id '${id}' does not exist`);
    this.name = 'VehicleNotFoundError';
  }
}

export class VehicleNotAgingError extends AppError {
  constructor(id: string) {
    super(
      'VEHICLE_NOT_AGING',
      403,
      `Vehicle with id '${id}' is not aging and cannot have an action logged`,
    );
    this.name = 'VehicleNotAgingError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', 400, message);
    this.name = 'ValidationError';
  }
}

export class InternalError extends AppError {
  constructor(message = 'An unexpected error occurred') {
    super('INTERNAL_ERROR', 500, message);
    this.name = 'InternalError';
  }
}
