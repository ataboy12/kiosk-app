import 'server-only';

import { getDb, questions } from '@kiosk/db';
import { buildQuestionTree } from '@kiosk/questionnaire';
import { cache } from 'react';

/** The seeded questions as a tree. Read once per request, shared by the page and the processing. */
export const getQuestionTree = cache(async () => {
  const rows = await getDb().select().from(questions);
  return buildQuestionTree(rows);
});
