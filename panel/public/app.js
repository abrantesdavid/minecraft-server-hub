const elements = {
  loginShell: document.querySelector('#login-shell'),
  loginForm: document.querySelector('#login-form'),
  loginError: document.querySelector('#login-error'),
  token: document.querySelector('#token'),
  toggleToken: document.querySelector('#toggle-token'),
  appShell: document.querySelector('#app-shell'),
  serverTitle: document.querySelector('#server-title'),
  refreshButton: document.querySelector('#refresh-button'),
  logoutButton: document.querySelector('#logout-button'),
  syncLabel: document.querySelector('#sync-label'),
  statusOrb: document.querySelector('#status-orb'),
  statusLabel: document.querySelector('#status-label'),
  statusDetail: document.querySelector('#status-detail'),
  version: document.querySelector('#version-value'),
  uptime: document.querySelector('#uptime-value'),
  port: document.querySelector('#port-value'),
  actionButtons: [...document.querySelectorAll('[data-server-action]')],
  terminal: document.querySelector('#terminal'),
  streamState: document.querySelector('#stream-state'),
  clearConsole: document.querySelector('#clear-console'),
  commandForm: document.querySelector('#command-form'),
  commandInput: document.querySelector('#command-input'),
  sendCommand: document.querySelector('#send-command'),
  worldBadge: document.querySelector('#world-badge'),
  worldName: document.querySelector('#world-name'),
  worldSize: document.querySelector('#world-size'),
  worldFiles: document.querySelector('#world-files'),
  worldModified: document.querySelector('#world-modified'),
  downloadWorld: document.querySelector('#download-world'),
  localAddress: document.querySelector('#local-address'),
  confirmDialog: document.querySelector('#confirm-dialog'),
  confirmTitle: document.querySelector('#confirm-title'),
  confirmCopy: document.querySelector('#confirm-copy'),
  confirmAction: document.querySelector('#confirm-action'),
  toastRegion: document.querySelector('#toast-region')
};

const state = {
  authenticated: false,
  overview: null,
  pendingAction: null,
  eventSource: null,
  refreshTimer: null,
  uptimeTimer: null,
  busy: false
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && url !== '/api/login') showLogin();
  if (!response.ok) throw new Error(data.error || `Erro HTTP ${response.status}`);
  return data;
}

function showLogin() {
  state.authenticated = false;
  state.eventSource?.close();
  clearInterval(state.refreshTimer);
  clearInterval(state.uptimeTimer);
  elements.appShell.hidden = true;
  elements.loginShell.hidden = false;
  setTimeout(() => elements.token.focus(), 0);
}

function showApp(session) {
  state.authenticated = true;
  elements.loginShell.hidden = true;
  elements.appShell.hidden = false;
  elements.serverTitle.textContent = session.serverName;
  connectLogs();
  refreshOverview();
  clearInterval(state.refreshTimer);
  clearInterval(state.uptimeTimer);
  state.refreshTimer = setInterval(refreshOverview, 8_000);
  state.uptimeTimer = setInterval(renderUptime, 1_000);
}

function toast(message, type = 'normal') {
  const node = document.createElement('div');
  node.className = `toast${type === 'error' ? ' toast-error' : ''}`;
  node.textContent = message;
  elements.toastRegion.append(node);
  setTimeout(() => node.remove(), 5_000);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: index === 0 ? 0 : 2 })} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '—';
  const seconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days) return `${days}d ${hours}h ${minutes}min`;
  if (hours) return `${hours}h ${minutes}min`;
  return `${minutes}min ${seconds % 60}s`;
}

function renderUptime() {
  const server = state.overview?.server;
  if (!server?.running || !server.startedAt) {
    elements.uptime.textContent = '—';
    return;
  }
  elements.uptime.textContent = formatDuration(Date.now() - new Date(server.startedAt).getTime());
}

