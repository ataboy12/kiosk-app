import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { Block } from './layout';

/** Word heading styles by block level, from 1. Word has six: deeper levels use the sixth. */
const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
] as const;

/** Packs the blocks into a `.docx` file. */
export function renderDocx(title: string, blocks: readonly Block[]): Promise<ArrayBuffer> {
  const document = new Document({
    title,
    creator: 'Kiosk',
    sections: [{ children: blocks.flatMap(renderBlock) }],
  });
  return Packer.toArrayBuffer(document);
}

function renderBlock(block: Block): (Paragraph | Table)[] {
  switch (block.kind) {
    case 'title':
      return [new Paragraph({ heading: HeadingLevel.TITLE, children: textRuns(block.text) })];
    case 'paragraph':
      return [new Paragraph({ children: textRuns(block.text) })];
    case 'heading':
      return [
        new Paragraph({ heading: headingStyle(block.level), children: textRuns(block.text) }),
      ];
    case 'answer':
      return [
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({ text: `${block.label}: `, bold: true }),
            ...textRuns(block.value),
          ],
        }),
      ];
    case 'table':
      // An empty paragraph keeps a heading that follows the table from touching it.
      return [renderTable(block.header, block.rows), new Paragraph({})];
  }
}

/** The Word heading style of a heading `level` (from 1). */
export function headingStyle(level: number) {
  return HEADING_LEVELS[level - 1] ?? HeadingLevel.HEADING_6;
}

function renderTable(header: readonly string[], rows: readonly string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true, // Repeated at the top of each page.
        children: header.map((text) => cell(text, true)),
      }),
      ...rows.map((row) => new TableRow({ children: row.map((text) => cell(text, false)) })),
    ],
  });
}

function cell(text: string, bold: boolean): TableCell {
  return new TableCell({ children: [new Paragraph({ children: textRuns(text, bold) })] });
}

/** Keeps the line breaks of a multi-line text answer. */
function textRuns(text: string, bold = false): TextRun[] {
  return text
    .split('\n')
    .map((line, i) => new TextRun({ text: line, bold, break: i > 0 ? 1 : undefined }));
}
