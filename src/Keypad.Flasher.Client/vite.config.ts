import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import child_process from 'child_process';
import { env } from 'process';
import type { ServerOptions as HttpsServerOptions } from 'node:https';

export default defineConfig(({ command }): UserConfig => {
  const isServe = command === 'serve';
  const inContainer = env.DOTNET_RUNNING_IN_CONTAINER === 'true';

  const baseFolder =
    env.APPDATA && env.APPDATA !== ''
      ? `${env.APPDATA}/ASP.NET/https`
      : `${env.HOME}/.aspnet/https`;

  const certificateName = 'Keypad.Flasher.Client';
  const certFilePath = path.join(baseFolder, `${certificateName}.pem`);
  const keyFilePath = path.join(baseFolder, `${certificateName}.key`);

  let https: HttpsServerOptions | undefined;

  if (isServe) {
    if (!fs.existsSync(baseFolder)) {
      fs.mkdirSync(baseFolder, { recursive: true });
    }

    const haveCert = fs.existsSync(certFilePath) && fs.existsSync(keyFilePath);

    // Only try to generate certs on the host dev machine (not in containers)
    if (!haveCert && !inContainer) {
      const r = child_process.spawnSync(
        'dotnet',
        [
          'dev-certs',
          'https',
          '--export-path',
          certFilePath,
          '--format',
          'Pem',
          '--no-password',
        ],
        { stdio: 'inherit' }
      );

      const nowHaveCert = fs.existsSync(certFilePath) && fs.existsSync(keyFilePath);
      if (r.status !== 0 && !nowHaveCert) {
        throw new Error('Could not create certificate.');
      }
    }

    if (fs.existsSync(certFilePath) && fs.existsSync(keyFilePath)) {
      https = {
        key: fs.readFileSync(keyFilePath),
        cert: fs.readFileSync(certFilePath),
      };
    }
  }

  const target = env.ASPNETCORE_HTTPS_PORT
    ? `https://localhost:${env.ASPNETCORE_HTTPS_PORT}`
    : env.ASPNETCORE_URLS
      ? env.ASPNETCORE_URLS.split(';')[0]
      : 'https://localhost:7191';

  return {
    plugins: react(),
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      proxy: {
        '^/flasher': { target, secure: false },
      },
      port: parseInt(env.DEV_SERVER_PORT || '54196', 10),
      https,
    },
  };
});
