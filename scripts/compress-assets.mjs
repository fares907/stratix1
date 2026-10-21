// Runs after `vite build`: writes .br and .gz siblings for every compressible
// file in dist/public. Compressing once here, at the maximum level, costs a
// few seconds per deploy instead of CPU on every request, and Brotli at level
// 11 is ~15-20% smaller than the gzip a proxy applies on the fly.
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const root = path.resolve(import.meta.dirname, "..", "dist", "public");
const COMPRESSIBLE = /\.(js|mjs|css|html|svg|json|txt|xml|webmanifest)$/;
const MIN_BYTES = 1024;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

let raw = 0;
let brotli = 0;
let count = 0;
for await (const file of walk(root)) {
  if (!COMPRESSIBLE.test(file) || (await stat(file)).size < MIN_BYTES) continue;
  const data = await readFile(file);
  const br = brotliCompressSync(data, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
      [constants.BROTLI_PARAM_SIZE_HINT]: data.length,
    },
  });
  await writeFile(`${file}.br`, br);
  await writeFile(`${file}.gz`, gzipSync(data, { level: 9 }));
  raw += data.length;
  brotli += br.length;
  count += 1;
}

console.log(
  `compressed ${count} files: ${(raw / 1024).toFixed(0)} KB -> ${(brotli / 1024).toFixed(0)} KB brotli`,
);
