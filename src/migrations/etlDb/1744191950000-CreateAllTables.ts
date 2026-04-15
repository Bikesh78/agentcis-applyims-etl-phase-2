import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAllTables1744191950000 implements MigrationInterface {
  name = 'CreateAllTables1744191950000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "migration_status_enum" AS ENUM ('pending', 'in_progress', 'paused', 'completed', 'failed')
    `);

    await queryRunner.query(`
      CREATE TABLE "migration_jobs" (
        "id" varchar(36) PRIMARY KEY,
        "status" "migration_status_enum" NOT NULL,
        "config" jsonb,
        "started_at" timestamp,
        "completed_at" timestamp,
        "error_message" text,
        "created_by" varchar(255),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "migration_checkpoints" (
        "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "migration_id" varchar(36) NOT NULL,
        "entity_type" varchar(50) NOT NULL,
        "total_count" integer,
        "processed_count" integer DEFAULT 0,
        "success_count" integer DEFAULT 0,
        "failed_count" integer DEFAULT 0,
        "last_processed_id" varchar(255),
        "started_at" timestamp,
        "completed_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        UNIQUE ("migration_id", "entity_type")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_migration_checkpoints_migration_id" ON "migration_checkpoints" ("migration_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "migration_errors" (
        "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "migration_id" varchar(36) NOT NULL,
        "entity_type" varchar(50) NOT NULL,
        "entity_id" varchar(255),
        "error_code" varchar(50),
        "error_message" text,
        "error_details" jsonb,
        "source_data" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_migration_errors_migration_id" ON "migration_errors" ("migration_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_migration_errors_entity_type" ON "migration_errors" ("entity_type")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_migration_errors_created_at" ON "migration_errors" ("created_at")
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
      CREATE TABLE "temp_mapped_applications" (
        "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "agentcis_application_id" integer NOT NULL,
        "applyims_application_id" varchar(36) NOT NULL,
        "agentcis_client_id" integer,
        "applyims_contact_id" varchar(36),
        "migration_id" varchar(36),
        "created_at" timestamp NOT NULL DEFAULT now(),
        UNIQUE ("agentcis_application_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_temp_mapped_applications_applyims_application_id" ON "temp_mapped_applications" ("applyims_application_id")
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
      CREATE TABLE "temp_mapped_contacts" (
        "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "agentcis_contact_id" integer NOT NULL,
        "applyims_contact_id" varchar(36) NOT NULL,
        "deal_id" varchar(36),
        "branch_id" varchar(36),
        "migration_id" varchar(36),
        "created_at" timestamp NOT NULL DEFAULT now(),
        UNIQUE ("agentcis_contact_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_temp_mapped_contacts_applyims_contact_id" ON "temp_mapped_contacts" ("applyims_contact_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_temp_mapped_contacts_migration_id" ON "temp_mapped_contacts" ("migration_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "temp_mapped_deals" (
        "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "agentcis_deal_id" integer,
        "applyims_deal_id" varchar(36),
        "deal_id" varchar(36) NOT NULL,
        "branch_id" varchar(36) NOT NULL,
        "service_id" integer,
        "deal_name" varchar(255),
        "migration_id" varchar(36),
        "created_at" timestamp NOT NULL DEFAULT now(),
        UNIQUE ("agentcis_deal_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_temp_mapped_deals_agentcis_deal_id" ON "temp_mapped_deals" ("agentcis_deal_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_temp_mapped_deals_applyims_deal_id" ON "temp_mapped_deals" ("applyims_deal_id")
    `);

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
      ALTER TABLE "migration_checkpoints" ADD CONSTRAINT "FK_migration_checkpoints_migration_id" 
      FOREIGN KEY ("migration_id") REFERENCES "migration_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "migration_errors" ADD CONSTRAINT "FK_migration_errors_migration_id" 
      FOREIGN KEY ("migration_id") REFERENCES "migration_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "migration_metrics" ADD CONSTRAINT "FK_migration_metrics_migration_id" 
      FOREIGN KEY ("migration_id") REFERENCES "migration_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "migration_metrics" DROP CONSTRAINT "FK_migration_metrics_migration_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "migration_errors" DROP CONSTRAINT "FK_migration_errors_migration_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "migration_checkpoints" DROP CONSTRAINT "FK_migration_checkpoints_migration_id"`
    );

    await queryRunner.query(`DROP TABLE "temp_mapped_users"`);
    await queryRunner.query(`DROP TABLE "temp_mapped_deals"`);
    await queryRunner.query(`DROP TABLE "temp_mapped_contacts"`);
    await queryRunner.query(`DROP TABLE "temp_mapped_branches"`);
    await queryRunner.query(`DROP TABLE "temp_mapped_applications"`);
    await queryRunner.query(`DROP TABLE "migration_metrics"`);
    await queryRunner.query(`DROP TABLE "migration_errors"`);
    await queryRunner.query(`DROP TABLE "migration_checkpoints"`);
    await queryRunner.query(`DROP TABLE "migration_jobs"`);
    await queryRunner.query(`DROP TYPE "migration_status_enum"`);
  }
}
