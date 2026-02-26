import { Request, Response } from 'express';

export function startMigrationController(_req: Request, res: Response) {
  res.json({ message: 'Temporary message' });
}

export function getMigrationStatusController(req: Request, res: Response) {
  res.json({ message: `Temporary status for ${req.params.id}` });
}
