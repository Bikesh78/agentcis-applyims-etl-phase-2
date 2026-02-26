import { Request, Response } from 'express';

export function getMonitorDashboardController(_req: Request, res: Response) {
  res.json({ message: 'Temporary dashboard response' });
}

export function getMonitorLogsController(_req: Request, res: Response) {
  res.json({ message: 'temporary logs' });
}
