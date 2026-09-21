import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const BUNDLE_BUDGETS = Object.freeze([
  { key: 'initialJs', label: 'initial JS', maxBytes: 540 * 1024 },
  { key: 'initialCss', label: 'initial CSS', maxBytes: 100 * 1024 },
  { key: 'largestAsyncJs', label: 'largest async JS', maxBytes: 440 * 1024 },
]);

export function collectBundleMetrics(assetsDirectory = fileURLToPath(new URL('../dist/assets/', import.meta.url))) {
  const assets = readdirSync(assetsDirectory)
    .filter((name) => /\.(css|js)$/.test(name))
    .map((name) => {
      const path = resolve(assetsDirectory, name);
      return { name, path, bytes: statSync(path).size };
    });
  const initialJs = assets.find(({ name }) => /^index-[^/]+\.js$/.test(name));
  const initialCss = assets.find(({ name }) => /^index-[^/]+\.css$/.test(name));
  const asyncJs = assets.filter(({ name }) => name.endsWith('.js') && name !== initialJs?.name);
  const largestAsyncJs = asyncJs.sort((left, right) => right.bytes - left.bytes)[0];

  if (!initialJs || !initialCss || !largestAsyncJs) throw new Error('Bundle metrics could not find the expected Vite assets in dist/assets.');

  const describe = (asset) => {
    const gzipBytes = gzipSync(readFileSync(asset.path)).length;
    return {
      name: asset.name,
      bytes: asset.bytes,
      kibibytes: Number((asset.bytes / 1024).toFixed(2)),
      gzipBytes,
      gzipKibibytes: Number((gzipBytes / 1024).toFixed(2)),
    };
  };
  const measurements = { initialJs: describe(initialJs), initialCss: describe(initialCss), largestAsyncJs: describe(largestAsyncJs) };

  return {
    generatedAt: new Date().toISOString(),
    measurements,
    budgets: BUNDLE_BUDGETS.map((budget) => ({
      ...budget,
      actualBytes: measurements[budget.key].bytes,
      passed: measurements[budget.key].bytes <= budget.maxBytes,
    })),
  };
}
