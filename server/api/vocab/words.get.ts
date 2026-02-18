import { eq, sql, like, count } from 'drizzle-orm';
import { vocabWords, vocabProgress, LEARNING_STATUS } from '../../database/schemas/vocab';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);

  const userId = query.userId ? Number(query.userId) : null;
  const filter = (query.filter as string) || 'all';
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 50));
  const search = (query.search as string) || '';

  const offset = (page - 1) * pageSize;

  // 构建基础查询 - 左连接 progress
  if (userId) {
    // 带用户进度的查询
    let whereConditions: any[] = [];

    if (search) {
      whereConditions.push(like(vocabWords.word, `%${search}%`));
    }

    // 状态过滤需要子查询
    if (filter !== 'all') {
      const statusMap: Record<string, string> = {
        unread: LEARNING_STATUS.UNREAD,
        toLearn: LEARNING_STATUS.TO_LEARN,
        learning: LEARNING_STATUS.LEARNING,
        mastered: LEARNING_STATUS.MASTERED,
      };
      const targetStatus = statusMap[filter];

      if (targetStatus === LEARNING_STATUS.UNREAD) {
        // UNREAD = 没有 progress 记录或者 status 为 unread
        const rows = await db.all(sql`
          SELECT w.id, w.rank, w.word,
                 p.id as progress_id, p.learning_status, p.is_read, p.is_mastered,
                 p.first_interacted_at, p.mastered_at, p.note
          FROM vocab_words w
          LEFT JOIN vocab_progress p ON w.id = p.word_id AND p.user_id = ${userId}
          WHERE (p.learning_status IS NULL OR p.learning_status = ${targetStatus})
          ${search ? sql`AND w.word LIKE ${'%' + search + '%'}` : sql``}
          ORDER BY w.rank ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `);

        const totalResult = await db.all(sql`
          SELECT COUNT(*) as count
          FROM vocab_words w
          LEFT JOIN vocab_progress p ON w.id = p.word_id AND p.user_id = ${userId}
          WHERE (p.learning_status IS NULL OR p.learning_status = ${targetStatus})
          ${search ? sql`AND w.word LIKE ${'%' + search + '%'}` : sql``}
        `);

        return {
          words: rows.map(formatWordWithProgress),
          total: (totalResult[0] as any)?.count || 0,
          page,
          pageSize,
        };
      } else {
        // 非 UNREAD 状态必须有 progress 记录
        const rows = await db.all(sql`
          SELECT w.id, w.rank, w.word,
                 p.id as progress_id, p.learning_status, p.is_read, p.is_mastered,
                 p.first_interacted_at, p.mastered_at, p.note
          FROM vocab_words w
          INNER JOIN vocab_progress p ON w.id = p.word_id AND p.user_id = ${userId}
          WHERE p.learning_status = ${targetStatus}
          ${search ? sql`AND w.word LIKE ${'%' + search + '%'}` : sql``}
          ORDER BY w.rank ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `);

        const totalResult = await db.all(sql`
          SELECT COUNT(*) as count
          FROM vocab_words w
          INNER JOIN vocab_progress p ON w.id = p.word_id AND p.user_id = ${userId}
          WHERE p.learning_status = ${targetStatus}
          ${search ? sql`AND w.word LIKE ${'%' + search + '%'}` : sql``}
        `);

        return {
          words: rows.map(formatWordWithProgress),
          total: (totalResult[0] as any)?.count || 0,
          page,
          pageSize,
        };
      }
    }

    // 无状态过滤 - 全部词汇 + 进度
    const rows = await db.all(sql`
      SELECT w.id, w.rank, w.word,
             p.id as progress_id, p.learning_status, p.is_read, p.is_mastered,
             p.first_interacted_at, p.mastered_at, p.note
      FROM vocab_words w
      LEFT JOIN vocab_progress p ON w.id = p.word_id AND p.user_id = ${userId}
      ${search ? sql`WHERE w.word LIKE ${'%' + search + '%'}` : sql``}
      ORDER BY w.rank ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    const totalResult = await db.all(sql`
      SELECT COUNT(*) as count FROM vocab_words w
      ${search ? sql`WHERE w.word LIKE ${'%' + search + '%'}` : sql``}
    `);

    return {
      words: rows.map(formatWordWithProgress),
      total: (totalResult[0] as any)?.count || 0,
      page,
      pageSize,
    };
  }

  // 无用户 - 只返回词汇列表
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
