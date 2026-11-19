/**
 * The block hierarchy, as a parent table: each block type points to the block type it belongs
 * to (`null` for top-level blocks). Supporting a new block type means adding one entry here
 * and, if its values are needed, a field spec in `parse-dsn.ts`.
 */
export const BLOCK_PARENTS = {
  'S20.G00.05': null, // declaration
  'S21.G00.06': null, // company
  'S21.G00.11': 'S21.G00.06', // establishment
  'S21.G00.30': 'S21.G00.11', // employee
  'S21.G00.40': 'S21.G00.30', // contract
  'S21.G00.62': 'S21.G00.40', // contract end
  'S21.G00.50': 'S21.G00.30', // payment
  'S21.G00.51': 'S21.G00.50', // pay period
} as const satisfies Record<string, string | null>;

export type BlockCode = keyof typeof BLOCK_PARENTS;

/** Blocks of `dsn.txt` that v1 doesn't need. They are read past without a warning. */
const SKIPPED_BLOCKS: ReadonlySet<string> = new Set(['S10.G00.00', 'S10.G00.01', 'S10.G00.02']);

export function isSupportedBlock(code: string): code is BlockCode {
  return Object.hasOwn(BLOCK_PARENTS, code);
}

export function isSkippedBlock(code: string): boolean {
  return SKIPPED_BLOCKS.has(code);
}

/** Every block type below `code` in the hierarchy (children, grandchildren, …). */
export const DESCENDANTS: ReadonlyMap<BlockCode, readonly BlockCode[]> = (() => {
  const codes = Object.keys(BLOCK_PARENTS) as BlockCode[];
  const isBelow = (code: BlockCode, ancestor: BlockCode): boolean => {
    const parent = BLOCK_PARENTS[code];
    return parent !== null && (parent === ancestor || isBelow(parent, ancestor));
  };
  return new Map(codes.map((code) => [code, codes.filter((other) => isBelow(other, code))]));
})();
