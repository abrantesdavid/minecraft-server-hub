import http from 'node:http';

export class DockerApiError extends Error {
  constructor(message, statusCode, details = '') {
    super(message);
    this.name = 'DockerApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

function requestOptions(host, port, method, apiPath) {
  return {
    host,
    port,
    method,
    path: apiPath,
    headers: { Host: 'docker' }
  };
}

function collectResponse(response, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    response.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        response.destroy(new Error('Resposta do Docker excedeu o limite permitido.'));
        return;
      }
      chunks.push(chunk);
    });
    response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    response.on('error', reject);
  });
}

export class DockerApi {
  constructor({ readHost, controlHost, port, containerName }) {
    this.readHost = readHost;
    this.controlHost = controlHost;
    this.port = port;
    this.containerName = containerName;
    this.encodedContainer = encodeURIComponent(containerName);
  }

  async request(host, method, apiPath, { timeout = 20_000 } = {}) {
    return new Promise((resolve, reject) => {
      const request = http.request(requestOptions(host, this.port, method, apiPath), async (response) => {
        try {
          const body = await collectResponse(response);
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new DockerApiError(
              `Docker respondeu com HTTP ${response.statusCode}.`,
              response.statusCode,
              body.slice(0, 1000)
            ));
            return;
          }
          resolve(body);
        } catch (error) {
          reject(error);
        }
      });
      request.setTimeout(timeout, () => request.destroy(new Error('Tempo limite da operacao Docker excedido.')));
      request.on('error', reject);
      request.end();
    });
  }

  async inspect() {
    try {
      const body = await this.request(
        this.readHost,
        'GET',
        `/containers/${this.encodedContainer}/json`
      );
      const data = JSON.parse(body);
      return {
        exists: true,
        running: Boolean(data.State?.Running),
        status: data.State?.Status || 'unknown',
        health: data.State?.Health?.Status || null,
        startedAt: data.State?.StartedAt || null,
        finishedAt: data.State?.FinishedAt || null,
        restartCount: data.RestartCount || 0,
        image: data.Config?.Image || null
      };
    } catch (error) {
      if (error instanceof DockerApiError && error.statusCode === 404) {
        return { exists: false, running: false, status: 'not_found', health: null };
      }
      throw error;
    }
  }

  async action(action) {
    const paths = {
      start: `/containers/${this.encodedContainer}/start`,
      stop: `/containers/${this.encodedContainer}/stop?t=50`,
      restart: `/containers/${this.encodedContainer}/restart?t=50`
    };
    const apiPath = paths[action];
    if (!apiPath) throw new Error('Acao de servidor invalida.');
    await this.request(this.controlHost, 'POST', apiPath, { timeout: 70_000 });
  }

  streamLogs({ tail = 300, follow = true } = {}) {
    const query = new URLSearchParams({
      stdout: '1',
      stderr: '1',
      timestamps: '1',
      tail: String(tail),
      follow: follow ? '1' : '0'
    });

    return new Promise((resolve, reject) => {
      const request = http.request(
        requestOptions(
          this.readHost,
          this.port,
          'GET',
          `/containers/${this.encodedContainer}/logs?${query}`
        ),
        async (response) => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            const body = await collectResponse(response).catch(() => '');
            reject(new DockerApiError(
              `Nao foi possivel abrir os logs (HTTP ${response.statusCode}).`,
              response.statusCode,
              body.slice(0, 1000)
            ));
            return;
          }
          resolve({ request, response });
        }
      );
      request.setTimeout(20_000, () => request.destroy(new Error('Tempo limite ao abrir os logs.')));
      request.on('error', reject);
      request.end();
    });
  }
}
