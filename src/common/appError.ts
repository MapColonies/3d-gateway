import { StatusCodes } from 'http-status-codes';

export class AppError extends Error {
  public readonly name: string;
  public readonly status: StatusCodes;
  public readonly isOperational: boolean;

  public constructor(name: string, status: StatusCodes, description: string, isOperational: boolean) {
    super(description);

    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain

    this.name = name;
    this.status = status;
    this.isOperational = isOperational;

    Error.captureStackTrace(this);
  }
}
