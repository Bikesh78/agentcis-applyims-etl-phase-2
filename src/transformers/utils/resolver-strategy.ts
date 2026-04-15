import { DataSource } from 'typeorm';
import { Logger } from 'utils/logger.js';

interface Mapper {
  agentcis_id: number;
  applyims_id: string;
}

export interface ResolverStrategy<TIn = number, TOut = string> {
  resolve(input: TIn): Promise<TOut | null>;
}

export class JsonFileStrategy implements ResolverStrategy<number, string> {
  private map = new Map<number, string>();
  private loadPromise: Promise<void> | null = null;

  constructor(
    private readonly jsonPath: string,
    private readonly logger: Logger
  ) {}

  async resolve(agentcisId: number): Promise<string | null> {
    await this.load();
    return this.map.get(agentcisId) ?? null;
  }

  private async load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const data = await import(this.jsonPath);
        const mapper: Mapper[] = data.default || data;
        for (const item of mapper) {
          this.map.set(item.agentcis_id, item.applyims_id);
        }
      } catch (err) {
        this.logger.error(`JsonFileStrategy: failed to load "${this.jsonPath}": ${err}`);
      }
    })();

    return this.loadPromise;
  }
}

export interface DatabaseStrategyOptions {
  dataSource: DataSource;
  tableName: string;
  inputColumn: string;
  outputColumn: string;
  logger: Logger;
}

export class DatabaseStrategy<TIn = number, TOut = string> implements ResolverStrategy<TIn, TOut> {
  private readonly cache = new Map<TIn, TOut>();
  private readonly dataSource: DataSource;
  private readonly tableName: string;
  private readonly inputColumn: string;
  private readonly outputColumn: string;
  private readonly logger: Logger;

  constructor(options: DatabaseStrategyOptions) {
    this.dataSource = options.dataSource;
    this.tableName = options.tableName;
    this.inputColumn = options.inputColumn;
    this.outputColumn = options.outputColumn;
    this.logger = options.logger;
  }

  async resolve(id: TIn): Promise<TOut | null> {
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    try {
      const rows: Record<string, any>[] = await this.dataSource.query(
        `SELECT "${this.outputColumn}" FROM "${this.tableName}" WHERE "${this.inputColumn}" = $1 LIMIT 1`,
        [id]
      );

      const result = rows[0]?.[this.outputColumn] ?? null;
      if (result) {
        this.cache.set(id, result as TOut);
      }
      return (result as TOut) ?? null;
    } catch (err) {
      this.logger.error(`DatabaseStrategy: query failed for ${this.tableName} id=${id}: ${err}`);
      return null;
    }
  }
}

export class FallbackStrategy<TIn = number, TOut = string> implements ResolverStrategy<TIn, TOut> {
  constructor(private readonly strategies: ResolverStrategy<TIn, TOut>[]) {}

  async resolve(id: TIn): Promise<TOut | null> {
    for (const strategy of this.strategies) {
      const result = await strategy.resolve(id);
      if (result !== null) {
        return result;
      }
    }
    return null;
  }
}
