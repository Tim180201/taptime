import { execFileSync } from 'node:child_process';

// Pin the CLI to a local Unix socket. Never inherit a remote Docker context.
export function localDocker() {
  const configured = process.env.DOCKER_HOST;
  const endpoint = configured || JSON.parse(execFileSync('docker', ['context', 'inspect'], {
    encoding: 'utf8', timeout: 10_000,
  }))[0].Endpoints.docker.Host;
  if (!endpoint.startsWith('unix:///')) throw new Error('Only a local Docker Unix socket is allowed.');
  /** @param {string[]} args @param {{timeout?: number}} [options] */
  const run = (args, options = {}) => execFileSync('docker', ['--host', endpoint, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000, maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
  return run;
}

/** @param {ReturnType<typeof localDocker>} docker @param {string} image */
export function requireLocalImage(docker, image) {
  if (!image || image.startsWith('-')) throw new Error('An existing local image is required.');
  const details = JSON.parse(docker(['image', 'inspect', image]))[0];
  return { id: details.Id, platform: `${details.Os}/${details.Architecture}` };
}
