import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, verifySession } from '../src/auth.js';
import { normalizeCommand } from '../src/console.js';
import { resolveWorldPath } from '../src/world.js';
import { safeFilename } from '../src/utils.js';

test('sessao valida expira e rejeita assinatura alterada', () => {
  const secret = 'a'.repeat(40);
  const now = 1_000_000;
  const token = createSession(secret, 1, now);
  assert.equal(verifySession(token, secret, now + 1_000), true);
  assert.equal(verifySession(token, secret, now + 3_600_001), false);
  assert.equal(verifySession(`${token}x`, secret, now + 1_000), false);
});

test('comandos de console rejeitam parada e quebras de linha', () => {
  assert.equal(normalizeCommand('  say ola  '), 'say ola');
  assert.throws(() => normalizeCommand('stop'), /botoes do painel/);
  assert.throws(() => normalizeCommand('say ola\nstop'), /caracteres de controle/);
});

test('caminho do mundo nunca escapa da raiz', () => {
  assert.equal(resolveWorldPath('/data/worlds', 'Principal'), '/data/worlds/Principal');
  assert.throws(() => resolveWorldPath('/data/worlds', '../segredo'), /fora da pasta/);
  assert.throws(() => resolveWorldPath('/data/worlds', '.'), /fora da pasta/);
});

test('nome de download fica portavel', () => {
  assert.equal(safeFilename('Mundo Principal: Edição 1'), 'Mundo-Principal-Edicao-1');
});
