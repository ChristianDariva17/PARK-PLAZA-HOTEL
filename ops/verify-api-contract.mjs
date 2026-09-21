const baseUrl = (process.env.API_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const response = await fetch(`${baseUrl}/api/docs-json`);

if (!response.ok) {
  throw new Error(`OpenAPI endpoint returned HTTP ${response.status}`);
}

const document = await response.json();
const requiredPaths = [
  '/api/v1/health/live',
  '/api/v1/health/ready',
  '/api/v1/auth/login',
  '/api/v1/documents/contracts',
  '/api/v1/properties/{propertyId}/experiences',
];
const compatibilityPaths = [
  '/api/health/live',
  '/api/health/ready',
];
const requiredSchemas = ['CreateContractDto', 'TransitionContractDto', 'CreateExperienceDto'];

if (!String(document.openapi || '').startsWith('3.')) {
  throw new Error('OpenAPI document is not version 3');
}

for (const path of requiredPaths) {
  if (!document.paths?.[path]) throw new Error(`OpenAPI path is missing: ${path}`);
}
for (const path of compatibilityPaths) {
  if (!document.paths?.[path]) throw new Error(`Legacy compatibility path is missing: ${path}`);
}
for (const schema of requiredSchemas) {
  if (!document.components?.schemas?.[schema]) throw new Error(`OpenAPI schema is missing: ${schema}`);
}

const experienceList = document.paths['/api/v1/properties/{propertyId}/experiences'].get;
const permissions = experienceList?.['x-required-permissions'];
if (!Array.isArray(permissions) || !permissions.includes('experiences.read')) {
  throw new Error('OpenAPI permission extension is missing for experience listing');
}

console.log(JSON.stringify({
  status: 'ok',
  openapi: document.openapi,
  paths: Object.keys(document.paths).length,
  schemas: Object.keys(document.components?.schemas || {}).length,
  requiredPaths,
}));
