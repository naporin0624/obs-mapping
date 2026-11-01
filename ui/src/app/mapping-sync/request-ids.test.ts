import { describe, expect, it } from 'vitest';
import { createRequestIds, isOwnRequestId, randomNonce } from './request-ids';

describe('request ids', () => {
  it('counts up from 1 under the nonce', () => {
    const next = createRequestIds('ab');
    expect([next(), next(), next()]).toEqual(['ab-1', 'ab-2', 'ab-3']);
  });

  it('draws a different nonce per instance', () => {
    expect(randomNonce()).not.toBe(randomNonce());
  });
});

describe('isOwnRequestId', () => {
  it('matches only ids under the exact nonce', () => {
    expect(isOwnRequestId('ab', 'ab-7')).toBe(true);
    expect(isOwnRequestId('ab', 'abc-7')).toBe(false);
    expect(isOwnRequestId('ab', 'other-1')).toBe(false);
  });
});
