import express, { Application, Request, Response } from 'express';

const app: Application = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Hello, World!' });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

export default app;
