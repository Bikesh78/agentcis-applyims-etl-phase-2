import { Logger } from 'utils/logger.js';

interface InstitutionEntry {
  agentcis_vendor_id: number;
  agentcis_vendor_branch_id: number;
  agentcis_product_id: number;
  agentcis_service_id: number;
  applyims_institution_id: string;
}

export class InstitutionResolver {
  private map = new Map<string, string>();
  private loadPromise: Promise<void> | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly jsonPath: string = '../../mapper/institutions.json'
  ) {}

  async resolve(
    vendorId: number,
    vendorBranchId: number,
    productId: number,
    serviceId: number
  ): Promise<string | null> {
    await this.load();
    return this.map.get(`${vendorId}|${vendorBranchId}|${productId}|${serviceId}`) ?? null;
  }

  private async load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const data = await import(this.jsonPath);
        const entries: InstitutionEntry[] = data.default || data;
        for (const entry of entries) {
          const key = `${entry.agentcis_vendor_id}|${entry.agentcis_vendor_branch_id}|${entry.agentcis_product_id}|${entry.agentcis_service_id}`;
          this.map.set(key, entry.applyims_institution_id);
        }
        this.logger.info(`InstitutionResolver: loaded ${entries.length} mappings`);
      } catch (err) {
        this.logger.error(`InstitutionResolver: failed to load "${this.jsonPath}": ${err}`);
      }
    })();

    return this.loadPromise;
  }
}
