import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTempMappedNotes1748800000000 implements MigrationInterface {
  name = 'CreateTempMappedNotes1748800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "temp_mapped_notes" (
        "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "agentcis_note_id" integer NOT NULL,
        "applyims_note_id" uuid NOT NULL,
        "migration_id" varchar(36),
        "created_at" timestamp NOT NULL DEFAULT now(),
        UNIQUE ("agentcis_note_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_temp_mapped_notes_applyims_note_id"
      ON "temp_mapped_notes" ("applyims_note_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_temp_mapped_notes_migration_id"
      ON "temp_mapped_notes" ("migration_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_temp_mapped_notes_migration_id"`);
    await queryRunner.query(`DROP INDEX "IDX_temp_mapped_notes_applyims_note_id"`);
    await queryRunner.query(`DROP TABLE "temp_mapped_notes"`);
  }
}
