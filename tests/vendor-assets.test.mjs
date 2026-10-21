import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('self-hosted executable dependencies match their recorded hashes', async () => {
  const root = new URL('../js/vendor/', import.meta.url);
  const sources = JSON.parse(await readFile(new URL('sources.json', root)));
  for (const [file, metadata] of Object.entries(sources)) {
    for (const [relative, expected] of Object.entries(metadata.files || { '': metadata.sha256 })) {
      const bytes = await readFile(new URL(relative ? `${file}/${relative}` : file, root));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, `${file}/${relative}`);
    }
  }
});
