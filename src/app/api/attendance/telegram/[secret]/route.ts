import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  MoveError,
  approveMoveRequest,
  rejectMoveRequest,
} from "@/lib/attendance/moves";
import { answerCallback, editMessageText } from "@/lib/attendance/telegram";

/**
 * Telegram webhook. The head teacher approves or rejects a move request by
 * tapping a button in the bot.
 *
 * The URL carries TELEGRAM_WEBHOOK_SECRET, so only Telegram (pointed at this
 * exact URL) can post here. Register it once with:
 *
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<host>/api/attendance/telegram/<SECRET>"
 */

type CallbackQuery = {
  id: string;
  data?: string;
  from?: { id: number };
  message?: { message_id: number; chat: { id: number }; text?: string };
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ secret: string }> },
) {
  const { secret } = await params;
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const update = (await req.json().catch(() => null)) as
    | { callback_query?: CallbackQuery }
    | null;
  const query = update?.callback_query;
  if (!query?.data) return NextResponse.json({ ok: true });

  // Only the configured head-teacher chat may decide.
  const allowedChat = process.env.TELEGRAM_HEAD_CHAT_ID;
  const chatId = query.message?.chat.id;
  if (allowedChat && String(chatId) !== String(allowedChat)) {
    await answerCallback(query.id, "This chat cannot approve moves.");
    return NextResponse.json({ ok: true });
  }

  const [prefix, action, requestId] = query.data.split(":");
  if (prefix !== "mv" || !requestId) return NextResponse.json({ ok: true });

  // Credit the decision to the head teacher account linked to this chat.
  const head =
    (await prisma.staff.findFirst({
      where: { role: "head", telegramId: String(query.from?.id ?? "") },
    })) ?? (await prisma.staff.findFirst({ where: { role: "head" } }));

  try {
    const result =
      action === "approve"
        ? await approveMoveRequest(requestId, head?.id ?? null, "Decided in Telegram")
        : await rejectMoveRequest(requestId, head?.id ?? null, "Decided in Telegram");

    const pupilName = `${result.pupil.firstName} ${result.pupil.lastName}`.trim();
    const summary =
      result.status === "APPROVED"
        ? `✅ *Approved* — ${pupilName} moved to ${result.toGroup.name}` +
          (result.recordsMoved > 0
            ? `\n${result.recordsMoved} earlier record(s) carried across and marked as taken in ${result.fromGroup?.name ?? "the previous group"}.`
            : "\nNo earlier records to carry.")
        : `❌ *Rejected* — ${pupilName} stays in ${result.fromGroup?.name ?? "the current group"}`;

    await answerCallback(query.id, result.status === "APPROVED" ? "Approved" : "Rejected");
    if (query.message) {
      await editMessageText({
        chatId: query.message.chat.id,
        messageId: query.message.message_id,
        text: `${query.message.text ?? ""}\n\n${summary}`,
      });
    }
  } catch (error) {
    const message =
      error instanceof MoveError ? error.message : "Could not apply the decision.";
    await answerCallback(query.id, message);
  }

  return NextResponse.json({ ok: true });
}
