export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function badRequest(message: string, code = 'BAD_REQUEST') {
  return new HttpError(400, code, message);
}

export function forbidden(message: string) {
  return new HttpError(403, 'FORBIDDEN', message);
}

export function notFound(message: string) {
  return new HttpError(404, 'NOT_FOUND', message);
}

export function conflict(message: string, code = 'CONFLICT') {
  return new HttpError(409, code, message);
}
