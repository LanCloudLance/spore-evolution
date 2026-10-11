import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cp, mkdir, mkdtemp, readFile, writeFile, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const run = promisify(execFile);
const go = process.env.SPORE_GO || 'go';
const launcherDirectory = resolve(root, 'offline/windows-launcher');
const temporary = await mkdtemp(resolve(tmpdir(), 'spore-windows-build-'));
const staging = resolve(temporary, '胞子离线版-Windows');
const cache = resolve(tmpdir(), 'spore-offline-go-build-cache');
await mkdir(staging);
await mkdir(cache, { recursive: true });
const goEnvironment = {
  ...process.env,
  CGO_ENABLED: '0',
  GOTOOLCHAIN: 'local',
  GOWORK: 'off',
  GOCACHE: cache,
};
const compiler = (
  await run(go, ['env', 'GOVERSION', 'GOROOT'], {
    cwd: launcherDirectory,
    env: goEnvironment,
  })
).stdout.trim().split(/\r?\n/);

await run(process.execPath, [resolve(root, 'scripts/build-offline.mjs')], { cwd: root });
await run(process.execPath, [resolve(root, 'scripts/verify-offline.mjs')], { cwd: root });
const binaryName = '启动孢子.exe';
await run(
  go,
  ['build', '-trimpath', '-buildvcs=false', '-ldflags=-s -w', '-o', resolve(staging, binaryName), '.'],
  {
    cwd: launcherDirectory,
    env: { ...goEnvironment, GOOS: 'windows', GOARCH: 'amd64' },
  },
);
const manifest = JSON.parse(await readFile(resolve(root, 'outputs/offline/打包校验.json'), 'utf8'));
await cp(resolve(root, 'outputs/offline', manifest.entry), resolve(staging, manifest.entry));
const binary = await readFile(resolve(staging, binaryName));
manifest.launcher = {
  file: binaryName,
  system: 'Windows 10 or Windows 11 (64-bit Intel/AMD)',
  architectures: ['amd64'],
  bytes: binary.length,
  sha256: createHash('sha256').update(binary).digest('hex'),
  origin: 'http://127.0.0.1:49325/',
  compiler: compiler[0],
  runtimeInstallationRequired: false,
  verification: 'Cross-compiled on macOS. Shared HTTP server tested on macOS; Windows device execution not yet tested.',
};
await writeFile(resolve(staging, '打包校验.json'), JSON.stringify(manifest, null, 2) + '\n');
const sharedReadme = await readFile(resolve(root, 'outputs/offline/使用说明.txt'), 'utf8');
const noticesStart = sharedReadme.indexOf('\n\n第三方软件许可\n');
if (noticesStart < 0) throw new Error('Missing third-party notices from standalone build');
await writeFile(
  resolve(staging, '使用说明.txt'),
  '\uFEFF' + `孢子 · Windows 离线版（2026-10-11）

适用：Windows 10 / 11，64 位 Intel / AMD 电脑；使用已安装的 Edge 或 Chrome 浏览器。
1. 右键“胞子离线版-Windows.zip” → 全部解压。请先解压整个包，再打开文件夹。
2. 双击“启动孢子.exe”，浏览器会自动打开游戏。无需联网、安装 Node / Python 或管理员权限。
3. 请保留启动时出现的游戏窗口。结束前点击游戏里的保存，然后关闭启动窗口；也可在启动窗口按 Ctrl+C。
4. 如果浏览器没有自动打开，在 Edge / Chrome 输入 http://127.0.0.1:49325/ 。
5. 移动整个文件夹后仍能用同一浏览器继续存档。再次双击同版本启动器会打开已经运行的游戏。
6. 不同版本同时启动会提示端口占用；关闭旧游戏的启动窗口后再试。

操作：左手 WASD，右手 J / K / L / U / I / O；空格冲刺。顶部“键位”有完整说明。
声音：默认静音。点击声音按钮开启；“音量”分别调整音乐和音效。五段最新生境配乐和全部美术已经内嵌。
保存：每 5 秒自动保存，也可点击存档按钮立即保存。请使用普通浏览窗口；清理浏览器数据会丢失存档。
主线与海洋练习分别保存；原 localhost 预览的存档不会自动迁入离线地址。
文件包不包含玩家存档。换电脑、浏览器或浏览器用户后从新存档开始。

游戏本体、素材和配乐均不需要外网；科学资料中的外部网页链接需要联网。
备用单文件“胞子离线版.html”也包含完整游戏。直接用浏览器打开时，存档取决于浏览器对本地文件的支持，与启动器分别保存；推荐使用上面的 exe 启动方式。
已包含：微生物 → 海洋 → 潮间带 → 陆地 → 早期族群，遗传、祖先分支、最新配乐与操作改进；保留现有科技入口。

验证说明：安装包、Windows 可执行文件格式、共享启动逻辑及游戏断网运行已经在 Mac 构建机检查；Windows 实机双击启动与默认浏览器调用尚未测试。
` + sharedReadme.slice(noticesStart),
);
await cp(resolve(compiler[1], 'LICENSE'), resolve(staging, '启动器许可-Go.txt'));
const names = [manifest.entry, binaryName, '使用说明.txt', '打包校验.json', '启动器许可-Go.txt'];
const zipped = resolve(temporary, '胞子离线版-Windows.zip');
await run('python3', [
  '-c',
  `import pathlib,sys,zipfile,json
directory=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2],'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for name in json.loads(sys.argv[3]):
        archive.write(directory/name,arcname=directory.name+'/'+name)
`,
  staging,
  zipped,
  JSON.stringify(names),
]);
const destination = resolve(root, 'outputs/offline-windows');
await mkdir(destination, { recursive: true });
for (const name of names) await cp(resolve(staging, name), resolve(destination, name));
const zipPath = resolve(root, 'outputs/胞子离线版-Windows.zip');
await rename(zipped, zipPath);
console.log(JSON.stringify({
  zip: zipPath,
  zipBytes: (await readFile(zipPath)).length,
  launcher: manifest.launcher,
  htmlBytes: manifest.bytes,
  embeddedAssets: manifest.assets.length,
}, null, 2));
