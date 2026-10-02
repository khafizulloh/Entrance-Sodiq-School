/**
 * Telegram notifications for the head teacher.
 *
 * When a teacher requests a student move, the head teacher gets a message in
 * the bot with Approve / Reject buttons, so the request can be decided without
 * opening the app. Everything degrades quietly when the bot is not configured.
 *
 * Setup (see README):
 *   TELEGRAM_BOT_TOKEN   — from @BotFather
 *   TELEGRAM_HEAD_CHAT_ID — the head teacher's chat id
 *   TELEGRAM_WEBHOOK_SECRET — a random string, used as the webhook path secret
 */

const API = "https://api.telegram.org";

export function telegramEnabled(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_HEAD_CHAT_ID);
}

type InlineButton = { text: string; callback_data: string };

async function call(method: string, body: unknown): Promise<unknown | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`${API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return await res.json();
  } catch (error) {
    // A notification must never break the request that triggered it.
    console.error(`Telegram ${method} failed:`, error);
    return null;
  }
}

export async function sendMoveRequestNotification(input: {
  requestId: string;
  pupilName: string;
  fromGroup: string;
  toGroup: string;
  requestedBy: string;
  recordCount: number;
  reason?: string | null;
}): Promise<void> {
  if (!telegramEnabled()) return;

  const lines = [
    "📋 *Student move request*",
    "",
    `*Student:* ${escapeMd(input.pupilName)}`,
    `*From:* ${escapeMd(input.fromGroup)}`,
    `*To:* ${escapeMd(input.toGroup)}`,
    `*Requested by:* ${escapeMd(input.requestedBy)}`,
    `*Existing records:* ${input.recordCount}`,
  ];
  if (input.reason) lines.push(`*Reason:* ${escapeMd(input.reason)}`);
  lines.push("", "Approve to move the student and carry the records across.");

  const buttons: InlineButton[][] = [
    [
      { text: "✅ Approve", callback_data: `mv:approve:${input.requestId}` },
      { text: "❌ Reject", callback_data: `mv:reject:${input.requestId}` },
    ],
  ];

  await call("sendMessage", {
    chat_id: process.env.TELEGRAM_HEAD_CHAT_ID,
    text: lines.join("\n"),
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: buttons },
  });
}

export async function answerCallback(callbackQueryId: string, text: string) {
  await call("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

export async function editMessageText(input: {
  chatId: number | string;
  messageId: number;
  text: string;
}) {
  await call("editMessageText", {
    chat_id: input.chatId,
    message_id: input.messageId,
    text: input.text,
    parse_mode: "Markdown",
  });
}

function escapeMd(value: string): string {
  return value.replace(/([_*`[\]])/g, "\\$1");
}
