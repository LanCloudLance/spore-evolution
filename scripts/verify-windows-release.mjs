import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, cp, mkdir, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

assert.equal(process.platform, 'win32', 'This check must actually run on Windows');
const repository = process.env.GITHUB_REPOSITORY;
const tag = process.env.SPORE_RELEASE_TAG || 'v0.1.0-offline';
assert.ok(/^[\w.-]+\/[\w.-]+$/.test(repository || ''), 'Missing GitHub repository');
const directory = await mkdtemp(resolve(tmpdir(), 'spore-windows-check-'));
const archive = resolve(directory, 'spore-offline-windows.zip');
const response = await fetch(`https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/spore-offline-windows.zip`);
assert.equal(response.status, 200, 'Windows ZIP must be publicly downloadable');
await writeFile(archive, Buffer.from(await response.arrayBuffer()));

function execute(file, args, env = process.env) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(file, args, { env, cwd: directory, windowsHide: true });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data.toString('utf8'); });
    child.stderr.on('data', data => { stderr += data.toString('utf8'); });
    child.on('error', reject);
    child.on('close', code => resolveResult({ code, stdout, stderr }));
  });
}

const expanded = await execute('powershell.exe', [
  '-NoProfile', '-NonInteractive', '-Command',
  'Expand-Archive -LiteralPath $env:SPORE_CI_ZIP -DestinationPath $env:SPORE_CI_FOLDER -Force',
], { ...process.env, SPORE_CI_ZIP: archive, SPORE_CI_FOLDER: directory });
assert.equal(expanded.code, 0, expanded.stderr);
let gameDirectory = resolve(directory, '胞子离线版-Windows');
const manifest = JSON.parse(await readFile(resolve(gameDirectory, '打包校验.json'), 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(sha256(await readFile(resolve(gameDirectory, manifest.entry))), manifest.sha256);
assert.equal(sha256(await readFile(resolve(gameDirectory, manifest.launcher.file))), manifest.launcher.sha256);
const origin = 'http://127.0.0.1:49325/';
const health = new URL('__spore_offline_health', origin);
let server;
let output = '';
async function stop() {
  if (!server || server.exitCode !== null) return;
  const current = server;
  await new Promise((resolveClosed) => {
    current.once('close', resolveClosed);
    current.kill();
  });
}
async function start() {
  server = spawn(resolve(gameDirectory, manifest.launcher.file), ['--no-browser'], {
    cwd: directory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => { output += data.toString('utf8'); });
  server.stderr.on('data', data => { output += data.toString('utf8'); });
  server.on('error', error => { output += error.message; });
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    assert.equal(server.exitCode, null, `Launcher exited before serving: ${output}`);
    try {
      const result = await fetch(health, { signal: AbortSignal.timeout(1000) });
      assert.equal(await result.text(), 'spore-offline-v1:' + manifest.sha256);
      return;
    } catch {
      await new Promise(resolveDelay => setTimeout(resolveDelay, 200));
    }
  }
  throw new Error('Windows launcher failed to serve the game: ' + output);
}

try {
  await start();
  const game = await fetch(origin);
  assert.equal(game.status, 200);
  assert.equal(sha256(Buffer.from(await game.arrayBuffer())), manifest.sha256);
  const head = await fetch(origin, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(Number(head.headers.get('content-length')), manifest.bytes);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  assert.equal((await fetch(new URL('使用说明.txt', origin))).status, 404);
  assert.equal((await fetch(origin, { method: 'POST' })).status, 405);
  const duplicate = await execute(resolve(gameDirectory, manifest.launcher.file), ['--no-browser']);
  assert.equal(duplicate.code, 0, duplicate.stderr);
  assert.ok(duplicate.stdout.includes('已经运行'));
  const incomplete = resolve(directory, '不完整 游戏包');
  await mkdir(incomplete);
  await cp(resolve(gameDirectory, manifest.launcher.file), resolve(incomplete, manifest.launcher.file));
  const missing = await execute(resolve(incomplete, manifest.launcher.file), ['--no-browser']);
  assert.equal(missing.code, 1);
  assert.ok(missing.stderr.includes('完整解压'));
  await writeFile(resolve(incomplete, manifest.entry), '<title>Different release check</title>');
  const conflict = await execute(resolve(incomplete, manifest.launcher.file), ['--no-browser']);
  assert.equal(conflict.code, 1);
  assert.ok(conflict.stderr.includes('已被占用'));
  await stop();
  const moved = resolve(directory, '移动后 游戏文件夹');
  await rename(gameDirectory, moved);
  gameDirectory = moved;
  await start();
  assert.equal(await (await fetch(health)).text(), 'spore-offline-v1:' + manifest.sha256);
  assert.equal(sha256(Buffer.from(await (await fetch(origin)).arrayBuffer())), manifest.sha256);
  console.log(JSON.stringify({
    status: 'passed', platform: process.platform, architecture: process.arch,
    release: tag, htmlSha256: manifest.sha256, launcherSha256: manifest.launcher.sha256,
    checks: ['public ZIP download', 'Windows extraction', 'Chinese filenames and spaces',
      'native exe startup', 'HTML hash', 'HEAD', '404', '405', 'duplicate startup',
      'missing HTML', 'different release conflict', 'move folder and restart'],
    browserAutoOpenTested: false, playerAcceptanceTested: false,
  }, null, 2));
} finally {
  await stop();
}
