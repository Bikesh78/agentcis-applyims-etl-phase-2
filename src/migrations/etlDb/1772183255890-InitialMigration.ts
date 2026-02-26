import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1772183255890 implements MigrationInterface {
  name = 'InitialMigration1772183255890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "temp_mapped_users" ("id" BIGSERIAL NOT NULL, "agentcisUserId" integer NOT NULL, "applyimsUserId" character varying(36) NOT NULL, "migrationId" character varying(36), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_426c5f417c37a5e10b46f346490" UNIQUE ("agentcisUserId"), CONSTRAINT "PK_75c7889e73e2d9f7eca05ddd81c" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "temp_mapped_deals" ("id" BIGSERIAL NOT NULL, "dealId" character varying(36) NOT NULL, "branchId" character varying(36) NOT NULL, "serviceId" integer, "dealName" character varying(255), "migrationId" character varying(36), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_51a0f5cabd5a94c1898c0e68eb8" UNIQUE ("branchId", "serviceId"), CONSTRAINT "PK_cb74551e13e50b5d5a5cba1975b" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_68a040da635724e42a281fdb1b" ON "temp_mapped_deals" ("dealId") `
    );
    await queryRunner.query(
      `CREATE TABLE "temp_mapped_contacts" ("id" BIGSERIAL NOT NULL, "agentcisContactId" integer NOT NULL, "applyimsContactId" character varying(36) NOT NULL, "dealId" character varying(36), "branchId" character varying(36), "migrationId" character varying(36), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_0e8c60a3b206f7fe5e85cd7e799" UNIQUE ("agentcisContactId"), CONSTRAINT "PK_34fee4d99980bc56ccb4d8ce494" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2630aaae1645b9bfd210cfbd4f" ON "temp_mapped_contacts" ("applyimsContactId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a9acf5b4038d07fb0238ed429b" ON "temp_mapped_contacts" ("migrationId") `
    );
    await queryRunner.query(
      `CREATE TABLE "temp_mapped_branches" ("id" BIGSERIAL NOT NULL, "agentcisBranchId" integer NOT NULL, "branchId" character varying(36) NOT NULL, "migrationId" character varying(36), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_98e56b545c838ca09305f169a35" UNIQUE ("agentcisBranchId"), CONSTRAINT "PK_c2c0816062e1b6f5af0dfa45c71" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "temp_mapped_applications" ("id" BIGSERIAL NOT NULL, "agentcisApplicationId" integer NOT NULL, "applyimsApplicationId" character varying(36) NOT NULL, "migrationId" character varying(36), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_785ca964c9edb82ac065a2173e8" UNIQUE ("agentcisApplicationId"), CONSTRAINT "PK_977718eb098b2cd2512bb7ff5e7" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d17b29ffeb2e3ad7c3d27e469a" ON "temp_mapped_applications" ("applyimsApplicationId") `
    );
    await queryRunner.query(
      `CREATE TABLE "migration_checkpoints" ("id" BIGSERIAL NOT NULL, "migrationId" character varying(36) NOT NULL, "entityType" character varying(50) NOT NULL, "totalCount" integer, "processedCount" integer DEFAULT '0', "successCount" integer DEFAULT '0', "failedCount" integer DEFAULT '0', "lastProcessedId" character varying(255), "startedAt" TIMESTAMP, "completedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "migration_id" character varying(36), CONSTRAINT "UQ_8c5301eabc489d389ef95007542" UNIQUE ("migrationId", "entityType"), CONSTRAINT "PK_b967792f845db19678ff1a6a093" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "migration_errors" ("id" BIGSERIAL NOT NULL, "migrationId" character varying(36) NOT NULL, "entityType" character varying(50) NOT NULL, "entityId" character varying(255), "errorMessage" text, "errorDetails" jsonb, "sourceData" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "migration_id" character varying(36), CONSTRAINT "PK_19125d5a1926f3f7df7f30784d4" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d382d3d4deeffffc2f9e66af03" ON "migration_errors" ("migrationId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_893afe4d2bf78ddc8522329119" ON "migration_errors" ("entityType") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0e4438be0d21d582e7afb8a45a" ON "migration_errors" ("createdAt") `
    );
    await queryRunner.query(
      `CREATE TABLE "migration_metrics" ("id" BIGSERIAL NOT NULL, "migrationId" character varying(36) NOT NULL, "metricType" character varying(50), "metricValue" numeric(10,2), "recordedAt" TIMESTAMP NOT NULL DEFAULT now(), "migration_metrics" character varying(36), CONSTRAINT "PK_75382fdaac3ac95d09dc3f3d537" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f9138934f699f1201582b725bd" ON "migration_metrics" ("migrationId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8600b4817e3db6959b8a7ba480" ON "migration_metrics" ("metricType") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9c5e8a21293ef1fd9021e97acf" ON "migration_metrics" ("recordedAt") `
    );
    await queryRunner.query(
      `CREATE TYPE "public"."migration_jobs_status_enum" AS ENUM('pending', 'in_progress', 'paused', 'completed', 'failed')`
    );
    await queryRunner.query(
      `CREATE TABLE "migration_jobs" ("id" character varying(36) NOT NULL, "status" "public"."migration_jobs_status_enum" NOT NULL, "config" jsonb, "startedAt" TIMESTAMP, "completedAt" TIMESTAMP, "errorMessage" text, "createdBy" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9cfbbb4361ebff82b250de3c5dd" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "migration_checkpoints" ADD CONSTRAINT "FK_d1984035230b333ebc807270498" FOREIGN KEY ("migration_id") REFERENCES "migration_jobs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "migration_errors" ADD CONSTRAINT "FK_a007cbe2d46c19730b78d1fc052" FOREIGN KEY ("migration_id") REFERENCES "migration_jobs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "migration_metrics" ADD CONSTRAINT "FK_347f1ce3a01ca8fb09ca59ff5f5" FOREIGN KEY ("migration_metrics") REFERENCES "migration_jobs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "migration_metrics" DROP CONSTRAINT "FK_347f1ce3a01ca8fb09ca59ff5f5"`
    );
    await queryRunner.query(
      `ALTER TABLE "migration_errors" DROP CONSTRAINT "FK_a007cbe2d46c19730b78d1fc052"`
    );
    await queryRunner.query(
      `ALTER TABLE "migration_checkpoints" DROP CONSTRAINT "FK_d1984035230b333ebc807270498"`
    );
    await queryRunner.query(`DROP TABLE "migration_jobs"`);
    await queryRunner.query(`DROP TYPE "public"."migration_jobs_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9c5e8a21293ef1fd9021e97acf"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_8600b4817e3db6959b8a7ba480"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f9138934f699f1201582b725bd"`);
    await queryRunner.query(`DROP TABLE "migration_metrics"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0e4438be0d21d582e7afb8a45a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_893afe4d2bf78ddc8522329119"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d382d3d4deeffffc2f9e66af03"`);
    await queryRunner.query(`DROP TABLE "migration_errors"`);
    await queryRunner.query(`DROP TABLE "migration_checkpoints"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d17b29ffeb2e3ad7c3d27e469a"`);
    await queryRunner.query(`DROP TABLE "temp_mapped_applications"`);
    await queryRunner.query(`DROP TABLE "temp_mapped_branches"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a9acf5b4038d07fb0238ed429b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2630aaae1645b9bfd210cfbd4f"`);
    await queryRunner.query(`DROP TABLE "temp_mapped_contacts"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_68a040da635724e42a281fdb1b"`);
    await queryRunner.query(`DROP TABLE "temp_mapped_deals"`);
    await queryRunner.query(`DROP TABLE "temp_mapped_users"`);
  }
}
