import { v5 as uuidv5 } from 'uuid';
import { MIGRATION_NAMESPACE } from '../constants/uuid-namespace.js';
import { IdResolver } from './utils/id-resolver.js';

export abstract class BaseTransformer<Source, Target> {
  constructor(protected idResolver: IdResolver) {}

  async transform(source: Source): Promise<Target | null> {
    const id = uuidv5(this.getSourceId(source), MIGRATION_NAMESPACE);
    const transformed = await this.transformImpl(source, id);
    if (transformed === null) {
      return null;
    }
    this.validate(transformed);
    return transformed;
  }

  protected abstract getSourceId(source: Source): string;
  protected abstract transformImpl(source: Source, id: string): Promise<Target | null>;
  protected abstract validate(target: Target): void;
}
