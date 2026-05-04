import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTempMappedContactActivities1777500000000 implements MigrationInterface {
  name = 'AddTempMappedContactActivities1777500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "temp_mapped_contact_activities" (
        "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "agentcis_contact_activity_id" integer NOT NULL,
        "applyims_contact_activity_id" uuid NOT NULL,
        "migration_id" varchar(36),
        "created_at" timestamp NOT NULL DEFAULT now(),
        UNIQUE ("agentcis_contact_activity_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_temp_mapped_contact_activities_applyims_contact_activity_id" 
      ON "temp_mapped_contact_activities" ("applyims_contact_activity_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_temp_mapped_contact_activities_migration_id" 
      ON "temp_mapped_contact_activities" ("migration_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_temp_mapped_contact_activities_migration_id"`);
    await queryRunner.query(
      `DROP INDEX "IDX_temp_mapped_contact_activities_applyims_contact_activity_id"`
    );
    await queryRunner.query(`DROP TABLE "temp_mapped_contact_activities"`);
  }
}
