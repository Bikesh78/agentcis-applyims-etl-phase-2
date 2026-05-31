import { DataSource } from 'typeorm';
import { BaseExtractor, ExtractorConfig } from './base.extractor.js';

export interface AgentcisNoteWithRelations {
  id: number;
  title: string | null;
  description: string;
  addedBy: number;
  notableId: number;
  notableType: string | null;
  namespace: string | null;
  createdAt: Date;
  updatedAt: Date;
  agentcisApplicationId: number | null;
}

export class NoteExtractor extends BaseExtractor<AgentcisNoteWithRelations> {
  constructor(dataSource: DataSource, config: ExtractorConfig) {
    super(dataSource, 'notes', config);
  }

  async extractBatch(
    lastProcessedId: number | null,
    limit: number
  ): Promise<AgentcisNoteWithRelations[]> {
    const params: (string | number | null)[] = [
      this.config.startDate.toISOString(),
      this.config.endDate.toISOString(),
    ];

    let idFilter = '';
    if (lastProcessedId !== null && lastProcessedId !== undefined) {
      idFilter = 'AND n.id > ?';
      params.push(lastProcessedId);
    }

    params.push(limit);

    const rows = await this.dataSource.query(
      `
      SELECT
        n.id,
        n.title,
        n.description,
        n.added_by        AS addedBy,
        n.notable_id      AS notableId,
        n.notable_type    AS notableType,
        n.namespace,
        n.created_at      AS createdAt,
        n.updated_at      AS updatedAt,
        CASE WHEN n.notable_type = 'application_stage'
          THEN ast.application_id
          ELSE NULL
        END               AS agentcisApplicationId
      FROM notes n
      LEFT JOIN application_stages ast
        ON n.notable_type = 'application_stage' AND n.notable_id = ast.id
      WHERE n.notable_type IN ('application_stage', 'client')
        AND n.created_at >= ?
        AND n.created_at <= ?
        ${idFilter}
      ORDER BY n.id ASC
      LIMIT ?
      `,
      params
    );

    return rows.map((row: Record<string, unknown>) => ({
      id: Number(row['id']),
      title: (row['title'] as string | null) ?? null,
      description: (row['description'] as string) ?? '',
      addedBy: Number(row['addedBy']),
      notableId: Number(row['notableId']),
      notableType: (row['notableType'] as string | null) ?? null,
      namespace: (row['namespace'] as string | null) ?? null,
      createdAt: new Date(row['createdAt'] as string),
      updatedAt: new Date(row['updatedAt'] as string),
      agentcisApplicationId:
        row['agentcisApplicationId'] != null ? Number(row['agentcisApplicationId']) : null,
    }));
  }

  async extractByIds(ids: number[]): Promise<AgentcisNoteWithRelations[]> {
    const rows = await this.dataSource.query(
      `
      SELECT
        n.id,
        n.title,
        n.description,
        n.added_by        AS addedBy,
        n.notable_id      AS notableId,
        n.notable_type    AS notableType,
        n.namespace,
        n.created_at      AS createdAt,
        n.updated_at      AS updatedAt,
        CASE WHEN n.notable_type = 'application_stage'
          THEN ast.application_id
          ELSE NULL
        END               AS agentcisApplicationId
      FROM notes n
      LEFT JOIN application_stages ast
        ON n.notable_type = 'application_stage' AND n.notable_id = ast.id
      WHERE n.id IN (?)
      ORDER BY n.id ASC
      `,
      [ids]
    );

    return rows.map((row: Record<string, unknown>) => ({
      id: Number(row['id']),
      title: (row['title'] as string | null) ?? null,
      description: (row['description'] as string) ?? '',
      addedBy: Number(row['addedBy']),
      notableId: Number(row['notableId']),
      notableType: (row['notableType'] as string | null) ?? null,
      namespace: (row['namespace'] as string | null) ?? null,
      createdAt: new Date(row['createdAt'] as string),
      updatedAt: new Date(row['updatedAt'] as string),
      agentcisApplicationId:
        row['agentcisApplicationId'] != null ? Number(row['agentcisApplicationId']) : null,
    }));
  }

  async getTotalCount(): Promise<number> {
    const result = await this.dataSource.query(
      `
      SELECT COUNT(*) AS total
      FROM notes
      WHERE notable_type IN ('application_stage', 'client')
        AND created_at >= ?
        AND created_at <= ?
      `,
      [this.config.startDate.toISOString(), this.config.endDate.toISOString()]
    );
    return Number(result[0]?.total ?? 0);
  }
}
