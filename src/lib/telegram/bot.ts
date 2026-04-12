/**
 * Telegram Bot API helpers.
 *
 * All calls go directly to api.telegram.org using the native fetch API —
 * no third-party library needed in a Next.js environment.
 */

const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// ── Low-level API wrapper ─────────────────────────────────────────────────

async function tgCall(method: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`[telegram] ${method} failed (${res.status}):`, text);
  }
}

// ── Public helpers ────────────────────────────────────────────────────────

/** Send a text message. Uses Markdown parse mode for *bold* support. */
export async function sendMessage(chatId: number, text: string): Promise<void> {
  await tgCall('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  });
}

/**
 * Send multiple chunks sequentially (used when Claude response > 4 096 chars).
 */
export async function sendChunks(chatId: number, chunks: string[]): Promise<void> {
  for (const chunk of chunks) {
    await sendMessage(chatId, chunk);
  }
}

/** Show the "typing…" indicator in the chat while we fetch from Claude. */
export async function sendTyping(chatId: number): Promise<void> {
  await tgCall('sendChatAction', { chat_id: chatId, action: 'typing' });
}

/**
 * Register the webhook URL with Telegram.
 * Returns true on success, false on failure.
 */
export async function registerWebhook(webhookUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const json = await res.json() as { ok: boolean };
    return json.ok === true;
  } catch {
    return false;
  }
}

/** @deprecated Use registerWebhook instead */
export async function setWebhook(webhookUrl: string): Promise<void> {
  await registerWebhook(webhookUrl);
}
