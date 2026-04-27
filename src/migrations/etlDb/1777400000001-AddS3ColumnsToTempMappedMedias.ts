import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddS3ColumnsToTempMappedMedias1777400000001 implements MigrationInterface {
  name = 'AddS3ColumnsToTempMappedMedias1777400000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "temp_mapped_medias" 
      ADD COLUMN "s3_copied" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "temp_mapped_medias" 
      ADD COLUMN "s3_copy_error" varchar(500)
    `);

    await queryRunner.query(`
      ALTER TABLE "temp_mapped_medias" 
      ADD COLUMN "source_s3_key" varchar(500)
    `);

    await queryRunner.query(`
      ALTER TABLE "temp_mapped_medias" 
      ADD COLUMN "destination_s3_key" varchar(500)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_temp_mapped_medias_s3_copied" 
      ON "temp_mapped_medias" ("s3_copied")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_temp_mapped_medias_migration_id" 
      ON "temp_mapped_medias" ("migration_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_temp_mapped_medias_migration_id"`);
    await queryRunner.query(`DROP INDEX "IDX_temp_mapped_medias_s3_copied"`);
    await queryRunner.query(`ALTER TABLE "temp_mapped_medias" DROP COLUMN "destination_s3_key"`);
    await queryRunner.query(`ALTER TABLE "temp_mapped_medias" DROP COLUMN "source_s3_key"`);
    await queryRunner.query(`ALTER TABLE "temp_mapped_medias" DROP COLUMN "s3_copy_error"`);
    await queryRunner.query(`ALTER TABLE "temp_mapped_medias" DROP COLUMN "s3_copied"`);
  }
}
