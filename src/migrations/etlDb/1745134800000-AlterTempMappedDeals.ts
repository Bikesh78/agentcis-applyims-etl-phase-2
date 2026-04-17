import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterTempMappedDeals1745134800000 implements MigrationInterface {
  name = 'AlterTempMappedDeals1745134800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop existing indexes and constraint
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_temp_mapped_deals_agentcis_deal_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_temp_mapped_deals_applyims_deal_id"`);
    await queryRunner.query(`
      ALTER TABLE "temp_mapped_deals" DROP CONSTRAINT IF EXISTS "UQ_temp_mapped_deals_agentcis_deal_id"
    `);
    // Also drop the auto-generated unique constraint name from TypeORM
    await queryRunner.query(`
      ALTER TABLE "temp_mapped_deals" DROP CONSTRAINT IF EXISTS "UQ_8e1f6e3c0b7a4d5f9e2c1a3b5d7"
    `);

    // Drop old columns (keep branch_id — needed for deal creation)
    await queryRunner.query(
      `ALTER TABLE "temp_mapped_deals" DROP COLUMN IF EXISTS "agentcis_deal_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "temp_mapped_deals" DROP COLUMN IF EXISTS "applyims_deal_id"`
    );
    await queryRunner.query(`ALTER TABLE "temp_mapped_deals" DROP COLUMN IF EXISTS "service_id"`);

    // Add new columns
    await queryRunner.query(`ALTER TABLE "temp_mapped_deals" ADD "contact_id" varchar(36)`);
    await queryRunner.query(`ALTER TABLE "temp_mapped_deals" ADD "application_id" text`);
    await queryRunner.query(`ALTER TABLE "temp_mapped_deals" ADD "minimum_date" timestamp`);
    await queryRunner.query(`ALTER TABLE "temp_mapped_deals" ADD "max_date" timestamp`);

    // Make branch_id nullable (it was NOT NULL before)
    await queryRunner.query(
      `ALTER TABLE "temp_mapped_deals" ALTER COLUMN "branch_id" DROP NOT NULL`
    );

    // Add unique constraint on deal_id
    await queryRunner.query(`
      ALTER TABLE "temp_mapped_deals" ADD CONSTRAINT "UQ_temp_mapped_deals_deal_id" UNIQUE ("deal_id")
    `);

    // Add index on deal_id
    await queryRunner.query(`
      CREATE INDEX "IDX_temp_mapped_deals_deal_id" ON "temp_mapped_deals" ("deal_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop new indexes and constraint
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_temp_mapped_deals_deal_id"`);
    await queryRunner.query(`
      ALTER TABLE "temp_mapped_deals" DROP CONSTRAINT IF EXISTS "UQ_temp_mapped_deals_deal_id"
    `);

    // Drop new columns
    await queryRunner.query(`ALTER TABLE "temp_mapped_deals" DROP COLUMN IF EXISTS "max_date"`);
    await queryRunner.query(`ALTER TABLE "temp_mapped_deals" DROP COLUMN IF EXISTS "minimum_date"`);
    await queryRunner.query(
      `ALTER TABLE "temp_mapped_deals" DROP COLUMN IF EXISTS "application_id"`
    );
    await queryRunner.query(`ALTER TABLE "temp_mapped_deals" DROP COLUMN IF EXISTS "contact_id"`);

    // Restore old columns
    await queryRunner.query(`ALTER TABLE "temp_mapped_deals" ADD "agentcis_deal_id" integer`);
    await queryRunner.query(`ALTER TABLE "temp_mapped_deals" ADD "applyims_deal_id" varchar(36)`);
    await queryRunner.query(`ALTER TABLE "temp_mapped_deals" ADD "service_id" integer`);

    // Make branch_id NOT NULL again
    await queryRunner.query(
      `ALTER TABLE "temp_mapped_deals" ALTER COLUMN "branch_id" SET NOT NULL`
    );

    // Restore old indexes and constraint
    await queryRunner.query(`
      ALTER TABLE "temp_mapped_deals" ADD CONSTRAINT "UQ_temp_mapped_deals_agentcis_deal_id" UNIQUE ("agentcis_deal_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_temp_mapped_deals_agentcis_deal_id" ON "temp_mapped_deals" ("agentcis_deal_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_temp_mapped_deals_applyims_deal_id" ON "temp_mapped_deals" ("applyims_deal_id")
    `);
  }
}
