import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const destination = resolve(root, 'outputs/offline');
const mime = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json',
};
const assets = {};
const inventory = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (entry.isFile() && !entry.name.startsWith('.')) {
      const url =
        '/' + relative(resolve(root, 'public'), path).split('\\').join('/');
      const bytes = await readFile(path);
      if (!mime[extname(path)])
        throw new Error(`Unsupported offline asset: ${url}`);
      assets[url] =
        `data:${mime[extname(path)]};base64,${bytes.toString('base64')}`;
      inventory.push({
        url,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
  }
}
await collect(resolve(root, 'public'));

const mediaModule = 'virtual:spore-offline-media';
const edits = new Map([
  [
    'app/game/audio.ts',
    [
      [
        '`/audio/life/${habitat}.mp3`',
        'offlineAsset(`/audio/life/${habitat}.mp3`)',
      ],
      [
        '`/audio/life/${this.habitat}.mp3`',
        'offlineAsset(`/audio/life/${this.habitat}.mp3`)',
      ],
    ],
  ],
  [
    'app/game/life-art.ts',
    [
      [
        "'/assets/life-terrain-atlas.png?art=1'",
        "offlineAsset('/assets/life-terrain-atlas.png')",
      ],
    ],
  ],
  [
    'app/game/CityMap.tsx',
    [
      [
        'href="/assets/life-terrain-atlas.png"',
        "href={offlineAsset('/assets/life-terrain-atlas.png')}",
      ],
    ],
  ],
  [
    'app/game/Game.tsx',
    [
      [
        'src="/assets/paramecium.jpg"',
        "src={offlineAsset('/assets/paramecium.jpg')}",
      ],
      ["window.location.assign('/')", "window.location.hash = 'main'"],
      ["window.location.assign('/ocean')", "window.location.hash = 'ocean'"],
    ],
  ],
]);
const transformed = new Set();
const offlineMedia = {
  name: 'spore-offline-media',
  enforce: 'pre',
  resolveId(id) {
    if (id === mediaModule) return '\0' + mediaModule;
  },
  load(id) {
    if (id !== '\0' + mediaModule) return;
    return `const assets=${JSON.stringify(assets)};export function offlineAsset(path){const value=assets[path.split('?')[0]];if(!value)throw new Error('Missing offline asset: '+path);return value;}`;
  },
  transform(source, id) {
    const path = relative(root, id.split('?')[0]).split('\\').join('/');
    const replacements = edits.get(path);
    if (!replacements) return;
    let code = source;
    for (const [before, after] of replacements) {
      if (!code.includes(before))
        throw new Error(`Offline adapter needs updating: ${path}: ${before}`);
      code = code.split(before).join(after);
    }
    transformed.add(path);
    return {
      code: `import { offlineAsset } from '${mediaModule}';\n` + code,
      map: null,
    };
  },
};

const output = await build({
  configFile: false,
  root,
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [offlineMedia, react()],
  resolve: {
    alias: [
      { find: /^next\/link$/, replacement: resolve(root, 'offline/link.tsx') },
      {
        find: /^next\/image$/,
        replacement: resolve(root, 'offline/image.tsx'),
      },
      { find: /^@\/(.*)$/, replacement: resolve(root, '$1') },
    ],
  },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: {
    write: false,
    sourcemap: false,
    cssCodeSplit: false,
    lib: {
      entry: resolve(root, 'offline/entry.tsx'),
      name: 'SporeOffline',
      formats: ['iife'],
    },
  },
});
for (const path of edits.keys())
  if (!transformed.has(path))
    throw new Error(`Offline adapter was not applied: ${path}`);
const files = (Array.isArray(output) ? output : [output]).flatMap(
  (result) => result.output,
);
const scripts = files.filter((file) => file.type === 'chunk');
const styles = files.filter(
  (file) => file.type === 'asset' && file.fileName.endsWith('.css'),
);
if (scripts.length !== 1 || styles.length !== 1 || files.length !== 2)
  throw new Error(
    'Offline build must contain one script and one stylesheet, without external chunks',
  );
const safeScript = scripts[0].code.replace(/<\/script/gi, '<\\/script');
const safeStyle = String(styles[0].source).replace(/<\/style/gi, '<\\/style');
const html = `<!doctype html><html lang="zh-CN" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>孢子 · 离线版</title><link rel="icon" href="${assets['/favicon.svg']}"><style>${safeStyle}</style></head><body><div id="root"></div><noscript>请在浏览器中允许此本地游戏运行 JavaScript。</noscript><script>${safeScript}</script></body></html>`;
await mkdir(destination, { recursive: true });
const filename = '胞子离线版.html';
await writeFile(resolve(destination, filename), html);
const manifest = {
  title: '孢子离线版',
  builtAt: new Date().toISOString(),
  entry: filename,
  bytes: Buffer.byteLength(html),
  sha256: createHash('sha256').update(html).digest('hex'),
  network: 'No game network requests permitted by the embedded CSP',
  assets: inventory,
};
await writeFile(
  resolve(destination, '打包校验.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
const thirdPartyNotices = (
  await Promise.all(
    [
      'react/LICENSE',
      'react-dom/LICENSE',
      'scheduler/LICENSE',
      '@base-ui/react/LICENSE',
      '@base-ui/utils/LICENSE',
      'lucide-react/LICENSE',
      'clsx/license',
      'class-variance-authority/LICENSE',
      'tailwind-merge/LICENSE.md',
      'tailwindcss/LICENSE',
      'tw-animate-css/LICENSE',
      'shadcn/LICENSE.md',
    ].map(
      async (path) =>
        `\n--- ${path} ---\n${await readFile(resolve(root, 'node_modules', path), 'utf8')}`,
    ),
  )
).join('\n');
await writeFile(
  resolve(destination, '使用说明.txt'),
  `孢子 · 离线版（2026-10-11）

Mac 推荐启动方式（macOS 12 及以上，Apple 芯片与 Intel）：
1. 完整解压“胞子离线版-Mac.zip”。
2. 双击“启动孢子.command”，浏览器会自动打开游戏。无需联网或安装 Node / Python。
3. 请保留启动时的终端窗口。结束前点击游戏中的保存；关闭终端窗口可结束启动器。
4. 启动器仅使用这台电脑的 127.0.0.1:49325 地址。同一浏览器再次启动可继续存档，移动整个文件夹也不改变这个地址。
5. 不要同时开启不同版本的启动器。端口被旧版本占用时，关闭旧终端窗口再启动。

操作：左手 WASD，右手 J / K / L / U / I / O；空格冲刺。顶部“键位”有完整说明。
声音：默认静音。点击声音按钮开启；“音量”分别调整音乐和音效。五段生境配乐及全部美术已经内嵌。
保存：每 5 秒自动保存，也可点击存档按钮立即保存。请使用普通浏览窗口；清理浏览器数据会丢失本机存档。
主线与海洋练习分别保存。原 localhost 在线预览的存档不会自动迁入这个离线地址。
文件包不包含玩家存档，发送给另一台电脑后从新存档开始。

单文件备用方式：用桌面浏览器打开“胞子离线版.html”，无需启动器。此方式的存档取决于浏览器对本地文件的支持，并与启动器地址分别保存；请保持文件名和位置不变。本轮原生验证以 Mac 启动器 + Chromium 为准，未验证 Windows 或 Safari 的本地文件保存。
游戏中两处科学资料外部链接需要联网；游戏本体、素材及配乐不需要外网。

已包含：微生物 → 海洋 → 潮间带 → 陆地 → 早期族群，遗传、祖先分支、最新配乐与操作改进；保留现有科技入口。
` +
    '\n\n第三方软件许可\n' +
    thirdPartyNotices,
);
console.log(
  JSON.stringify(
    {
      entry: resolve(destination, filename),
      bytes: manifest.bytes,
      assets: inventory.length,
      sha256: manifest.sha256,
    },
    null,
    2,
  ),
);
