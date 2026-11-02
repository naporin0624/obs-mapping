import type { Messages } from './messages';

export const EMPTY_RESPONSE = 'empty response';
export const UNKNOWN_ERROR = 'unknown error';

export const localizeError = (t: Messages, text: string): string => {
  switch (text) {
    case EMPTY_RESPONSE:
      return t.errorEmptyResponse;
    case UNKNOWN_ERROR:
      return t.errorUnknown;
    default:
      return text;
  }
};
