import { defineConfig } from 'cf/config';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
if (accountId === undefined || accountId === '') {
  throw new Error('CLOUDFLARE_ACCOUNT_ID is not set. Export your Cloudflare account ID before running cf.');
}

export default defineConfig({
  accountId,
  worker: {
    name: 'obs-mapping-site',
    compatibilityDate: '2026-11-04',
    domains: ['obs-mapping.napochaan.dev'],
    workersDev: false,
    previewUrls: false,
    assets: { htmlHandling: 'auto-trailing-slash', notFoundHandling: '404-page' },
  },
});
