import { collectBundleMetrics } from './bundle-metrics.mjs';

const report = collectBundleMetrics();
let failed = false;
for (const budget of report.budgets) {
  const measurement = report.measurements[budget.key];
  const format = (bytes) => `${(bytes / 1024).toFixed(2)} KiB`;
  console.log(`${budget.passed ? 'PASS' : 'FAIL'} ${budget.label}: ${measurement.name} ${format(measurement.bytes)} raw, ${format(measurement.gzipBytes)} gzip (budget ${format(budget.maxBytes)} raw)`);
  failed ||= !budget.passed;
}

if (failed) process.exit(1);
