import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueContactApplicationConstraint1746932376000 implements MigrationInterface {
  name = 'AddUniqueContactApplicationConstraint1746932376000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "temp_mapped_deals"
      ADD CONSTRAINT "UQ_temp_mapped_deals_contact_application" UNIQUE ("contact_id", "application_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "temp_mapped_deals"
      DROP CONSTRAINT "unique_contact_application"
    `);
  }
}
