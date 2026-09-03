import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import {
  actorFromRequest,
  authenticate,
  clearSessionCookie,
  sameOrigin,
  setSessionCookie,
  verifyLoginToken
} from './auth.js';
import { DockerApi } from './docker.js';
import { BedrockConsole } from './console.js';
import { detectBedrockVersion, WorldService, worldStats } from './world.js';
import { stripAnsi } from './utils.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(directory, '../public');

const docker = new DockerApi({
  readHost: config.dockerReadHost,
  controlHost: config.dockerControlHost,
  port: config.dockerProxyPort,
  containerName: config.bedrockContainer
});
const consoleClient = new BedrockConsole({
  host: config.bedrockHost,
  port: config.bedrockSshPort,
  password: config.consolePassword
});
const worldService = new WorldService({
  worldRoot: config.worldRoot,
  levelName: config.levelName,
  consoleClient
});
const preparedSnapshots = new Map();

const app = express();
// O painel fica atras de exatamente um salto: Docker/Cloudflare Tunnel.
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());

app.get('/healthz', (_req, res) => res.json({ ok: true }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos.' }
});

app.post('/api/login', loginLimiter, sameOrigin, (req, res) => {
  if (!verifyLoginToken(req.body?.token, config)) {
    return res.status(401).json({ error: 'Token administrativo incorreto.' });
  }
  setSessionCookie(req, res, config);
  console.info(`[audit] login actor=${actorFromRequest(req)}`);
  return res.json({ ok: true, expiresInHours: config.sessionHours });
});

app.use('/api', authenticate(config));
app.use('/api', sameOrigin);

app.get('/api/session', (req, res) => {
  res.json({
    authenticated: true,
    actor: actorFromRequest(req),
    serverName: config.serverName
  });
});

app.post('/api/logout', (req, res) => {
  console.info(`[audit] logout actor=${actorFromRequest(req)}`);
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.get('/api/overview', async (_req, res, next) => {
  try {
    const [server, world, version] = await Promise.all([
      docker.inspect(),
      worldStats(config.worldRoot, config.levelName),
      detectBedrockVersion(config.dataRoot)
    ]);
    res.json({
      server: {
        ...server,
        name: config.serverName,
        version,
        port: config.minecraftPort
      },
      world: { ...world, name: config.levelName, snapshotBusy: worldService.busy }
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/server/:action', async (req, res, next) => {
  try {
    const action = req.params.action;
    if (!['start', 'stop', 'restart'].includes(action)) {
      return res.status(404).json({ error: 'Acao desconhecida.' });
    }
    const before = await docker.inspect();
    if (!before.exists) return res.status(409).json({ error: 'O conteiner Bedrock ainda nao existe.' });
    if (action === 'start' && before.running) return res.json({ ok: true, unchanged: true });
    if (action === 'stop' && !before.running) return res.json({ ok: true, unchanged: true });

    console.info(`[audit] server.${action} actor=${actorFromRequest(req)}`);
    await docker.action(action);
    return res.status(202).json({ ok: true, action });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/console/command', async (req, res, next) => {
  try {
    const server = await docker.inspect();
    if (!server.running) return res.status(409).json({ error: 'O servidor esta desligado.' });
    const command = String(req.body?.command || '');
    console.info(`[audit] console.command actor=${actorFromRequest(req)} command=${JSON.stringify(command.slice(0, 500))}`);
    await consoleClient.send(command);
    return res.status(202).json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/logs/stream', async (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  res.write(`event: ready\ndata: ${JSON.stringify({ connected: true })}\n\n`);

  let upstream;
  let pending = '';
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15_000);

  const sendLine = (line) => {
    const clean = stripAnsi(line);
    if (clean) res.write(`event: log\ndata: ${JSON.stringify({ line: clean })}\n\n`);
  };

  try {
    const stream = await docker.streamLogs({ tail: 350, follow: true });
    upstream = stream.response;
    upstream.on('data', (chunk) => {
      pending += chunk.toString('utf8');
      const lines = pending.split('\n');
      pending = lines.pop() || '';
      lines.forEach(sendLine);
    });
    upstream.on('end', () => {
      if (pending) sendLine(pending);
      res.write(`event: closed\ndata: ${JSON.stringify({ reason: 'log-stream-ended' })}\n\n`);
      res.end();
    });
    upstream.on('error', (error) => {
      res.write(`event: stream-error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    });
  } catch (error) {
    res.write(`event: stream-error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }

  req.on('close', () => {
    clearInterval(heartbeat);
    upstream?.destroy();
  });
});

app.post('/api/world/snapshot', async (req, res, next) => {
  try {
    const server = await docker.inspect();
    console.info(`[audit] world.snapshot actor=${actorFromRequest(req)}`);
    const snapshot = await worldService.createSnapshot({ serverRunning: server.running });
    const token = crypto.randomBytes(24).toString('base64url');
    const expiresAt = Date.now() + 10 * 60 * 1000;
    preparedSnapshots.set(token, { ...snapshot, expiresAt });
    const cleanupTimer = setTimeout(async () => {
      const expired = preparedSnapshots.get(token);
      if (!expired || expired.expiresAt > Date.now()) return;
      preparedSnapshots.delete(token);
      await fs.unlink(expired.temporaryPath).catch(() => {});
    }, 10 * 60 * 1000 + 1_000);
    cleanupTimer.unref();
    return res.status(201).json({ downloadUrl: `/api/world/download/${token}` });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/world/download/:token', async (req, res, next) => {
  const snapshot = preparedSnapshots.get(req.params.token);
  if (!snapshot || snapshot.expiresAt < Date.now()) {
    if (snapshot) {
      preparedSnapshots.delete(req.params.token);
      await fs.unlink(snapshot.temporaryPath).catch(() => {});
    }
    return res.status(404).json({ error: 'O link de download expirou. Prepare uma nova copia.' });
  }

  preparedSnapshots.delete(req.params.token);
  res.set('Cache-Control', 'no-store');
  return res.download(snapshot.temporaryPath, snapshot.filename, async (error) => {
    await fs.unlink(snapshot.temporaryPath).catch(() => {});
    if (error && !res.headersSent) next(error);
  });
});

app.use(express.static(publicDirectory, {
  etag: true,
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

app.get('*splat', (_req, res) => res.sendFile(path.join(publicDirectory, 'index.html')));

app.use((error, _req, res, _next) => {
  console.error('[error]', error);
  const status = error.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 500;
  const publicMessage = status >= 500
    ? 'Nao foi possivel concluir a operacao. Verifique os logs do painel.'
    : error.message;
  if (!res.headersSent) res.status(status).json({ error: publicMessage });
});

const server = app.listen(config.port, '0.0.0.0', () => {
  console.info(`[panel] Painel ouvindo na porta ${config.port}.`);
});

let lastAutomaticUpdateDate = null;
async function automaticUpdateTick() {
  if (!config.autoUpdateTime) return;
  const now = new Date();
  const localTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (localTime !== config.autoUpdateTime || localDate === lastAutomaticUpdateDate) return;
  lastAutomaticUpdateDate = localDate;

  try {
    const current = await docker.inspect();
    if (!current.running) return;
    console.info(`[audit] server.restart actor=automatic-update date=${localDate}`);
    await docker.action('restart');
  } catch (error) {
    console.error('[update] Falha na verificacao automatica:', error.message);
  }
}

const automaticUpdateTimer = setInterval(automaticUpdateTick, 30_000);
automaticUpdateTimer.unref();

function shutdown(signal) {
  console.info(`[panel] Recebido ${signal}; encerrando.`);
  clearInterval(automaticUpdateTimer);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
