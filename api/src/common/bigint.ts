/** Byte counts come back from the DBs as BigInt; every one fits in a JS number. */
export const num = (v: bigint | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);
