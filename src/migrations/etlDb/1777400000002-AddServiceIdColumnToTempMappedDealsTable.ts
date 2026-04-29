import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddServiceIdColumnToTempMappedDealsTable1777400000002 implements MigrationInterface {
  name = 'AddServiceIdColumnToTempMappedDealsTable1777400000002 ';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "temp_mapped_deals" 
      ADD COLUMN "service_id" varchar(36)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "temp_mapped_deals" DROP COLUMN "service_id"`);
  }
}
