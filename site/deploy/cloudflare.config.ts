import { defineConfig } from 'cf/config';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
if (accountId === undefined || accountId === '') {
  throw new Error('CLOUDFLARE_ACCOUNT_ID is not set. Export your Cloudflare account ID before running cf.');
}

export default defineConfig({
  accountId,
  worker: {
    name: 'surface-mapper-site',
    compatibilityDate: '2026-11-04',
    domains: ['surface-mapper.napochaan.dev'],
    workersDev: false,
    previewUrls: true,
    assets: { htmlHandling: 'auto-trailing-slash', notFoundHandling: '404-page' },
  },
});
