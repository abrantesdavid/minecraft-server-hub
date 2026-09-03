import path from 'node:path';
import { parsePositiveInt } from './utils.js';

function requiredSecret(name, minimumLength) {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith('CHANGE_ME') || value.length < minimumLength) {
    throw new Error(`${name} precisa ser configurado com pelo menos ${minimumLength} caracteres.`);
  }
  return value;
}

const worldRoot = path.resolve(process.env.WORLD_ROOT || '/minecraft-data/worlds');
const levelName = (process.env.LEVEL_NAME || 'Mundo Principal').trim();
if (!levelName || levelName === '.' || levelName === '..' || /[\\/]/.test(levelName)) {
  throw new Error('LEVEL_NAME precisa ser um nome de pasta simples, sem barras.');
}
const autoUpdateTime = process.env.AUTO_UPDATE_TIME?.trim() ?? '05:00';
if (autoUpdateTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(autoUpdateTime)) {
  throw new Error('AUTO_UPDATE_TIME precisa usar o formato HH:MM ou ficar vazio.');
}

export const config = Object.freeze({
  port: parsePositiveInt(process.env.PORT, 3000, { min: 1, max: 65535 }),
  adminToken: requiredSecret('PANEL_ADMIN_TOKEN', 32),
  sessionHours: parsePositiveInt(process.env.SESSION_HOURS, 12, { min: 1, max: 168 }),
  consolePassword: requiredSecret('CONSOLE_PASSWORD', 24),
  bedrockContainer: process.env.BEDROCK_CONTAINER || 'minecraft-bedrock',
  bedrockHost: process.env.BEDROCK_HOST || 'bedrock',
  bedrockSshPort: parsePositiveInt(process.env.BEDROCK_SSH_PORT, 2222, { min: 1, max: 65535 }),
  dockerReadHost: process.env.DOCKER_READ_HOST || 'docker-read-proxy',
  dockerControlHost: process.env.DOCKER_CONTROL_HOST || 'docker-control-proxy',
  dockerProxyPort: parsePositiveInt(process.env.DOCKER_PROXY_PORT, 2375, { min: 1, max: 65535 }),
  worldRoot,
  dataRoot: path.dirname(worldRoot),
  levelName,
  serverName: process.env.SERVER_NAME || 'Servidor Bedrock',
  minecraftPort: parsePositiveInt(process.env.MINECRAFT_PORT, 19132, { min: 1, max: 65535 }),
  autoUpdateTime
});
