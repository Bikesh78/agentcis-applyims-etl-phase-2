import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTempMappedUsers1777900000000 implements MigrationInterface {
  name = 'AddTempMappedUsers1777900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "temp_mapped_users" (
        "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "agentcis_user_id" integer NOT NULL,
        "applyims_user_id" uuid NOT NULL,
        "migration_id" varchar(36),
        "created_at" timestamp NOT NULL DEFAULT now(),
        UNIQUE ("agentcis_user_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_temp_mapped_users_applyims_user_id"
      ON "temp_mapped_users" ("applyims_user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_temp_mapped_users_migration_id"
      ON "temp_mapped_users" ("migration_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_temp_mapped_users_migration_id"`);
    await queryRunner.query(`DROP INDEX "IDX_temp_mapped_users_applyims_user_id"`);
    await queryRunner.query(`DROP TABLE "temp_mapped_users"`);
  }
}
