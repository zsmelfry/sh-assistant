/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 获取日期所在周的周一
 */
export function getWeekStart(d: Date): Date {
  const result = new Date(d);
  const day = result.getDay();
  const diff = day === 0 ? 6 : day - 1; // 周一为起始
  result.setDate(result.getDate() - diff);
  return result;
}

/**
 * 检查某周内是否有打卡记录
 */
export function hasCheckinInWeek(weekStart: Date, dates: Set<string>): boolean {
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    if (dates.has(formatDate(d))) return true;
  }
  return false;
}

/**
 * 检查某月内是否有打卡记录
 */
export function hasCheckinInMonth(year: number, month: number, dates: Set<string>): boolean {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (dates.has(dateStr)) return true;
  }
  return false;
}

/**
 * 获取当前月份 YYYY-MM
 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 校验日期字符串是否为有效日期 (M1: Date parse 回验)
 */
export function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/**
 * 校验月份字符串格式 YYYY-MM (M3)
 */
export function isValidMonth(monthStr: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(monthStr)) return false;
  const [year, month] = monthStr.split('-').map(Number);
  return year >= 1970 && year <= 9999 && month >= 1 && month <= 12;
}

/**
 * 检查周是否与目标月有交集 (B1 修复)
 * 周起始可能在上月，但只要周内有任意一天属于目标月，就算该周与目标月有交集
 */
export function weekOverlapsMonth(weekStart: Date, year: number, month: number): boolean {
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    if (d.getFullYear() === year && d.getMonth() === month) return true;
  }
  return false;
}
