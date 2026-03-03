import { eq, and, inArray, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import {
  ptProjects, ptChecklistItems, ptMilestones, ptNotifications,
} from '~/server/database/schema';
import { execSync } from 'child_process';

function sendMacNotification(title: string, message: string) {
  try {
    // Escape special characters for AppleScript
    const safeTitle = title.replace(/"/g, '\\"');
    const safeMsg = message.replace(/"/g, '\\"');
    const script = `display notification "${safeMsg}" with title "${safeTitle}"`;
    execSync(`osascript -e '${script}'`);
  } catch {
    // Silently fail if notification can't be sent
  }
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function checkAndSendNotifications() {
  const db = useDB();
  const today = getToday();
  const tomorrow = getTomorrow();
  const now = Date.now();

  const activeStatuses = ['todo', 'in_progress', 'blocked'];

  // 1. Project due date reminders
  const projects = await db.select({
    id: ptProjects.id,
    title: ptProjects.title,
    dueDate: ptProjects.dueDate,
  }).from(ptProjects)
    .where(inArray(ptProjects.status, activeStatuses));

  for (const p of projects) {
    if (!p.dueDate) continue;

    if (p.dueDate === today) {
      await sendIfNotSent(db, 'project', p.id, 'day_of', now, () => {
        sendMacNotification('事项追踪 - 今日截止', `「${p.title}」今天到期`);
      });
    } else if (p.dueDate === tomorrow) {
      await sendIfNotSent(db, 'project', p.id, 'day_before', now, () => {
        sendMacNotification('事项追踪 - 明日截止', `「${p.title}」明天到期`);
      });
    }
  }

  // 2. Checklist item due date reminders
  const items = await db.select({
    id: ptChecklistItems.id,
    content: ptChecklistItems.content,
    dueDate: ptChecklistItems.dueDate,
    projectId: ptChecklistItems.projectId,
  }).from(ptChecklistItems)
    .innerJoin(ptProjects, eq(ptChecklistItems.projectId, ptProjects.id))
    .where(and(
      eq(ptChecklistItems.isCompleted, false),
      inArray(ptProjects.status, activeStatuses),
    ));

  for (const item of items) {
    if (!item.dueDate) continue;

    if (item.dueDate === today) {
      await sendIfNotSent(db, 'checklist', item.id, 'day_of', now, () => {
        sendMacNotification('事项追踪 - 任务到期', `「${item.content}」今天到期`);
      });
    }
  }

  // 3. Milestone due date reminders
  const milestones = await db.select({
    id: ptMilestones.id,
    title: ptMilestones.title,
    dueDate: ptMilestones.dueDate,
    projectId: ptMilestones.projectId,
  }).from(ptMilestones)
    .innerJoin(ptProjects, eq(ptMilestones.projectId, ptProjects.id))
    .where(inArray(ptProjects.status, activeStatuses));

  for (const m of milestones) {
    if (!m.dueDate) continue;

    if (m.dueDate === today) {
      await sendIfNotSent(db, 'milestone', m.id, 'day_of', now, () => {
        sendMacNotification('事项追踪 - 里程碑到期', `「${m.title}」今天到期`);
      });
    } else if (m.dueDate === tomorrow) {
      await sendIfNotSent(db, 'milestone', m.id, 'day_before', now, () => {
        sendMacNotification('事项追踪 - 里程碑即将到期', `「${m.title}」明天到期`);
      });
    }
  }
}

async function sendIfNotSent(
  db: any,
  targetType: string,
  targetId: number,
  remindType: string,
  now: number,
  sendFn: () => void,
) {
  // Check if already sent
  const existing = await db.select({ id: ptNotifications.id })
    .from(ptNotifications)
    .where(and(
      eq(ptNotifications.targetType, targetType),
      eq(ptNotifications.targetId, targetId),
      eq(ptNotifications.remindType, remindType),
    ))
    .limit(1);

  if (existing.length > 0) return;

  sendFn();

  await db.insert(ptNotifications).values({
    targetType,
    targetId,
    remindType,
    sentAt: now,
  });
}
