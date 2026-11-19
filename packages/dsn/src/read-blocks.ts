import {
  BLOCK_PARENTS,
  DESCENDANTS,
  isSkippedBlock,
  isSupportedBlock,
  type BlockCode,
} from './hierarchy';
import type { DsnWarning } from './types';

export interface RawBlock {
  code: BlockCode;
  line: number;
  /** Keyed by rubrique number, e.g. `007`. */
  fields: Map<string, { value: string; line: number }>;
  children: RawBlock[];
}

/** One line of the file: a value (`S21.G00.40.007,'01'`) or a block header (`S21.G00.40,''`). */
interface DsnLine {
  blockCode: string;
  /** `null` on a block header. */
  rubrique: string | null;
  value: string;
}

/** The value match is greedy so a quote inside the value survives. */
const LINE_PATTERN = /^(S\d{2}\.G\d{2}\.\d{2})(?:\.(\d{3}))?,'(.*)'$/;

/**
 * Stage 1: turns the file's text into a tree of blocks, following `BLOCK_PARENTS`.
 * Lines that aren't DSN lines are reported and skipped.
 */
export function readBlocks(text: string, warnings: DsnWarning[]): RawBlock[] {
  const tree = new BlockTreeBuilder(warnings);
  const lines = splitLines(text);

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const content = rawLine.trim();
    if (content === '') return;

    const line = parseLine(content);
    if (line === null) {
      warnings.push({
        code: 'MALFORMED_LINE',
        message: `Line ${lineNumber} is not a DSN line (expected S21.G00.30.001,'value'), so it was ignored.`,
        line: lineNumber,
        value: content.slice(0, 80),
      });
      return;
    }
    tree.add(line, lineNumber);
  });

  return tree.finish();
}

/**
 * A cheap check before storing an upload: the first non-empty line is a DSN line. `parseDsn`
 * remains the full check.
 */
export function looksLikeDsn(text: string): boolean {
  const first = splitLines(text).find((line) => line.trim() !== '');
  return first !== undefined && parseLine(first.trim()) !== null;
}

function splitLines(text: string): string[] {
  return text.replace(/^\uFEFF/, '').split(/\r?\n/);
}

/** Splits a line into its parts, or returns `null` when it isn't a DSN line. */
function parseLine(content: string): DsnLine | null {
  const [, blockCode, rubrique, value] = LINE_PATTERN.exec(content) ?? [];
  if (blockCode === undefined || value === undefined) return null;
  if (rubrique === undefined) return value === '' ? { blockCode, rubrique: null, value } : null;
  return { blockCode, rubrique, value };
}

/**
 * Builds the block tree one line at a time. Each new block attaches to the latest block of its
 * parent type; blocks it can't place are reported and their lines ignored.
 */
class BlockTreeBuilder {
  private readonly roots: RawBlock[] = [];
  /** The latest block of each type: where the next child block attaches. */
  private readonly latest = new Map<BlockCode, RawBlock>();
  private readonly unsupported = new Map<string, { line: number; count: number }>();

  private currentCode: string | null = null;
  /** `null` while inside a block that isn't kept (skipped, unsupported or orphan). */
  private current: RawBlock | null = null;
  private lastRubrique = '';

  constructor(private readonly warnings: DsnWarning[]) {}

  add(line: DsnLine, lineNumber: number): void {
    if (this.startsBlock(line)) {
      this.currentCode = line.blockCode;
      this.current = this.openBlock(line.blockCode, lineNumber);
      this.lastRubrique = '';
    }
    if (line.rubrique === null) return;

    this.lastRubrique = line.rubrique;
    this.current?.fields.set(line.rubrique, { value: line.value, line: lineNumber });
  }

  /** Returns the top-level blocks, after reporting unsupported block types. */
  finish(): RawBlock[] {
    for (const [code, { line, count }] of this.unsupported) {
      this.warnings.push({
        code: 'UNSUPPORTED_BLOCK',
        message: `${count} ${code} block${count > 1 ? 's were' : ' was'} not read: this block type is not supported yet.`,
        line,
      });
    }
    return this.roots;
  }

  /**
   * A block starts on a header line, when the block code changes, or when the rubrique number
   * stops increasing (a block repeated without a header).
   */
  private startsBlock({ blockCode, rubrique }: DsnLine): boolean {
    return rubrique === null || blockCode !== this.currentCode || rubrique <= this.lastRubrique;
  }

  private openBlock(code: string, line: number): RawBlock | null {
    if (isSkippedBlock(code)) return null;
    if (!isSupportedBlock(code)) {
      this.countUnsupported(code, line);
      return null;
    }

    this.forgetLatest(code);
    const parentCode = BLOCK_PARENTS[code];
    const parent = parentCode === null ? null : this.latest.get(parentCode);
    if (parent === undefined) {
      this.warnings.push({
        code: 'ORPHAN_BLOCK',
        message: `Block ${code} appears without a ${parentCode} block before it, so it was ignored.`,
        line,
      });
      return null;
    }

    const block: RawBlock = { code, line, fields: new Map(), children: [] };
    (parent?.children ?? this.roots).push(block);
    this.latest.set(code, block);
    return block;
  }

  /**
   * Forgets the latest block of this type and of every type below it, so a new employee never
   * inherits the previous employee's contract.
   */
  private forgetLatest(code: BlockCode): void {
    this.latest.delete(code);
    for (const descendant of DESCENDANTS.get(code) ?? []) this.latest.delete(descendant);
  }

  private countUnsupported(code: string, line: number): void {
    const seen = this.unsupported.get(code);
    if (seen) seen.count += 1;
    else this.unsupported.set(code, { line, count: 1 });
  }
}
