import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUpdatedAtToTempMappedMedias1778100000000 implements MigrationInterface {
  name = 'AddUpdatedAtToTempMappedMedias1778100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "temp_mapped_medias" ADD COLUMN "updated_at" TIMESTAMP NOT NULL DEFAULT now()`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "temp_mapped_medias" DROP COLUMN "updated_at"`);
  }
}
