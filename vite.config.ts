import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:4010' },
  },
  test: {
    env: {
      DATABASE_URL: 'postgres://unused@localhost/unused',
      ADMIN_EMAIL: 'admin@test.local',
      ADMIN_PASSWORD: 'test-password',
      SESSION_SECRET: 'test-secret',
    },
  },
});
