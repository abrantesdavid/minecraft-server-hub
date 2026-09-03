import { Client } from 'ssh2';

const FORBIDDEN_COMMAND = /^\s*(stop|restart)\s*$/i;

export function normalizeCommand(value) {
  const command = String(value || '').trim();
  if (!command) throw new Error('Digite um comando.');
  if (command.length > 500) throw new Error('O comando deve ter no maximo 500 caracteres.');
  if (/[\r\n\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(command)) {
    throw new Error('O comando contem caracteres de controle invalidos.');
  }
  if (FORBIDDEN_COMMAND.test(command)) {
    throw new Error('Use os botoes do painel para parar ou reiniciar com salvamento seguro.');
  }
  return command;
}

export class BedrockConsole {
  constructor({ host, port, password }) {
    this.host = host;
    this.port = port;
    this.password = password;
  }

  async send(rawCommand) {
    const command = normalizeCommand(rawCommand);
    return new Promise((resolve, reject) => {
      const connection = new Client();
      let settled = false;
      let output = '';
      let finishTimer;

      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(finishTimer);
        connection.end();
        if (error) reject(error);
        else resolve({ accepted: true, output: output.slice(-4000) });
      };

      connection
        .on('ready', () => {
          connection.shell({ term: 'xterm', cols: 120, rows: 30 }, (error, stream) => {
            if (error) return finish(error);
            stream.on('data', (chunk) => { output += chunk.toString('utf8'); });
            stream.stderr.on('data', (chunk) => { output += chunk.toString('utf8'); });
            stream.on('error', finish);
            stream.write(`${command}\n`);
            finishTimer = setTimeout(() => {
              stream.end();
              finish();
            }, 650);
          });
        })
        .on('error', finish)
        .connect({
          host: this.host,
          port: this.port,
          username: 'painel',
          password: this.password,
          readyTimeout: 10_000,
          keepaliveInterval: 5_000,
          keepaliveCountMax: 1
        });
    });
  }
}
