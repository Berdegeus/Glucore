import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import authRouter from './routes/auth';
import readingsRouter from './routes/readings';
import carbsRouter from './routes/carbs';
import insulinRouter from './routes/insulin';
import alertsRouter from './routes/alerts';
import settingsRouter from './routes/settings';

const app = express();
const PORT = process.env.PORT ?? 3001;

// Restrict CORS to the origins listed in CORS_ORIGIN (comma-separated).
// When unset, stay permissive for local development.
const corsOrigins = process.env.CORS_ORIGIN?.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

app.use(corsOrigins && corsOrigins.length > 0 ? cors({ origin: corsOrigins }) : cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/auth', authRouter);
app.use('/readings', readingsRouter);
app.use('/carbs', carbsRouter);
app.use('/insulin', insulinRouter);
app.use('/alerts', alertsRouter);
app.use('/settings', settingsRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`[${new Date().toISOString()}] Unhandled error: ${err.message}`);
  if (process.env.NODE_ENV !== 'production') console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Glucore backend running on :${PORT}`);
});
