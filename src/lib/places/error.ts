export class OpenDataPlacesError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OpenDataPlacesError";
  }
}
