import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterTempMappedDealsApplicationId1777300000000 implements MigrationInterface {
  name = 'AlterTempMappedDealsApplicationId1777300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "temp_mapped_deals" DROP CONSTRAINT IF EXISTS "UQ_temp_mapped_deals_contact_application"
    `);

    await queryRunner.query(`
      ALTER TABLE "temp_mapped_deals" ALTER COLUMN "application_id" TYPE bigint USING application_id::bigint
    `);

    await queryRunner.query(`
      ALTER TABLE "temp_mapped_deals" ADD CONSTRAINT "UQ_temp_mapped_deals_contact_application" 
      UNIQUE ("contact_id", "application_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "temp_mapped_deals" DROP CONSTRAINT IF EXISTS "UQ_temp_mapped_deals_contact_application"
    `);

    await queryRunner.query(`
      ALTER TABLE "temp_mapped_deals" ALTER COLUMN "application_id" TYPE text
    `);
  }
}
