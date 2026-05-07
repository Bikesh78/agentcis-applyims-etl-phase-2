import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropUnusedTables1777600000000 implements MigrationInterface {
  name = 'DropUnusedTables1777600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "migration_metrics" DROP CONSTRAINT IF EXISTS "FK_migration_metrics_migration_id"`
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "migration_metrics"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "temp_mapped_branches"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "temp_mapped_users"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "temp_mapped_users" (
        "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "agentcis_user_id" integer NOT NULL,
        "applyims_user_id" varchar(36) NOT NULL,
        "migration_id" varchar(36),
        "created_at" timestamp NOT NULL DEFAULT now(),
        UNIQUE ("agentcis_user_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "temp_mapped_branches" (
        "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "agentcis_branch_id" integer NOT NULL,
        "branch_id" varchar(36) NOT NULL,
        "migration_id" varchar(36),
        "created_at" timestamp NOT NULL DEFAULT now(),
        UNIQUE ("agentcis_branch_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "migration_metrics" (
        "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "migration_id" varchar(36) NOT NULL,
        "metric_type" varchar(50),
        "metric_value" decimal(10,2),
        "recorded_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_migration_metrics_migration_id" ON "migration_metrics" ("migration_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_migration_metrics_metric_type" ON "migration_metrics" ("metric_type")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_migration_metrics_recorded_at" ON "migration_metrics" ("recorded_at")
    `);

    await queryRunner.query(`
      ALTER TABLE "migration_metrics" ADD CONSTRAINT "FK_migration_metrics_migration_id"
      FOREIGN KEY ("migration_id") REFERENCES "migration_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }
}
