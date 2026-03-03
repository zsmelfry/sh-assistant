import { eq, and, isNotNull, lte } from 'drizzle-orm';
import { useDB } from '~/server/database';
import {
  ptProjects, ptChecklistItems, ptMilestones, ptNotifications,
} from '~/server/database/schema';
import { execSync } from 'child_process';

function sendMacNotification(title: string, message: string) {
  try {
    const safeTitle = title.replace(/"/g, '\\"');
    const safeMsg = message.replace(/"/g, '\\"');
    const script = `display notification "${safeMsg}" with title "${safeTitle}"`;
    execSync(`osascript -e '${script}'`);
  } catch {
    // Silently fail if notification can't be sent
  }
}

export async function checkAndSendNotifications() {
  const db = useDB();
  const now = Date.now();

  // 1. Project-level reminders
  const projects = await db.select({
    id: ptProjects.id,
    title: ptProjects.title,
    reminderAt: ptProjects.reminderAt,
  }).from(ptProjects)
    .where(and(
      isNotNull(ptProjects.reminderAt),
      lte(ptProjects.reminderAt, now),
    ));

  for (const p of projects) {
    await sendIfNotSent(db, 'project', p.id, p.reminderAt!, now, () => {
      sendMacNotification('事项追踪 - 提醒', `「${p.title}」提醒时间到了`);
    });
    // Clear the reminder after sending
    await db.update(ptProjects).set({ reminderAt: null }).where(eq(ptProjects.id, p.id));
  }

  // 2. Checklist item reminders
  const items = await db.select({
    id: ptChecklistItems.id,
    content: ptChecklistItems.content,
    reminderAt: ptChecklistItems.reminderAt,
  }).from(ptChecklistItems)
    .where(and(
      isNotNull(ptChecklistItems.reminderAt),
      lte(ptChecklistItems.reminderAt, now),
      eq(ptChecklistItems.isCompleted, false),
    ));

  for (const item of items) {
    await sendIfNotSent(db, 'checklist', item.id, item.reminderAt!, now, () => {
      sendMacNotification('事项追踪 - 任务提醒', `「${item.content}」提醒时间到了`);
    });
    await db.update(ptChecklistItems).set({ reminderAt: null }).where(eq(ptChecklistItems.id, item.id));
  }

  // 3. Milestone reminders
  const milestones = await db.select({
    id: ptMilestones.id,
    title: ptMilestones.title,
    reminderAt: ptMilestones.reminderAt,
  }).from(ptMilestones)
    .where(and(
      isNotNull(ptMilestones.reminderAt),
      lte(ptMilestones.reminderAt, now),
    ));

  for (const m of milestones) {
    await sendIfNotSent(db, 'milestone', m.id, m.reminderAt!, now, () => {
      sendMacNotification('事项追踪 - 里程碑提醒', `「${m.title}」提醒时间到了`);
    });
    await db.update(ptMilestones).set({ reminderAt: null }).where(eq(ptMilestones.id, m.id));
  }
}

async function sendIfNotSent(
  db: any,
  targetType: string,
  targetId: number,
  reminderAt: number,
  now: number,
  sendFn: () => void,
) {
  const existing = await db.select({ id: ptNotifications.id })
    .from(ptNotifications)
    .where(and(
      eq(ptNotifications.targetType, targetType),
      eq(ptNotifications.targetId, targetId),
      eq(ptNotifications.reminderAt, reminderAt),
    ))
    .limit(1);

  if (existing.length > 0) return;

  sendFn();

  await db.insert(ptNotifications).values({
    targetType,
    targetId,
    reminderAt,
    sentAt: now,
  });
}
