import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event);

  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, message: '未收到文件' });
  }

  const file = formData.find(f => f.name === 'file');
  if (!file || !file.data) {
    throw createError({ statusCode: 400, message: '未找到文件字段' });
  }

  // Validate type
  if (!file.type || !ALLOWED_TYPES.includes(file.type)) {
    throw createError({ statusCode: 400, message: '仅支持 jpg/png/gif/webp 格式' });
  }

  // Validate size
  if (file.data.length > MAX_SIZE) {
    throw createError({ statusCode: 400, message: '文件大小不能超过 5MB' });
  }

  // Get projectId from query
  const query = getQuery(event);
  const projectId = query.projectId;
  if (!projectId) {
    throw createError({ statusCode: 400, message: '缺少 projectId 参数' });
  }

  // Determine extension from mime type
  const extMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
  };
  const ext = extMap[file.type] || extname(file.filename || '.bin');

  // Save file
  const filename = `${randomUUID()}${ext}`;
  const dir = join(process.cwd(), 'data', 'uploads', 'project-tracker', String(projectId));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), file.data);

  const filePath = `/api/project-tracker/uploads/${projectId}/${filename}`;

  return { filePath, filename };
});
