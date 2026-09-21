import type { Config } from 'drizzle-kit';

export default {
  schema: './backend/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://qit:changeme@localhost:5432/qit',
  },
} satisfies Config;
