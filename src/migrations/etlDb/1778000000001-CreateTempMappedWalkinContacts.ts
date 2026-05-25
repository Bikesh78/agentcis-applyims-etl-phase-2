import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTempMappedWalkinContacts1778000000001 implements MigrationInterface {
  name = 'CreateTempMappedWalkinContacts1778000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "temp_mapped_walkin_contacts" (
                "id" BIGSERIAL NOT NULL,
                "email" varchar(255) NOT NULL,
                "applyims_contact_id" varchar(36) NOT NULL,
                "migration_id" varchar(36),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_walkin_email" UNIQUE ("email"),
                CONSTRAINT "PK_temp_mapped_walkin_contacts" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_temp_mapped_walkin_contacts_applyims_contact_id"
            ON "temp_mapped_walkin_contacts" ("applyims_contact_id")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_temp_mapped_walkin_contacts_migration_id"
            ON "temp_mapped_walkin_contacts" ("migration_id")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_temp_mapped_walkin_contacts_migration_id"`);
    await queryRunner.query(`DROP INDEX "IDX_temp_mapped_walkin_contacts_applyims_contact_id"`);
    await queryRunner.query(`DROP TABLE "temp_mapped_walkin_contacts"`);
  }
}
