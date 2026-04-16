import { Request, Response } from 'express';
import { MonitoringService } from '../../services/monitoring.service.js';

export class MonitoringController {
  constructor(private monitoringService: MonitoringService) {}

  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const migrationId = req.query.migrationId as string | undefined;

      if (!migrationId) {
        const latestMigration = await this.monitoringService.getLatestMigration();
        if (!latestMigration) {
          res.json({
            currentMigration: null,
            performance: {
              recordsPerSecond: 0,
              apiCallsPerSecond: 0,
              averageResponseTime: 0,
            },
            errors: {
              total: 0,
              recent: [],
            },
          });
          return;
        }

        const data = await this.monitoringService.getDashboardData(latestMigration.id);
        res.json(data);
        return;
      }

      const data = await this.monitoringService.getDashboardData(migrationId);
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ status: 'error', message });
    }
  }
}
