import 'server-only';

import { count, getDb, questions } from '@kiosk/db';

export async function countQuestions() {
  const [row] = await getDb().select({ value: count() }).from(questions);
  return row?.value ?? 0;
}