function renderOverview(data) {
  state.overview = data;
  const { server, world } = data;
  elements.serverTitle.textContent = server.name;
  elements.version.textContent = server.version || 'detectando…';
  elements.port.textContent = `${server.port} / UDP`;
  elements.localAddress.textContent = `IP-DO-PC:${server.port}`;
  elements.worldName.textContent = world.name;

  elements.statusOrb.className = 'status-orb';
  if (!server.exists) {
    elements.statusOrb.classList.add('status-offline');
    elements.statusLabel.textContent = 'Contêiner ausente';
    elements.statusDetail.textContent = 'Execute a instalação no computador servidor';
  } else if (server.running) {
    elements.statusOrb.classList.add('status-online');
    elements.statusLabel.textContent = server.health === 'healthy' ? 'Servidor online' : 'Servidor iniciando';
    elements.statusDetail.textContent = server.health === 'healthy' ? 'Aceitando conexões Bedrock' : 'Aguardando verificação de saúde';
  } else {
    elements.statusOrb.classList.add('status-offline');
    elements.statusLabel.textContent = 'Servidor desligado';
    elements.statusDetail.textContent = 'O mundo permanece salvo no disco';
  }

  elements.actionButtons.forEach((button) => {
    const action = button.dataset.serverAction;
    button.disabled = state.busy
      || !server.exists
      || (action === 'start' && server.running)
      || (action !== 'start' && !server.running);
  });
  elements.commandInput.disabled = !server.running || state.busy;
  elements.sendCommand.disabled = !server.running || state.busy;

  elements.worldBadge.textContent = world.exists ? 'Disponível' : 'Ainda não criado';
  elements.worldSize.textContent = world.exists ? formatBytes(world.bytes) : '—';
  elements.worldFiles.textContent = world.exists ? world.files.toLocaleString('pt-BR') : '—';
  elements.worldModified.textContent = world.exists ? formatDate(world.modifiedAt) : '—';
  elements.downloadWorld.disabled = !world.exists || world.snapshotBusy || state.busy;
  elements.downloadWorld.textContent = world.snapshotBusy ? 'Preparando cópia…' : 'Baixar mundo (.mcworld)';
  renderUptime();
}

async function refreshOverview() {
  if (!state.authenticated || state.busy) return;
  try {
    const data = await api('/api/overview');
    renderOverview(data);
    elements.syncLabel.textContent = `Atualizado ${new Intl.DateTimeFormat('pt-BR', { timeStyle: 'medium' }).format(new Date())}`;
  } catch (error) {
    elements.syncLabel.textContent = 'Falha de sincronização';
    toast(error.message, 'error');
  }
}

function addLogLine(line) {
  const shouldStick = elements.terminal.scrollHeight - elements.terminal.scrollTop - elements.terminal.clientHeight < 80;
  elements.terminal.querySelector('.terminal-placeholder')?.remove();
  const node = document.createElement('div');
  node.className = 'terminal-line';
  node.textContent = line;
  elements.terminal.append(node);
  while (elements.terminal.childElementCount > 1_000) elements.terminal.firstElementChild.remove();
  if (shouldStick) elements.terminal.scrollTop = elements.terminal.scrollHeight;
}

function connectLogs() {
  state.eventSource?.close();
  elements.streamState.textContent = 'Conectando';
  const source = new EventSource('/api/logs/stream');
  state.eventSource = source;
  source.addEventListener('ready', () => { elements.streamState.textContent = 'Ao vivo'; });
  source.addEventListener('log', (event) => {
    try { addLogLine(JSON.parse(event.data).line); } catch { addLogLine(event.data); }
  });
  source.addEventListener('closed', () => {
    source.close();
    elements.streamState.textContent = 'Aguardando servidor';
  });
  source.addEventListener('stream-error', (event) => {
    elements.streamState.textContent = 'Reconectando';
    try { addLogLine(`[painel] ${JSON.parse(event.data).error}`); } catch { /* sem conteúdo utilizável */ }
  });
  source.onerror = () => { elements.streamState.textContent = 'Reconectando'; };
}

