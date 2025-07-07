import { pgTable, text, jsonb, timestamp, uuid } from 'drizzle-orm/pg-core';

export const doadTable = pgTable('doad', {
  id: uuid('id').primaryKey().defaultRandom(),
  textChunk: text('text_chunk').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  doadNumber: text('doad_number'),
});
