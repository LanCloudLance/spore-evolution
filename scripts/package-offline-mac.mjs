import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  cp,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  rename,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

if (process.platform !== 'darwin')
  throw new Error(
    'The Mac launcher must be built on macOS. Use build:offline for the standalone HTML on other systems.',
  );
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const destination = resolve(root, 'outputs/offline');
const run = promisify(execFile);
const temporary = await mkdtemp(resolve(tmpdir(), 'spore-offline-build-'));
const sourceFingerprint = createHash('sha256')
  .update(await readFile(resolve(root, 'offline/launcher.swift')))
  .update('macos12-O-v1')
  .digest('hex');
const compiledDirectory = resolve(
  root,
  'outputs/offline-build',
  sourceFingerprint,
);
await mkdir(compiledDirectory, { recursive: true });
await run(process.execPath, [resolve(root, 'scripts/build-offline.mjs')], {
  cwd: root,
});
for (const architecture of ['arm64', 'x86_64']) {
  const compiledFile = resolve(compiledDirectory, architecture);
  const receiptFile = compiledFile + '.json';
  let cached = false;
  try {
    const receipt = JSON.parse(await readFile(receiptFile, 'utf8'));
    const bytes = await readFile(compiledFile);
    cached =
      receipt.sourceFingerprint === sourceFingerprint &&
      receipt.sha256 === createHash('sha256').update(bytes).digest('hex');
  } catch {
    /* Compile when a verified source-matched cache is unavailable. */
  }
  if (!cached) {
    const compilerCache = resolve(
      tmpdir(),
      'spore-offline-swift-cache-' + architecture,
    );
    await mkdir(compilerCache, { recursive: true });
    await run(
      '/usr/bin/swiftc',
      [
        '-O',
        '-target',
        `${architecture}-apple-macosx12.0`,
        '-module-cache-path',
        compilerCache,
        resolve(root, 'offline/launcher.swift'),
        '-o',
        compiledFile,
      ],
      { cwd: root },
    );
    await writeFile(
      receiptFile,
      JSON.stringify({
        sourceFingerprint,
        sha256: createHash('sha256')
          .update(await readFile(compiledFile))
          .digest('hex'),
      }) + '\n',
    );
  }
  await cp(compiledFile, resolve(temporary, architecture));
}
await run('/usr/bin/lipo', [
  '-create',
  resolve(temporary, 'arm64'),
  resolve(temporary, 'x86_64'),
  '-output',
  resolve(destination, '离线启动器'),
]);
await run('/usr/bin/codesign', [
  '--force',
  '--sign',
  '-',
  '--timestamp=none',
  '--identifier',
  'SporeOffline',
  resolve(destination, '离线启动器'),
]);
await run('/usr/bin/codesign', [
  '--verify',
  '--verbose=2',
  resolve(destination, '离线启动器'),
]);
await cp(
  resolve(root, 'offline/启动孢子.command'),
  resolve(destination, '启动孢子.command'),
);
await chmod(resolve(destination, '启动孢子.command'), 0o755);
await chmod(resolve(destination, '离线启动器'), 0o755);
const binary = await readFile(resolve(destination, '离线启动器'));
const manifestPath = resolve(destination, '打包校验.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.launcher = {
  file: '离线启动器',
  system: 'macOS 12 or later',
  architectures: ['arm64', 'x86_64'],
  bytes: binary.length,
  sha256: createHash('sha256').update(binary).digest('hex'),
  origin: 'http://127.0.0.1:49325/',
  sourceFingerprint,
};
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

// Stage an explicit allowlist. Never include dependencies, credentials or unrelated outputs.
const staging = resolve(temporary, '胞子离线版');
await mkdir(staging);
for (const name of [
  '胞子离线版.html',
  '使用说明.txt',
  '打包校验.json',
  '离线启动器',
  '启动孢子.command',
])
  await cp(resolve(destination, name), resolve(staging, name));
const zipped = resolve(temporary, '胞子离线版-Mac.zip');
// zipfile marks Unicode names as UTF-8 and preserves executable permissions.
await run('python3', [
  '-c',
  `import pathlib,sys,zipfile
directory=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2],'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for path in sorted(directory.iterdir()):
        archive.write(path,arcname=directory.name+'/'+path.name)
`,
  staging,
  zipped,
]);
const zipPath = resolve(root, 'outputs/胞子离线版-Mac.zip');
await rename(zipped, zipPath);
console.log(
  JSON.stringify(
    { zip: zipPath, launcher: manifest.launcher, htmlBytes: manifest.bytes },
    null,
    2,
  ),
);
