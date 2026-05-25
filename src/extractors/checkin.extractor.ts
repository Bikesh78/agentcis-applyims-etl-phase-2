import { DataSource } from 'typeorm';
import { BaseExtractor, ExtractorConfig } from './base.extractor.js';

export interface CheckinComment {
  authorName: string | null;
  commentTime: Date | null;
  comment: string;
}

export interface CheckinWithContext {
  id: number;
  uuid: string;
  attendeeEmail: string | null;
  attendeeName: string | null;
  hostEmail: string | null;
  officeName: string | null;
  visitCategory: string | null;
  visitReason: string | null;
  checkInTime: Date | null;
  attendedTime: Date | null;
  completedTime: Date | null;
  clientId: number | null;
  hostUserId: number | null;
  comments: CheckinComment[];
}

export class CheckinExtractor extends BaseExtractor<CheckinWithContext> {
  constructor(dataSource: DataSource, config: ExtractorConfig) {
    super(dataSource, 'checkins', config);
  }

  async extractBatch(lastProcessedId: number | null, limit: number): Promise<CheckinWithContext[]> {
    const params: (string | number | string[])[] = [];

    let cursorFilter = '';
    if (lastProcessedId !== null && lastProcessedId !== undefined) {
      cursorFilter = 'AND id > ?';
      params.push(lastProcessedId);
    }

    params.push(limit);

    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `
      WITH ranked AS (
        SELECT
          CAST(UNIX_TIMESTAMP(check_in_time) * 1000 AS UNSIGNED) AS id,
          uuid,
          attendee_email   AS attendeeEmail,
          attendee_name    AS attendeeName,
          host_email       AS hostEmail,
          office_name      AS officeName,
          visit_category   AS visitCategory,
          visit_reason     AS visitReason,
          check_in_time    AS checkInTime,
          attended_time    AS attendedTime,
          completed_time   AS completedTime,
          ROW_NUMBER() OVER (
            PARTITION BY uuid
            ORDER BY
              CASE WHEN host_email     IS NOT NULL THEN 0 ELSE 1 END,
              CASE WHEN completed_time IS NOT NULL THEN 0 ELSE 1 END,
              CASE WHEN attended_time  IS NOT NULL THEN 0 ELSE 1 END,
              check_in_time DESC
          ) AS rn
        FROM checkins
        WHERE old_id IS NULL
          AND check_in_time IS NOT NULL
      )
      SELECT *
      FROM ranked
      WHERE rn = 1
        ${cursorFilter}
      ORDER BY checkInTime ASC, uuid ASC
      LIMIT ?
      `,
      params
    );

    if (rows.length === 0) return [];

    const visits = rows.map((r) => ({
      id: Number(r['id']),
      uuid: String(r['uuid']),
      attendeeEmail: (r['attendeeEmail'] as string | null) ?? null,
      attendeeName: (r['attendeeName'] as string | null) ?? null,
      hostEmail: (r['hostEmail'] as string | null) ?? null,
      officeName: (r['officeName'] as string | null) ?? null,
      visitCategory: (r['visitCategory'] as string | null) ?? null,
      visitReason: (r['visitReason'] as string | null) ?? null,
      checkInTime: r['checkInTime'] ? new Date(r['checkInTime'] as string) : null,
      attendedTime: r['attendedTime'] ? new Date(r['attendedTime'] as string) : null,
      completedTime: r['completedTime'] ? new Date(r['completedTime'] as string) : null,
    }));

    const attendeeEmails = [
      ...new Set(visits.map((v) => v.attendeeEmail).filter((e): e is string => !!e)),
    ];
    const hostEmails = [...new Set(visits.map((v) => v.hostEmail).filter((e): e is string => !!e))];
    const checkinUuids = visits.map((v) => v.uuid);

    const clientIdByEmail = new Map<string, number>();
    if (attendeeEmails.length > 0) {
      const clientRows: { id: number | string; email: string }[] = await this.dataSource.query(
        `SELECT id, email FROM clients WHERE email IN (?)`,
        [attendeeEmails]
      );
      for (const r of clientRows) clientIdByEmail.set(r.email, Number(r.id));
    }

    const userIdByEmail = new Map<string, number>();
    if (hostEmails.length > 0) {
      const userRows: { id: number | string; email: string }[] = await this.dataSource.query(
        `SELECT id, email FROM users WHERE email IN (?)`,
        [hostEmails]
      );
      for (const r of userRows) userIdByEmail.set(r.email, Number(r.id));
    }

    const commentRows: {
      checkInUuid: string;
      commentByName: string | null;
      commentTime: string | null;
      comment: string;
    }[] = await this.dataSource.query(
      `
      SELECT
        check_in_uuid    AS checkInUuid,
        comment_by_name  AS commentByName,
        comment_time     AS commentTime,
        comment
      FROM checkin_comments
      WHERE check_in_uuid IN (?)
        AND comment IS NOT NULL
        AND comment <> ''
      ORDER BY check_in_uuid ASC, comment_time ASC
      `,
      [checkinUuids]
    );

    const commentsByUuid = new Map<string, CheckinComment[]>();
    for (const r of commentRows) {
      const list = commentsByUuid.get(r.checkInUuid) ?? [];
      list.push({
        authorName: r.commentByName ?? null,
        commentTime: r.commentTime ? new Date(r.commentTime) : null,
        comment: r.comment,
      });
      commentsByUuid.set(r.checkInUuid, list);
    }

    return visits.map((v) => ({
      ...v,
      clientId: v.attendeeEmail ? (clientIdByEmail.get(v.attendeeEmail) ?? null) : null,
      hostUserId: v.hostEmail ? (userIdByEmail.get(v.hostEmail) ?? null) : null,
      comments: commentsByUuid.get(v.uuid) ?? [],
    }));
  }

  async getTotalCount(): Promise<number> {
    const result = await this.dataSource.query(
      `SELECT COUNT(DISTINCT uuid) AS total FROM checkins WHERE old_id IS NULL AND check_in_time IS NOT NULL`
    );
    return Number(result[0]?.total ?? 0);
  }
}
