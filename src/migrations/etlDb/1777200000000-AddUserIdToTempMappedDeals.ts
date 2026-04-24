import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserIdToTempMappedDeals1777200000000 implements MigrationInterface {
  name = 'AddUserIdToTempMappedDeals1777200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "temp_mapped_deals" ADD COLUMN "user_id" character varying(36)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "temp_mapped_deals" DROP COLUMN "user_id"`);
  }
}
