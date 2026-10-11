import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import assert from 'node:assert/strict';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const directory = resolve(root, 'outputs/offline');
const manifest = JSON.parse(
  await readFile(resolve(directory, '打包校验.json'), 'utf8'),
);
const bytes = await readFile(resolve(directory, manifest.entry));
const html = bytes.toString('utf8');
assert.equal(bytes.length, manifest.bytes);
assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sha256);
assert.ok(html.includes("connect-src 'none'"));
assert.ok(html.includes("default-src 'none'"));
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
assert.equal(scripts.length, 1);
assert.ok(!/<script\b[^>]*\bsrc=/i.test(html));
assert.ok(!/<link\b[^>]*\bhref=["'](?:https?:|\/)/i.test(html));
new Script(scripts[0][1]);
const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
assert.equal(styles.length, 1);
assert.ok(!/@import\s/i.test(styles[0][1]));
assert.ok(!/url\(\s*["']?(?:https?:|\/)/i.test(styles[0][1]));
const embedded = new Set(
  [...html.matchAll(/data:[\w/+.-]+;base64,([A-Za-z\d+/=]+)/g)].map((match) =>
    createHash('sha256').update(Buffer.from(match[1], 'base64')).digest('hex'),
  ),
);
for (const asset of manifest.assets) {
  const current = await readFile(resolve(root, 'public', '.' + asset.url));
  assert.equal(
    createHash('sha256').update(current).digest('hex'),
    asset.sha256,
    `Current asset changed: ${asset.url}`,
  );
  assert.ok(embedded.has(asset.sha256), `Asset was not embedded: ${asset.url}`);
}
assert.ok(scripts[0][1].includes('hashchange'));
assert.ok(!scripts[0][1].includes('location.assign('));
console.log(
  JSON.stringify(
    {
      status: 'passed',
      bytes: bytes.length,
      embeddedAssets: manifest.assets.length,
      singleInlineScript: true,
      inlineCSS: true,
      networkBlockedByCSP: true,
      scriptSyntax: 'valid',
      sha256: manifest.sha256,
    },
    null,
    2,
  ),
);
