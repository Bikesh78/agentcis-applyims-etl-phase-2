import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterTempMappedApplicationsAndContacts1777700000000 implements MigrationInterface {
  name = 'AlterTempMappedApplicationsAndContacts1777700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "temp_mapped_applications" ADD COLUMN "app_identifier" varchar(50)`
    );

    await queryRunner.query(`ALTER TABLE "temp_mapped_contacts" DROP COLUMN "deal_id"`);
    await queryRunner.query(`ALTER TABLE "temp_mapped_contacts" DROP COLUMN "branch_id"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "temp_mapped_contacts" ADD COLUMN "branch_id" varchar(36)`
    );
    await queryRunner.query(`ALTER TABLE "temp_mapped_contacts" ADD COLUMN "deal_id" varchar(36)`);

    await queryRunner.query(`ALTER TABLE "temp_mapped_applications" DROP COLUMN "app_identifier"`);
  }
}
