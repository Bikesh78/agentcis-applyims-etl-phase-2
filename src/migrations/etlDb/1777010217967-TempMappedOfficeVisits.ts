import { MigrationInterface, QueryRunner } from 'typeorm';

export class TempMappedOfficeVisits1777010217967 implements MigrationInterface {
  name = 'TempMappedOfficeVisits1777010217967';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "temp_mapped_office_visits" (
                "id" BIGSERIAL NOT NULL,
                "agentcis_office_visit_id" integer NOT NULL,
                "applyims_office_visit_id" varchar(36) NOT NULL,
                "migration_id" varchar(36),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_agentcis_office_visit_id" UNIQUE ("agentcis_office_visit_id"),
                CONSTRAINT "PK_temp_mapped_office_visits" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_applyims_office_visit_id" 
            ON "temp_mapped_office_visits" ("applyims_office_visit_id")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_applyims_office_visit_id"`);

    await queryRunner.query(`DROP TABLE "temp_mapped_office_visits"`);
  }
}
