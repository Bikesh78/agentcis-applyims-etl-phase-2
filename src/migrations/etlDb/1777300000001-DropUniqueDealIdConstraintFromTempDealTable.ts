import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropUniqueDealIdConstraintFromTempDealTable1777192857302 implements MigrationInterface {
  name = 'DropUniqueDealIdConstraintFromTempDealTable1777192857302';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "temp_mapped_deals" DROP CONSTRAINT IF EXISTS "UQ_temp_mapped_deals_deal_id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "temp_mapped_deals" ADD CONSTRAINT "UQ_temp_mapped_deals_deal_id" UNIQUE ("deal_id")
    `);
  }
}
