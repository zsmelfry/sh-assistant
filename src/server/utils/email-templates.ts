/**
 * Email templates — Chinese content, minimal HTML, mobile-friendly.
 */

/** Escape HTML special characters to prevent XSS in email content */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .container { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 32px; }
    .btn { display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; margin: 16px 0; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e0e0e0; font-size: 13px; color: #999; }
    .link { word-break: break-all; color: #666; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    ${content}
  </div>
</body>
</html>`;
}

/**
 * Generate invite email HTML.
 * @param inviteUrl Full URL for the invite (e.g., https://app.example.com/invite/abc123)
 * @param expiresHours Number of hours until the invite expires
 */
export function inviteEmailHtml(inviteUrl: string, expiresHours: number): string {
  const safeUrl = escapeHtml(inviteUrl);
  return baseTemplate(`
    <h2 style="margin-top:0;">您收到了一份邀请</h2>
    <p>管理员邀请您加入「个人助手」。请点击下方按钮设置您的账户：</p>
    <p><a href="${safeUrl}" class="btn">设置账户</a></p>
    <p class="link">如果按钮无法点击，请复制此链接到浏览器：<br>${safeUrl}</p>
    <div class="footer">
      <p>此邀请链接将在 ${expiresHours} 小时后过期。</p>
      <p>如果您没有预期收到此邮件，请忽略。</p>
    </div>
  `);
}

/**
 * Generate password reset email HTML.
 * @param resetUrl Full URL for the reset (e.g., https://app.example.com/reset-password/abc123)
 * @param expiresMinutes Number of minutes until the reset link expires
 */
export function resetEmailHtml(resetUrl: string, expiresMinutes: number): string {
  const safeUrl = escapeHtml(resetUrl);
  return baseTemplate(`
    <h2 style="margin-top:0;">重置密码</h2>
    <p>我们收到了重置您密码的请求。请点击下方按钮设置新密码：</p>
    <p><a href="${safeUrl}" class="btn">重置密码</a></p>
    <p class="link">如果按钮无法点击，请复制此链接到浏览器：<br>${safeUrl}</p>
    <div class="footer">
      <p>此链接将在 ${expiresMinutes} 分钟后过期。</p>
      <p>如果您没有请求重置密码，请忽略此邮件，您的密码不会被更改。</p>
    </div>
  `);
}
