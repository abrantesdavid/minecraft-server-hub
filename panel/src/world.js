import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import archiver from 'archiver';
import { safeFilename, sleep } from './utils.js';

export function resolveWorldPath(worldRoot, levelName) {
  const root = path.resolve(worldRoot);
  const candidate = path.resolve(root, levelName);
  if (candidate === root || !candidate.startsWith(`${root}${path.sep}`)) {
    throw new Error('LEVEL_NAME aponta para fora da pasta de mundos.');
  }
  return candidate;
}

async function walkDirectory(directory) {
  const entries = await fsp.readdir(directory, { withFileTypes: true });
  let bytes = 0;
  let files = 0;
  let modifiedAt = 0;

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    const stat = await fsp.lstat(entryPath);
    modifiedAt = Math.max(modifiedAt, stat.mtimeMs);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      const nested = await walkDirectory(entryPath);
      bytes += nested.bytes;
      files += nested.files;
      modifiedAt = Math.max(modifiedAt, nested.modifiedAt);
    } else if (entry.isFile()) {
      bytes += stat.size;
      files += 1;
    }
  }
  return { bytes, files, modifiedAt };
}

export async function worldStats(worldRoot, levelName) {
  const worldPath = resolveWorldPath(worldRoot, levelName);
  try {
    const stat = await fsp.stat(worldPath);
    if (!stat.isDirectory()) return { exists: false, bytes: 0, files: 0, modifiedAt: null };
    const result = await walkDirectory(worldPath);
    return {
      exists: true,
      bytes: result.bytes,
      files: result.files,
      modifiedAt: result.modifiedAt ? new Date(result.modifiedAt).toISOString() : null
    };
  } catch (error) {
    if (error.code === 'ENOENT') return { exists: false, bytes: 0, files: 0, modifiedAt: null };
    throw error;
  }
}

export async function detectBedrockVersion(dataRoot) {
  try {
    const entries = await fsp.readdir(dataRoot);
    const versions = entries
      .map((name) => name.match(/^bedrock_server-(.+)$/)?.[1])
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    return versions[0] || null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function archiveDirectory(source, destination) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destination, { flags: 'wx', mode: 0o600 });
    const archive = archiver('zip', { zlib: { level: 6 } });
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('warning', (error) => {
      if (error.code !== 'ENOENT') reject(error);
    });
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(source, false);
    archive.finalize();
  });
}

export class WorldService {
  constructor({ worldRoot, levelName, consoleClient }) {
    this.worldRoot = worldRoot;
    this.levelName = levelName;
    this.consoleClient = consoleClient;
    this.busy = false;
  }

  async createSnapshot({ serverRunning }) {
    if (this.busy) {
      const error = new Error('Ja existe uma copia do mundo sendo preparada.');
      error.statusCode = 409;
      throw error;
    }
    this.busy = true;
    const worldPath = resolveWorldPath(this.worldRoot, this.levelName);
    const sourceStat = await fsp.stat(worldPath).catch(() => null);
    if (!sourceStat?.isDirectory()) {
      this.busy = false;
      const error = new Error('O mundo ainda nao foi criado pelo servidor.');
      error.statusCode = 404;
      throw error;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${safeFilename(this.levelName)}-${stamp}.mcworld`;
    const temporaryPath = path.join(os.tmpdir(), `${crypto.randomUUID()}-${filename}`);
    let saveHeld = false;

    try {
      if (serverRunning) {
        await this.consoleClient.send('save hold');
        saveHeld = true;
        await sleep(1_500);
        await this.consoleClient.send('save query');
        await sleep(1_500);
      }
      await archiveDirectory(worldPath, temporaryPath);
      return { temporaryPath, filename };
    } catch (error) {
      await fsp.unlink(temporaryPath).catch(() => {});
      throw error;
    } finally {
      if (saveHeld) {
        await this.consoleClient.send('save resume').catch((error) => {
          console.error('[world] Falha ao retomar o salvamento:', error.message);
        });
      }
      this.busy = false;
    }
  }
}
