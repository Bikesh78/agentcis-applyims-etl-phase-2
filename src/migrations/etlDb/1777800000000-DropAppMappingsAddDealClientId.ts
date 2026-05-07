import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropAppMappingsAddDealClientId1777800000000 implements MigrationInterface {
  name = 'DropAppMappingsAddDealClientId1777800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "temp_mapped_applications" DROP COLUMN "agentcis_client_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "temp_mapped_applications" DROP COLUMN "applyims_contact_id"`
    );

    await queryRunner.query(`ALTER TABLE "temp_mapped_deals" ADD COLUMN "client_id" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "temp_mapped_deals" DROP COLUMN "client_id"`);

    await queryRunner.query(
      `ALTER TABLE "temp_mapped_applications" ADD COLUMN "applyims_contact_id" varchar(36)`
    );
    await queryRunner.query(
      `ALTER TABLE "temp_mapped_applications" ADD COLUMN "agentcis_client_id" integer`
    );
  }
}
