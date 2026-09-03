import crypto from 'node:crypto';
import { constantTimeEqual } from './utils.js';

const COOKIE_NAME = 'mc_admin_session';

function signature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createSession(secret, hours, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    exp: now + hours * 60 * 60 * 1000,
    nonce: crypto.randomBytes(12).toString('base64url')
  })).toString('base64url');
  return `${payload}.${signature(payload, secret)}`;
}

export function verifySession(token, secret, now = Date.now()) {
  if (!token || typeof token !== 'string') return false;
  const [payload, receivedSignature, extra] = token.split('.');
  if (!payload || !receivedSignature || extra) return false;
  if (!constantTimeEqual(receivedSignature, signature(payload, secret))) return false;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(decoded.exp) && decoded.exp > now;
  } catch {
    return false;
  }
}

function isSecureRequest(req) {
  return req.secure || req.get('x-forwarded-proto') === 'https';
}

export function setSessionCookie(req, res, config) {
  res.cookie(COOKIE_NAME, createSession(config.adminToken, config.sessionHours), {
    httpOnly: true,
    sameSite: 'strict',
    secure: isSecureRequest(req),
    maxAge: config.sessionHours * 60 * 60 * 1000,
    path: '/'
  });
}

export function clearSessionCookie(req, res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isSecureRequest(req),
    path: '/'
  });
}

export function authenticate(config) {
  return (req, res, next) => {
    if (verifySession(req.cookies?.[COOKIE_NAME], config.adminToken)) return next();
    return res.status(401).json({ error: 'Sessao ausente ou expirada.' });
  };
}

export function verifyLoginToken(candidate, config) {
  return constantTimeEqual(candidate || '', config.adminToken);
}

export function sameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next();

  try {
    const originUrl = new URL(origin);
    if (originUrl.host === req.get('host')) return next();
  } catch {
    // A origem malformada e rejeitada abaixo.
  }
  return res.status(403).json({ error: 'Origem da requisicao nao autorizada.' });
}

export function actorFromRequest(req) {
  const accessEmail = req.get('cf-access-authenticated-user-email');
  return accessEmail || 'administrador-token';
}
