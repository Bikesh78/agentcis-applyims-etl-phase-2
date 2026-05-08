import { DataSource } from 'typeorm';
import { Logger } from 'utils/logger.js';
import {
  JsonFileStrategy,
  DatabaseStrategy,
  FallbackStrategy,
  ResolverStrategy,
} from './resolver-strategy.js';

type EntityType =
  | 'branches'
  | 'users'
  | 'contacts'
  | 'products'
  | 'workflows'
  | 'workflowStages'
  | 'workflowStageNames'
  | 'workflowStageLevels'
  | 'agents'
  | 'institutionBranches'
  | 'institutions'
  | 'applications'
  | 'appIdentifiers'
  | 'deals'
  | 'interestedServices';

const ENTITY_TYPES: EntityType[] = [
  'branches',
  'users',
  'contacts',
  'products',
  'workflows',
  'workflowStages',
  'workflowStageNames',
  'workflowStageLevels',
  'agents',
  'institutionBranches',
  'institutions',
  'applications',
  'appIdentifiers',
  'deals',
  'interestedServices',
];

export class IdResolver {
  private readonly strategies: Record<EntityType, ResolverStrategy>;

  constructor(
    strategies: Record<EntityType, ResolverStrategy>,
    private readonly logger: Logger
  ) {
    this.strategies = strategies;
  }

  private static createDefaultResolver(
    logger: Logger,
    overrides: Partial<Record<EntityType, ResolverStrategy>> = {}
  ): IdResolver {
    const strategies = Object.fromEntries(
      ENTITY_TYPES.map((type) => [
        type,
        overrides[type] ?? new JsonFileStrategy(`../../mapper/${type}.json`, logger),
      ])
    ) as Record<EntityType, ResolverStrategy>;

    return new IdResolver(strategies, logger);
  }

  static createPhaseResolver(dataSource: DataSource, logger: Logger): IdResolver {
    return this.createDefaultResolver(logger, {
      contacts: new FallbackStrategy([
        new JsonFileStrategy('../../mapper/contacts.json', logger),
        new DatabaseStrategy({
          dataSource,
          tableName: 'temp_mapped_contacts',
          inputColumn: 'agentcis_contact_id',
          outputColumn: 'applyims_contact_id',
          logger,
        }),
      ]),
      applications: new FallbackStrategy([
        new JsonFileStrategy('../../mapper/applications.json', logger),
        new DatabaseStrategy({
          dataSource,
          tableName: 'temp_mapped_applications',
          inputColumn: 'agentcis_application_id',
          outputColumn: 'applyims_application_id',
          logger,
        }),
      ]),
      appIdentifiers: new FallbackStrategy([
        new JsonFileStrategy('../../mapper/applications.json', logger, 'app_identifier'),
        new DatabaseStrategy({
          dataSource,
          tableName: 'temp_mapped_applications',
          inputColumn: 'agentcis_application_id',
          outputColumn: 'app_identifier',
          logger,
        }),
      ]),
      deals: new DatabaseStrategy({
        dataSource,
        tableName: 'temp_mapped_deals',
        inputColumn: 'application_id',
        outputColumn: 'deal_id',
        logger,
      }),
      workflowStageNames: new JsonFileStrategy(
        '../../mapper/workflowStages.json',
        logger,
        'service_stage_name'
      ),
      workflowStageLevels: new JsonFileStrategy(
        '../../mapper/workflowStages.json',
        logger,
        'level'
      ),
    });
  }

  private async resolve(type: EntityType, agentcisId: number): Promise<string | null> {
    const applyimsId = await this.strategies[type].resolve(agentcisId);
    if (!applyimsId) {
      if (type === 'deals') {
        this.logger.warn(`Deal Id for application ${agentcisId} not found in mapping`);
      } else if (type === 'workflowStageNames') {
        this.logger.warn(`Stage name for agentcis stage ${agentcisId} not found in mapping`);
      } else if (type === 'workflowStageLevels') {
        this.logger.warn(`Stage level for agentcis stage ${agentcisId} not found in mapping`);
      } else {
        this.logger.warn(`${type} Id ${agentcisId} not found in mapping`);
      }
    }
    return applyimsId;
  }

  async resolveBranchId(agentcisBranchId: number): Promise<string | null> {
    return this.resolve('branches', agentcisBranchId);
  }

  async resolveUserId(agentcisUserId: number | null | undefined): Promise<string | null> {
    if (agentcisUserId == null) return null;
    return this.resolve('users', agentcisUserId);
  }

  async resolveUserIds(agentcisUserIds: number[]): Promise<string[]> {
    const results = await Promise.all(agentcisUserIds.map((id) => this.resolve('users', id)));
    return results.filter((id): id is string => !!id);
  }

  async resolveContactId(agentcisContactId: number): Promise<string | null> {
    return this.resolve('contacts', agentcisContactId);
  }

  async resolveProductId(agentcisProductId: number): Promise<string | null> {
    return this.resolve('products', agentcisProductId);
  }

  async resolveWorkflowId(agentcisWorkflowId: number): Promise<string | null> {
    return this.resolve('workflows', agentcisWorkflowId);
  }

  async resolveWorkflowStagesId(agentcisStageId: number): Promise<string | null> {
    return this.resolve('workflowStages', agentcisStageId);
  }

  async resolveWorkflowStagesName(agentcisStageId: number): Promise<string | null> {
    return this.resolve('workflowStageNames', agentcisStageId);
  }

  async resolveWorkflowStagesLevel(agentcisStageId: number): Promise<string | null> {
    return this.resolve('workflowStageLevels', agentcisStageId);
  }

  async resolveAgentId(agentcisAgentId: number | undefined): Promise<string | null> {
    if (!agentcisAgentId) return null;
    return this.resolve('agents', agentcisAgentId);
  }

  async resolveInstitutionBranchesId(institutionBranchesId: number): Promise<string | null> {
    return this.resolve('institutionBranches', institutionBranchesId);
  }

  async resolveInstitutions(institutionId: number): Promise<string | null> {
    return this.resolve('institutions', institutionId);
  }

  async resolveApplicationId(agentcisApplicationId: number): Promise<string | null> {
    return this.resolve('applications', agentcisApplicationId);
  }

  async resolveAppIdentifier(agentcisApplicationId: number): Promise<string | null> {
    return this.resolve('appIdentifiers', agentcisApplicationId);
  }

  async resolveDealId(agentcisApplicationId: number): Promise<string | null> {
    return this.resolve('deals', agentcisApplicationId);
  }

  async resolveServiceId(agentcisServiceId: number): Promise<string | null> {
    return this.resolve('interestedServices', agentcisServiceId);
  }
}
