import { readFile } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import { closeDb, getDb } from '../client';
import { questions } from '../schema';
import { parseQuestionsCsv } from './parse-questions-csv';

const csvPath = process.env.QUESTIONS_CSV ?? new URL('../../../../questions.csv', import.meta.url);

async function main() {
  const rows = parseQuestionsCsv(await readFile(csvPath, 'utf8'));

  // One statement: Postgres checks the parent foreign key at the end of it, so a child row may
  // come before its parent. Rerunning updates existing questions in place.
  await getDb()
    .insert(questions)
    .values(rows)
    .onConflictDoUpdate({
      target: questions.id,
      set: {
        labelEn: sql`excluded.label_en`,
        labelFr: sql`excluded.label_fr`,
        content: sql`excluded.content`,
        parentId: sql`excluded.parent_id`,
        order: sql`excluded.order`,
        unit: sql`excluded.unit`,
        enumEn: sql`excluded.enum_en`,
        enumFr: sql`excluded.enum_fr`,
      },
    });

  console.log(`Seeded ${rows.length} questions.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
