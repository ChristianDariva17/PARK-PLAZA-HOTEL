import { collectBundleMetrics } from './bundle-metrics.mjs';

console.log(JSON.stringify(collectBundleMetrics(), null, 2));
