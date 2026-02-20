import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export interface ExtractedArticle {
  title: string;
  author: string | null;
  siteName: string | null;
  content: string;       // HTML 正文
  excerpt: string | null;
  publishedAt: number | null;  // Unix ms
}

/** SSRF 防护：阻止私有 IP 和非 http(s) 协议 */
function validateUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw createError({ statusCode: 400, message: 'URL 格式无效' });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw createError({ statusCode: 400, message: '仅支持 http/https 协议' });
  }

  const hostname = parsed.hostname;

  // 阻止 localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
    throw createError({ statusCode: 400, message: '不允许访问本地地址' });
  }

  // 阻止私有 IP 段
  const privatePatterns = [
    /^10\./,                          // 10.0.0.0/8
    /^172\.(1[6-9]|2\d|3[01])\./,     // 172.16.0.0/12
    /^192\.168\./,                     // 192.168.0.0/16
    /^169\.254\./,                     // link-local
    /^0\./,                            // 0.0.0.0/8
  ];

  for (const pattern of privatePatterns) {
    if (pattern.test(hostname)) {
      throw createError({ statusCode: 400, message: '不允许访问内网地址' });
    }
  }

  return parsed;
}

const MAX_REDIRECTS = 3;

/** 安全抓取 URL（手动处理重定向，防止 SSRF redirect 绕过） */
async function safeFetch(url: URL, remainingRedirects: number = MAX_REDIRECTS): Promise<string> {
  if (remainingRedirects <= 0) {
    throw createError({ statusCode: 502, message: '重定向次数过多' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url.href, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ArticleReader/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'manual',
    });

    clearTimeout(timeout);

    // 手动处理重定向，重新验证目标 URL
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error(`重定向缺少 Location 头 (HTTP ${response.status})`);
      }
      // 解析相对 URL
      const redirectUrl = new URL(location, url.href);
      // 重新验证，阻止重定向到内网
      validateUrl(redirectUrl.href);
      return safeFetch(redirectUrl, remainingRedirects - 1);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error: any) {
    clearTimeout(timeout);
    if (error?.name === 'AbortError') {
      throw createError({ statusCode: 502, message: '抓取超时（15秒）' });
    }
    // Re-throw H3 errors
    if (error?.statusCode) throw error;
    throw createError({
      statusCode: 502,
      message: `抓取失败: ${error?.message || '未知错误'}`,
    });
  }
}

/** 抓取 URL 并提取正文 */
export async function extractArticle(url: string): Promise<ExtractedArticle> {
  const parsedUrl = validateUrl(url);

  // 安全抓取（手动重定向验证）
  const html = await safeFetch(parsedUrl);

  // 解析提取正文
  const dom = new JSDOM(html, { url: parsedUrl.href });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article || !article.content) {
    throw createError({
      statusCode: 422,
      message: '无法提取文章正文，可能是付费墙、JS 渲染页或非文章页面',
    });
  }

  // 尝试提取发布时间
  let publishedAt: number | null = null;
  const metaTime = dom.window.document.querySelector(
    'meta[property="article:published_time"], time[datetime], meta[name="date"]',
  );
  if (metaTime) {
    const dateStr = metaTime.getAttribute('content') || metaTime.getAttribute('datetime');
    if (dateStr) {
      const parsed = Date.parse(dateStr);
      if (!isNaN(parsed)) publishedAt = parsed;
    }
  }

  // 提取站点名称
  const metaSiteName = dom.window.document.querySelector('meta[property="og:site_name"]');
  const siteName = article.siteName
    || metaSiteName?.getAttribute('content')
    || parsedUrl.hostname;

  return {
    title: article.title || '无标题',
    author: article.byline || null,
    siteName,
    content: article.content,
    excerpt: article.excerpt || null,
    publishedAt,
  };
}
