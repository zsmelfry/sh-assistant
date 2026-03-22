import { useDB } from '~/server/database';
import { sql, like, count } from 'drizzle-orm';
import { vocabWords, LEARNING_STATUS } from '../../database/schemas/vocab';

const STATUS_MAP: Record<string, string> = {
  unread: LEARNING_STATUS.UNREAD,
  toLearn: LEARNING_STATUS.TO_LEARN,
  learning: LEARNING_STATUS.LEARNING,
  mastered: LEARNING_STATUS.MASTERED,
};

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const query = getQuery(event);

  const userId = query.userId ? Number(query.userId) : null;
  const filter = (query.filter as string) || 'all';
  const { page, limit: pageSize, offset } = parsePagination(query, { defaultLimit: 50, pageSizeKey: 'pageSize' });
  const search = (query.search as string) || '';

  // 无用户 - 只返回词汇列表（不含 progress）
  if (!userId) {
    const where = search ? like(vocabWords.word, `%${search}%`) : undefined;
    const [words, totalResult] = await Promise.all([
      db.select().from(vocabWords).where(where).orderBy(vocabWords.rank).limit(pageSize).offset(offset),
      db.select({ count: count() }).from(vocabWords).where(where),
    ]);
    return {
      words: words.map(w => ({ ...w, progress: null })),
      total: totalResult[0]?.count || 0,
      page,
      pageSize,
    };
  }

  // 有用户 - 动态构建 SQL
  const targetStatus = filter !== 'all' ? STATUS_MAP[filter] : null;

  // JOIN 类型：UNREAD 或无过滤用 LEFT JOIN，其他状态用 INNER JOIN
  const joinType = (!targetStatus || targetStatus === LEARNING_STATUS.UNREAD) ? 'LEFT' : 'INNER';

  // WHERE 条件片段
  const conditions: ReturnType<typeof sql>[] = [];
  if (targetStatus === LEARNING_STATUS.UNREAD) {
    conditions.push(sql`(p.learning_status IS NULL OR p.learning_status = ${targetStatus})`);
  } else if (targetStatus) {
    conditions.push(sql`p.learning_status = ${targetStatus}`);
  }
  if (search) {
    conditions.push(sql`w.word LIKE ${'%' + search + '%'}`);
  }

  const whereClause = conditions.length > 0
    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
    : sql``;

  const joinClause = joinType === 'LEFT'
    ? sql`LEFT JOIN vocab_progress p ON w.id = p.word_id AND p.user_id = ${userId}`
    : sql`INNER JOIN vocab_progress p ON w.id = p.word_id AND p.user_id = ${userId}`;

  const [rows, totalResult] = await Promise.all([
    db.all(sql`
      SELECT w.id, w.rank, w.word,
             p.id as progress_id, p.learning_status, p.is_read, p.is_mastered,
             p.first_interacted_at, p.mastered_at, p.note
      FROM vocab_words w
      ${joinClause}
      ${whereClause}
      ORDER BY w.rank ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `),
    db.all(sql`
      SELECT COUNT(*) as count
      FROM vocab_words w
      ${joinClause}
      ${whereClause}
    `),
  ]);

  return {
    words: rows.map(formatWordWithProgress),
    total: (totalResult[0] as any)?.count || 0,
    page,
    pageSize,
  };
});

function formatWordWithProgress(row: any) {
  return {
    id: row.id,
    rank: row.rank,
    word: row.word,
    progress: row.progress_id ? {
      id: row.progress_id,
      learningStatus: row.learning_status,
      isRead: !!row.is_read,
      isMastered: !!row.is_mastered,
      firstInteractedAt: row.first_interacted_at,
      masteredAt: row.mastered_at,
      note: row.note,
    } : null,
  };
}
