import { describe, expect, it } from 'vitest';
import { EMPTY_RESPONSE, UNKNOWN_ERROR, localizeError } from './localize-error';
import { en } from './messages/en';
import { ja } from './messages/ja';

describe('localizeError', () => {
  it('translates the app-originated sentinels', () => {
    expect([localizeError(ja, EMPTY_RESPONSE), localizeError(en, EMPTY_RESPONSE)]).toEqual([ja.errorEmptyResponse, en.errorEmptyResponse]);
    expect([localizeError(ja, UNKNOWN_ERROR), localizeError(en, UNKNOWN_ERROR)]).toEqual([ja.errorUnknown, en.errorUnknown]);
  });
  it('passes plugin and library text through untouched', () => {
    expect(localizeError(en, 'json: Unexpected token')).toBe('json: Unexpected token');
  });
});
