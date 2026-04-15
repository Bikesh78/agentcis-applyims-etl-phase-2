import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEtlConnectionOptions } from 'configs/database.config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const options: DataSourceOptions = {
  ...createEtlConnectionOptions(),
  migrations: [`${__dirname}/migrations/etlDb/*{.ts,.js}`],
  entities: [`${__dirname}/entities/eltDb/*{.ts,.js}`],
};

export const etlDataSource = new DataSource(options);
