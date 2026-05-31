import { BaseExtractor, ExtractorConfig } from './base.extractor.js';
import { DataSource } from 'typeorm';
import { OfficeVisits } from 'entities/agentcis/office-visits.entity.js';

export interface OfficeVisitActivityNote {
  authorName: string;
  createdAtFormatted: string;
  noteText: string | null;
  rawAttributes: string | null;
}

export interface OfficeVisitWithNotes extends OfficeVisits {
  createdByName: string;
  visitCreatedAtFormatted: string;
  activityNotes: OfficeVisitActivityNote[];
}

export class OfficeVisitExtractor extends BaseExtractor<OfficeVisitWithNotes> {
  constructor(dataSource: DataSource, config: ExtractorConfig) {
    super(dataSource, 'office-visits', config);
  }

  async extractBatch(
    lastProcessedId: number | null,
    limit: number
  ): Promise<OfficeVisitWithNotes[]> {
    const qb = this.dataSource
      .getRepository(OfficeVisits)
      .createQueryBuilder('officeVisits')
      .leftJoinAndSelect('officeVisits.officeVisitAssignees', 'officeVisitAssignees')
      .where('officeVisits.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('officeVisits.created_at <= :endDate', { endDate: this.config.endDate })
      .orderBy('officeVisits.id', 'ASC')
      .take(limit);

    if (lastProcessedId !== null && lastProcessedId !== undefined) {
      qb.andWhere('officeVisits.id > :lastProcessedId', { lastProcessedId });
    }

    const visits = await qb.getMany();

    if (visits.length === 0) {
      return [];
    }

    const visitIds = visits.map((v) => v.id);
    const userIds = [...new Set(visits.map((v) => v.userId))];

    const userRows: { id: number; full_name: string }[] = await this.dataSource.query(
      `SELECT id, CONCAT(first_name, ' ', last_name) AS full_name FROM users WHERE id IN (?)`,
      [userIds]
    );
    const userNameMap = new Map(userRows.map((r) => [r.id, r.full_name]));

    const visitTsRows: { id: number; createdAtFormatted: string }[] = await this.dataSource.query(
      `SELECT id, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAtFormatted
       FROM office_visits WHERE id IN (?)`,
      [visitIds]
    );
    const visitTsMap = new Map(visitTsRows.map((r) => [Number(r.id), r.createdAtFormatted]));

    const activityRows: {
      officeVisitId: number;
      authorName: string;
      createdAtFormatted: string;
      noteText: string | null;
      rawAttributes: string | null;
    }[] = await this.dataSource.query(
      `SELECT
        asub.subject_id AS officeVisitId,
        COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'Unknown User') AS authorName,
        DATE_FORMAT(a.created_at, '%Y-%m-%d %H:%i:%s') AS createdAtFormatted,
        JSON_UNQUOTE(JSON_EXTRACT(a.attributes, '$.message')) AS noteText,
        a.attributes AS rawAttributes
      FROM activity_subjects asub
      JOIN activities a ON a.id = asub.activity_id
      LEFT JOIN users u ON u.id = a.causer_id
      WHERE asub.subject_type = 'office-check-in'
        AND asub.subject_id IN (?)
      ORDER BY asub.subject_id ASC, a.created_at ASC`,
      [visitIds]
    );

    const activitiesByVisitId = new Map<number, OfficeVisitActivityNote[]>();
    for (const row of activityRows) {
      const id = Number(row.officeVisitId);
      if (!activitiesByVisitId.has(id)) {
        activitiesByVisitId.set(id, []);
      }
      activitiesByVisitId.get(id)!.push({
        authorName: row.authorName,
        createdAtFormatted: row.createdAtFormatted,
        noteText: row.noteText,
        rawAttributes:
          row.rawAttributes == null
            ? null
            : typeof row.rawAttributes === 'string'
              ? row.rawAttributes
              : JSON.stringify(row.rawAttributes),
      });
    }

    return visits.map((visit) => ({
      ...visit,
      createdByName: userNameMap.get(visit.userId) ?? 'Unknown',
      visitCreatedAtFormatted: visitTsMap.get(visit.id) ?? '',
      activityNotes: activitiesByVisitId.get(visit.id) ?? [],
    }));
  }

  async extractByIds(ids: number[]): Promise<OfficeVisitWithNotes[]> {
    const visits = await this.dataSource
      .getRepository(OfficeVisits)
      .createQueryBuilder('officeVisits')
      .leftJoinAndSelect('officeVisits.officeVisitAssignees', 'officeVisitAssignees')
      .where('officeVisits.id IN (:...ids)', { ids })
      .getMany();

    if (visits.length === 0) return [];

    const visitIds = visits.map((v) => v.id);
    const userIds = [...new Set(visits.map((v) => v.userId))];

    const userRows: { id: number; full_name: string }[] = await this.dataSource.query(
      `SELECT id, CONCAT(first_name, ' ', last_name) AS full_name FROM users WHERE id IN (?)`,
      [userIds]
    );
    const userNameMap = new Map(userRows.map((r) => [r.id, r.full_name]));

    const visitTsRows: { id: number; createdAtFormatted: string }[] = await this.dataSource.query(
      `SELECT id, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAtFormatted FROM office_visits WHERE id IN (?)`,
      [visitIds]
    );
    const visitTsMap = new Map(visitTsRows.map((r) => [Number(r.id), r.createdAtFormatted]));

    const activityRows: {
      officeVisitId: number;
      authorName: string;
      createdAtFormatted: string;
      noteText: string | null;
      rawAttributes: string | null;
    }[] = await this.dataSource.query(
      `SELECT
        asub.subject_id AS officeVisitId,
        COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'Unknown User') AS authorName,
        DATE_FORMAT(a.created_at, '%Y-%m-%d %H:%i:%s') AS createdAtFormatted,
        JSON_UNQUOTE(JSON_EXTRACT(a.attributes, '$.message')) AS noteText,
        a.attributes AS rawAttributes
      FROM activity_subjects asub
      JOIN activities a ON a.id = asub.activity_id
      LEFT JOIN users u ON u.id = a.causer_id
      WHERE asub.subject_type = 'office-check-in'
        AND asub.subject_id IN (?)
      ORDER BY asub.subject_id ASC, a.created_at ASC`,
      [visitIds]
    );

    const activitiesByVisitId = new Map<number, OfficeVisitActivityNote[]>();
    for (const row of activityRows) {
      const id = Number(row.officeVisitId);
      if (!activitiesByVisitId.has(id)) activitiesByVisitId.set(id, []);
      activitiesByVisitId.get(id)!.push({
        authorName: row.authorName,
        createdAtFormatted: row.createdAtFormatted,
        noteText: row.noteText,
        rawAttributes:
          row.rawAttributes == null
            ? null
            : typeof row.rawAttributes === 'string'
              ? row.rawAttributes
              : JSON.stringify(row.rawAttributes),
      });
    }

    return visits.map((visit) => ({
      ...visit,
      createdByName: userNameMap.get(visit.userId) ?? 'Unknown',
      visitCreatedAtFormatted: visitTsMap.get(visit.id) ?? '',
      activityNotes: activitiesByVisitId.get(visit.id) ?? [],
    }));
  }

  async getTotalCount(): Promise<number> {
    return await this.dataSource
      .getRepository(OfficeVisits)
      .createQueryBuilder('officeVisits')
      .where('officeVisits.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('officeVisits.created_at <= :endDate', { endDate: this.config.endDate })
      .getCount();
  }
}
