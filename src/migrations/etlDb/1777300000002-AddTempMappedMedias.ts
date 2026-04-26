import { MigrationInterface, QueryRunner } from 'typeorm';

export class TempMappedMedias1777400000000 implements MigrationInterface {
  name = 'TempMappedMedias1777400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "temp_mapped_medias" (
        "id" BIGSERIAL NOT NULL,
        "agentcis_media_id" integer NOT NULL,
        "applyims_media_id" varchar(36) NOT NULL,
        "migration_id" varchar(36),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_agentcis_media_id" UNIQUE ("agentcis_media_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_applyims_media_id" 
      ON "temp_mapped_medias" ("applyims_media_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_applyims_media_id"`);
    await queryRunner.query(`DROP TABLE "temp_mapped_medias"`);
  }
}
