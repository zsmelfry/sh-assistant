import { existsSync, readFileSync } from 'fs';
import { join, extname } from 'path';

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

export default defineEventHandler((event) => {
  const projectId = getRouterParam(event, 'projectId');
  const filename = getRouterParam(event, 'filename');

  if (!projectId || !filename) {
    throw createError({ statusCode: 400, message: '缺少参数' });
  }

  // Prevent path traversal
  if (!/^\d+$/.test(projectId)) {
    throw createError({ statusCode: 400, message: '无效的 projectId' });
  }
  if (filename.includes('..') || filename.includes('/')) {
    throw createError({ statusCode: 400, message: '无效的文件名' });
  }

  const filePath = join(process.cwd(), 'data', 'uploads', 'project-tracker', projectId, filename);

  if (!existsSync(filePath)) {
    throw createError({ statusCode: 404, message: '文件不存在' });
  }

  const ext = extname(filename).toLowerCase();
  const contentType = MIME_MAP[ext] || 'application/octet-stream';

  setResponseHeader(event, 'Content-Type', contentType);
  setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000');

  return readFileSync(filePath);
});
