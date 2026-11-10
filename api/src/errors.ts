/** Error with an HTTP status and a stable machine-readable code. Handled in app.ts. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