function openConfirmation(action) {
  const copy = {
    start: ['Ligar o servidor?', 'A versão mais recente do Bedrock será verificada durante a inicialização.', 'Ligar servidor', 'button-start'],
    restart: ['Reiniciar o servidor?', 'Os jogadores receberão o aviso de desligamento e serão desconectados.', 'Reiniciar', 'button-danger'],
    stop: ['Desligar o servidor?', 'O mundo será salvo com segurança antes do contêiner parar.', 'Desligar', 'button-danger']
  }[action];
  if (!copy) return;
  state.pendingAction = action;
  elements.confirmDialog.returnValue = '';
  elements.confirmTitle.textContent = copy[0];
  elements.confirmCopy.textContent = copy[1];
  elements.confirmAction.textContent = copy[2];
  elements.confirmAction.className = `button ${copy[3]}`;
  elements.confirmDialog.showModal();
}

async function performServerAction(action) {
  state.busy = true;
  if (state.overview) renderOverview(state.overview);
  try {
    await api(`/api/server/${action}`, { method: 'POST', body: '{}' });
    toast({ start: 'Servidor sendo ligado.', restart: 'Reinicialização iniciada.', stop: 'Desligamento seguro iniciado.' }[action]);
    setTimeout(refreshOverview, 1_500);
    setTimeout(connectLogs, 2_000);
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    state.busy = false;
    setTimeout(refreshOverview, 800);
  }
}

elements.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  elements.loginError.textContent = '';
  const submit = elements.loginForm.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await api('/api/login', { method: 'POST', body: JSON.stringify({ token: elements.token.value }) });
    elements.token.value = '';
    const session = await api('/api/session');
    showApp(session);
  } catch (error) {
    elements.loginError.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

elements.toggleToken.addEventListener('click', () => {
  const visible = elements.token.type === 'text';
  elements.token.type = visible ? 'password' : 'text';
  elements.toggleToken.textContent = visible ? 'Ver' : 'Ocultar';
  elements.toggleToken.setAttribute('aria-label', visible ? 'Mostrar token' : 'Ocultar token');
});

elements.refreshButton.addEventListener('click', refreshOverview);
elements.logoutButton.addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST', body: '{}' }).catch(() => {});
  showLogin();
});
elements.actionButtons.forEach((button) => button.addEventListener('click', () => openConfirmation(button.dataset.serverAction)));
elements.confirmDialog.addEventListener('close', () => {
  if (elements.confirmDialog.returnValue === 'confirm' && state.pendingAction) performServerAction(state.pendingAction);
  state.pendingAction = null;
});

elements.clearConsole.addEventListener('click', () => {
  elements.terminal.replaceChildren();
  const placeholder = document.createElement('div');
  placeholder.className = 'terminal-placeholder';
  placeholder.textContent = 'Tela limpa. Novas linhas aparecerão aqui.';
  elements.terminal.append(placeholder);
});

elements.commandForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const command = elements.commandInput.value.trim();
  if (!command) return;
  elements.sendCommand.disabled = true;
  try {
    await api('/api/console/command', { method: 'POST', body: JSON.stringify({ command }) });
    elements.commandInput.value = '';
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    elements.sendCommand.disabled = false;
    elements.commandInput.focus();
  }
});

elements.downloadWorld.addEventListener('click', async () => {
  if (elements.downloadWorld.disabled) return;
  elements.downloadWorld.disabled = true;
  elements.downloadWorld.textContent = 'Preparando cópia…';
  toast('Preparando o arquivo do mundo. Downloads grandes podem levar alguns minutos.');
  try {
    const result = await api('/api/world/snapshot', { method: 'POST', body: '{}' });
    window.location.assign(result.downloadUrl);
    toast('Cópia pronta. O download foi iniciado.');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    elements.downloadWorld.disabled = false;
    elements.downloadWorld.textContent = 'Baixar mundo (.mcworld)';
    refreshOverview();
  }
});

(async function initialize() {
  try {
    const session = await api('/api/session');
    showApp(session);
  } catch {
    showLogin();
  }
})();
