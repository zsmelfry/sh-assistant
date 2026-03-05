import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { songs } from '~/server/database/schema';
import { resolveProvider } from '~/server/utils/llm-provider';
import { parseLlmJsonArray } from '~/server/utils/parse-llm-json';
import { LlmError } from '~/server/lib/llm';
import { requireNumericParam } from '~/server/utils/handler-helpers';

interface MelodyNote {
  note: string;
  duration: number;
  time: number;
}

const SYSTEM_PROMPT = `你是一位音乐编曲专家。你的任务是将一首歌曲的主旋律简化为16-32个音符的钢琴谱。

输出要求：
- 使用科学记谱法（如 C4, D4, E4），C4 = 中央 do
- 音符范围限制在 C2-B6
- 每个音符包含: note(音名), duration(持续时间/秒), time(开始时间/秒)
- 选取歌曲中最具辨识度的旋律片段（通常是副歌或主题句）
- 节奏要尽量还原原曲的感觉
- duration 通常在 0.2-1.0 秒之间
- 总时长控制在 10-20 秒

严格输出 JSON 数组格式（不要用 markdown 代码块包裹）：
[
  { "note": "C4", "duration": 0.5, "time": 0 },
  { "note": "E4", "duration": 0.5, "time": 0.5 },
  ...
]`;

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '歌曲');
  const db = useDB();

  const [song] = await db.select().from(songs)
    .where(eq(songs.id, id)).limit(1);

  if (!song) {
    throw createError({ statusCode: 404, message: '歌曲不存在' });
  }

  const body = await readBody(event);
  const { providerId } = body || {};

  const userPrompt = [
    `歌名：${song.title}`,
    `歌手：${song.artist}`,
    song.lyrics ? `歌词片段：\n${song.lyrics.slice(0, 1000)}` : '',
    '请生成这首歌最经典旋律片段的钢琴音符序列。',
  ].filter(Boolean).join('\n');

  const { provider } = await resolveProvider(db, providerId);

  let fullContent = '';
  try {
    const stream = provider.chatStream(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.3, maxTokens: 2000, timeout: 60000 },
    );
    for await (const chunk of stream) {
      fullContent += chunk;
    }
  } catch (error) {
    const message = error instanceof LlmError
      ? error.message
      : (error instanceof Error ? error.message : '旋律生成失败');
    throw createError({ statusCode: 502, message });
  }

  let melody: MelodyNote[];
  try {
    melody = parseLlmJsonArray<MelodyNote>(fullContent);
  } catch {
    throw createError({ statusCode: 502, message: '旋律解析失败，AI 返回格式异常' });
  }

  // Validate and clamp
  melody = melody.filter(n =>
    typeof n.note === 'string' &&
    typeof n.duration === 'number' &&
    typeof n.time === 'number',
  ).slice(0, 64);

  // Save to DB
  const now = Date.now();
  await db.update(songs)
    .set({ notes: JSON.stringify(melody), updatedAt: now })
    .where(eq(songs.id, id));

  return { melody };
});
