import type { QuestionDefinition, QuestionNode } from './types';

/** The questions can't form a tree the form can render. */
export class QuestionTreeError extends Error {
  override name = 'QuestionTreeError';
}

/** Content types a table row can have: a row holds one input per column, so it has no children. */
const ROW_CONTENTS = new Set(['NUMBER', 'TEXT', 'ENUM']);

/**
 * Builds the question tree from flat definitions (parent id + order). Depth is arbitrary.
 * Throws a `QuestionTreeError` on duplicate ids, unknown parents, cycles and invalid table rows.
 */
export function buildQuestionTree(definitions: readonly QuestionDefinition[]): QuestionNode[] {
  const nodes = new Map<string, QuestionNode>();
  for (const definition of definitions) {
    if (nodes.has(definition.id)) {
      throw new QuestionTreeError(`Duplicate question id ${definition.id}.`);
    }
    nodes.set(definition.id, { ...definition, children: [] });
  }

  const roots: QuestionNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId === null) {
      roots.push(node);
      continue;
    }
    const parent = nodes.get(node.parentId);
    if (!parent) {
      throw new QuestionTreeError(`${node.id} references unknown parent ${node.parentId}.`);
    }
    parent.children.push(node);
  }

  sortByOrder(roots);
  const reached = flattenQuestions(roots);
  if (reached.length < nodes.size) {
    // Questions in a parent cycle (and their descendants) can't be reached from a root.
    const reachedIds = new Set(reached.map((node) => node.id));
    const cyclic = [...nodes.keys()].filter((id) => !reachedIds.has(id));
    throw new QuestionTreeError(`Questions ${cyclic.join(', ')} form a cycle.`);
  }
  reached.filter((node) => node.content === 'TABLE').forEach(assertValidRows);
  return roots;
}

function sortByOrder(siblings: QuestionNode[]): void {
  siblings.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  for (const node of siblings) sortByOrder(node.children);
}

function assertValidRows(table: QuestionNode): void {
  for (const row of table.children) {
    if (!ROW_CONTENTS.has(row.content) || row.children.length > 0) {
      throw new QuestionTreeError(
        `${row.id} is a row of table ${table.id}, so it must be a number, text or enum question without children.`,
      );
    }
  }
}

/** The question's label, with its unit when it has one: "Percentage of employee turnover (%)". */
export function labelOf(question: QuestionDefinition): string {
  return question.unit ? `${question.labelEn} (${question.unit})` : question.labelEn;
}

/** Every node of the tree, depth first, in display order. */
export function flattenQuestions(roots: readonly QuestionNode[]): QuestionNode[] {
  return roots.flatMap((node) => [node, ...flattenQuestions(node.children)]);
}
