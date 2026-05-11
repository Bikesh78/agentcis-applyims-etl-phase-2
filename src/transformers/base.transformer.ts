import { IdResolver } from './utils/id-resolver.js';

export abstract class BaseTransformer<Source, Target> {
  constructor(protected idResolver: IdResolver) {}

  async transform(source: Source): Promise<Target | null> {
    const id = crypto.randomUUID();
    const transformed = await this.transformImpl(source, id);
    if (transformed === null) {
      return null;
    }
    this.validate(transformed);
    return transformed;
  }

  protected abstract transformImpl(source: Source, id: string): Promise<Target | null>;
  protected abstract validate(target: Target): void;
}
