export class ExistingDataError extends Error {
  constructor(
    private entity: string,
    private id: number
  ) {
    super(`${entity} ${id} has already been migrated in the previous phase`);
    this.name = 'ExistingDataError';
  }
}
