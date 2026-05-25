import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTempMappedCheckins1778000000000 implements MigrationInterface {
  name = 'CreateTempMappedCheckins1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "temp_mapped_checkins" (
                "id" BIGSERIAL NOT NULL,
                "agentcis_checkin_uuid" varchar(36) NOT NULL,
                "applyims_office_visit_id" varchar(36) NOT NULL,
                "migration_id" varchar(36),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_agentcis_checkin_uuid" UNIQUE ("agentcis_checkin_uuid"),
                CONSTRAINT "PK_temp_mapped_checkins" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_temp_mapped_checkins_applyims_office_visit_id"
            ON "temp_mapped_checkins" ("applyims_office_visit_id")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_temp_mapped_checkins_migration_id"
            ON "temp_mapped_checkins" ("migration_id")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_temp_mapped_checkins_migration_id"`);
    await queryRunner.query(`DROP INDEX "IDX_temp_mapped_checkins_applyims_office_visit_id"`);
    await queryRunner.query(`DROP TABLE "temp_mapped_checkins"`);
  }
}
