import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/auth/guards/**/*.ts',
        'src/database/idempotency.ts',
        'src/audit/outbox.service.ts',
        'src/events/events.service.ts',
        'src/experiences/experiences.service.ts',
        'src/folios/folio.service.ts',
      ],
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 30,
        statements: 40,
        'src/auth/guards/**/*.ts': {
          lines: 80,
          functions: 80,
          branches: 60,
          statements: 80,
          perFile: true,
        },
        'src/database/idempotency.ts': {
          lines: 80,
          functions: 80,
          branches: 60,
          statements: 80,
          perFile: true,
        },
      },
    },
  },
});
