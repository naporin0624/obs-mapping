export type RequestIds = () => string;

const NONCE_BYTES = 6;

/** Random per sync instance, so two docks on one plugin never produce the same id. */
export const randomNonce = (): string => Array.from(crypto.getRandomValues(new Uint8Array(NONCE_BYTES)), (b) => b.toString(16).padStart(2, '0')).join('');

/** `${nonce}-${n}`, n counting up from 1. */
export const createRequestIds = (nonce: string): RequestIds => {
  let n = 0;
  return () => {
    n = n + 1;
    return `${nonce}-${String(n)}`;
  };
};

/** True for ids minted by the instance with this nonce, whether or not they are still awaited. */
export const isOwnRequestId = (nonce: string, requestId: string): boolean => requestId.startsWith(`${nonce}-`);
