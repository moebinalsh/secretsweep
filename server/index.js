import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import logger from './logger.js';
import { scanManager } from './lib/scanManager.js';

// Route modules
import authRoutes from './routes/auth.js';
import githubRoutes from './routes/github.js';
import scanRoutes from './routes/scans.js';
import findingRoutes from './routes/findings.js';
import userRoutes from './routes/users.js';
import orgRoutes from './routes/orgs.js';
import integrationRoutes from './routes/integrations.js';
import gitlabRoutes from './routes/gitlab.js';
import auditLogRoutes from './routes/auditLogs.js';
import superAdminRoutes from './routes/superAdmin.js';
import contactRoutes from './routes/contact.js';
import scheduleRoutes from './routes/schedules.js';
import { startScheduler, stopScheduler } from './lib/scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

// ---- Environment Validation ----

const requiredEnvVars = ['SESSION_SECRET'];
const warnEnvVars = ['DATABASE_URL', 'ENCRYPTION_KEY'];

const missingRequired = requiredEnvVars.filter((v) => !process.env[v]);
if (missingRequired.length > 0) {
  if (isProd) {
    logger.error(`Missing required env vars: ${missingRequired.join(', ')}. Exiting.`);
    process.exit(1);
  } else {
    logger.warn(`Missing env vars: ${missingRequired.join(', ')}. Copy .env.example to .env.`);
  }
}

const missingWarn = warnEnvVars.filter((v) => !process.env[v]);
if (missingWarn.length > 0) {
  logger.warn(`Missing recommended env vars: ${missingWarn.join(', ')}`);
}

// ---- App Setup ----

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: isProd ? undefined : false,
    crossOriginEmbedderPolicy: false,
  })
);

// Compression (skip SSE endpoints)
app.use(compression({
  filter: (req, res) => {
    if (req.path.includes('/stream')) return false;
    return compression.filter(req, res);
  },
}));

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
  : ['http://localhost:5173'];

app.use(
  cors({
    origin: isProd ? allowedOrigins : true,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.path.startsWith('/health')) {
      logger.debug(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// ---- Rate Limiting ----

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 100 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Try again later.' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.' },
});

const scanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 50 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Scan rate limit reached. Try again later.' },
});

// ---- Health Check ----

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
  });
});

// ---- Mount Routes ----

app.use('/auth', authLimiter, authRoutes);
app.use('/api/github', apiLimiter, githubRoutes);
app.use('/api/scans', apiLimiter, scanRoutes);
app.use('/api/findings', apiLimiter, findingRoutes);
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/integrations', apiLimiter, integrationRoutes);
app.use('/api/gitlab', apiLimiter, gitlabRoutes);
app.use('/api/audit-logs', apiLimiter, auditLogRoutes);
app.use('/api/admin', apiLimiter, superAdminRoutes);
app.use('/api/contact', apiLimiter, contactRoutes);
app.use('/api/schedules', apiLimiter, scheduleRoutes);
app.use('/api/org', apiLimiter, orgRoutes);

// ---- Static Files (Production) ----

if (isProd) {
  app.use(express.static(path.join(__dirname, '..', 'dist')));
  // SPA fallback: serve index.html for all non-API routes
  app.get(/^\/(?!api|auth|health).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

// ---- API 404 Handler ----

app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ---- Global Error Handler ----

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: isProd ? 'Internal server error' : err.message,
  });
});

// ---- Start Server ----

await scanManager.init();
startScheduler();


const server = app.listen(PORT, () => {
  logger.info(`SecretSweep server running on http://localhost:${PORT}`);
});

// ---- Graceful Shutdown ----

function shutdown(signal) {
  logger.info(`${signal} received. Shutting down...`);
  scanManager.shutdownAll();
  stopScheduler();
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
});
