import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApplyimsOfficeVisitIdToTempMappedCheckins1778200000000 implements MigrationInterface {
  name = 'AddApplyimsOfficeVisitIdToTempMappedCheckins1778200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "temp_mapped_checkins" ADD COLUMN IF NOT EXISTS "applyims_office_visit_id" varchar(36) NULL`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_temp_mapped_checkins_applyims_office_visit_id" ON "temp_mapped_checkins" ("applyims_office_visit_id")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_temp_mapped_checkins_applyims_office_visit_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "temp_mapped_checkins" DROP COLUMN IF EXISTS "applyims_office_visit_id"`
    );
  }
}
