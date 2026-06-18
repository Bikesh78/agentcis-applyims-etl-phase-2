import { Logger } from 'utils/logger.js';

interface CombinationEntry {
  agentcis_vendor_id: number;
  agentcis_vendor_branch_id: number;
  agentcis_product_id: number;
  agentcis_service_id: number;
  applyims_institution_id: string;
  applyims_institution_branch_id: string;
  applyims_product_id: string;
  applyims_workflow_id: string;
}

export interface ResolvedCombination {
  institutionId: string | null;
  institutionBranchId: string | null;
  productId: string | null;
  workflowId: string | null;
}

export class CombinationResolver {
  private map = new Map<string, ResolvedCombination>();
  private loadPromise: Promise<void> | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly jsonPath: string = '../../mapper/institutionPartnerProducts.json'
  ) {}

  async resolve(
    vendorId: number,
    vendorBranchId: number,
    productId: number,
    serviceId: number
  ): Promise<ResolvedCombination | null> {
    await this.load();
    return this.map.get(`${vendorId}|${vendorBranchId}|${productId}|${serviceId}`) ?? null;
  }

  private async load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const data = await import(this.jsonPath);
        const entries: CombinationEntry[] = data.default || data;
        for (const entry of entries) {
          const key = `${entry.agentcis_vendor_id}|${entry.agentcis_vendor_branch_id}|${entry.agentcis_product_id}|${entry.agentcis_service_id}`;
          this.map.set(key, {
            institutionId: entry.applyims_institution_id || null,
            institutionBranchId: entry.applyims_institution_branch_id || null,
            productId: entry.applyims_product_id || null,
            workflowId: entry.applyims_workflow_id || null,
          });
        }
        this.logger.info(`CombinationResolver: loaded ${entries.length} mappings`);
      } catch (err) {
        this.logger.error(`CombinationResolver: failed to load "${this.jsonPath}": ${err}`);
      }
    })();

    return this.loadPromise;
  }
}
