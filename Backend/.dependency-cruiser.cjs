module.exports = {
  forbidden: [
    {
      name: 'restaurant-inventory-domain-no-infrastructure',
      severity: 'error',
      from: { path: '^src/(?:restaurant/(?:inventory|order)-domain|audit/outbox-domain)\\.ts$' },
      to: { path: '^(src/database|src/audit|src/folios|src/customer|src/auth)|^(?:@nestjs|drizzle-orm|pg|redis)' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
