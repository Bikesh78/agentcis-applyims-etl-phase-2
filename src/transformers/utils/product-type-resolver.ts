import { Logger } from 'utils/logger.js';

interface ProductTypeEntry {
  productId: string;
  productType: string;
  productSubType: string;
}

export class ProductTypeResolver {
  private map = new Map<string, ProductTypeEntry>();
  private loadPromise: Promise<void> | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly jsonPath: string = '../../mapper/productTypes.json'
  ) {}

  async getProductType(productId: string): Promise<string | null> {
    await this.load();
    return this.map.get(productId)?.productType ?? null;
  }

  async getProductSubType(productId: string): Promise<string | null> {
    await this.load();
    return this.map.get(productId)?.productSubType ?? null;
  }

  private async load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const data = await import(this.jsonPath);
        const entries: ProductTypeEntry[] = data.default || data;
        for (const entry of entries) {
          this.map.set(entry.productId, entry);
        }
        this.logger.info(`ProductTypeResolver: loaded ${entries.length} product type mappings`);
      } catch (err) {
        this.logger.error(`ProductTypeResolver: failed to load "${this.jsonPath}": ${err}`);
      }
    })();

    return this.loadPromise;
  }
}
