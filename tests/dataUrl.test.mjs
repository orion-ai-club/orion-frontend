import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../utils/dataUrl.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
const { dataUrlToBlob } = await import(moduleUrl);

test('decodes base64 image data URLs without using fetch', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';
  const url = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const blob = dataUrlToBlob(url);

  assert.equal(blob.type, 'image/svg+xml');
  assert.equal(await blob.text(), svg);
});

test('decodes URI-encoded SVG data URLs', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="1" cy="1" r="1"/></svg>';
  const blob = dataUrlToBlob(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

  assert.equal(blob.type, 'image/svg+xml');
  assert.equal(await blob.text(), svg);
});

test('rejects non-data and malformed URLs', () => {
  assert.throws(() => dataUrlToBlob('https://example.com/icon.svg'), /Expected an inline data URL/);
  assert.throws(() => dataUrlToBlob('data:image/png;base64'), /Malformed data URL/);
});
