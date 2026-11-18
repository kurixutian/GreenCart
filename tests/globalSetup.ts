import { request } from '@playwright/test';

export default async function globalSetup() {
  const ctx = await request.newContext({ baseURL: 'http://localhost:5174' });
  try {
    const loginRes = await ctx.post('/api/auth/login', {
      data: { username: 'admin_qcu', password: 'admin123' },
    });
    if (loginRes.ok()) {
      const data = (await loginRes.json()) as { csrfToken?: string };
      await ctx.post('/api/db/reset', {
        headers: data.csrfToken ? { 'X-CSRF-Token': data.csrfToken } : {},
      });
    }
  } finally {
    await ctx.dispose();
  }
}
