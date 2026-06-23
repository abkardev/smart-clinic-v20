export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { processMessage, resolveInstagramInput, BotAdapter, ListSection } from '@/app/lib/botEngine';
import { BookingSource } from '@prisma/client';

const IG_URL = () => `https://graph.facebook.com/v18.0/me/messages`;
const IG_HEADERS = () => ({
  Authorization: `Bearer ${process.env.INSTAGRAM_TOKEN}`,
  'Content-Type': 'application/json',
});

// ─── Instagram Messaging adapter ─────────────────────────────────────────────
// Instagram DMs don't support interactive lists like WhatsApp.
// We fall back to numbered plain-text lists and accept numeric replies.
function makeInstagramAdapter(): BotAdapter {
  return {
    async sendText(to, text) {
      try {
        await fetch(IG_URL(), {
          method: 'POST',
          headers: IG_HEADERS(),
          body: JSON.stringify({
            recipient: { id: to },
            message: { text },
          }),
        });
      } catch (err) {
        console.error('IG sendText error:', err);
      }
    },

    async sendList(to, header, body, _button, sections) {
      // Instagram has no native list UI → send numbered text list
      const lines: string[] = [`*${header}*\n`, body, ''];
      let globalIndex = 1;
      const idMap: string[] = ['']; // 1-based index → id

      for (const section of sections) {
        if (sections.length > 1) lines.push(`${section.title}:`);
        for (const row of section.rows) {
          lines.push(`${globalIndex}. ${row.title}${row.description ? ` — ${row.description}` : ''}`);
          idMap.push(row.id);
          globalIndex++;
        }
      }
      lines.push('\nأرسل رقم اختيارك.');

      await this.sendText(to, lines.join('\n'));
    },
  };
}

// ─── GET — webhook verification ───────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

// ─── POST — incoming DM ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  (async () => {
    try {
      // Instagram webhook structure for DMs
      const entry     = body?.entry?.[0];
      const messaging = entry?.messaging?.[0];
      if (!messaging) return;

      const senderId  = messaging.sender?.id as string;
      if (!senderId) return;

      // Prefix with ig_ to distinguish from WhatsApp sessions in same DB table
      const sessionId = `ig_${senderId}`;
      const rawInput = (messaging.message?.text ?? '').trim();
      if (!rawInput) return;

      // Resolve numbered replies ("1", "2") to actual list row IDs
      const resolvedInput = await resolveInstagramInput(sessionId, rawInput);

      const adapter = makeInstagramAdapter();
      await processMessage(sessionId, resolvedInput, adapter, BookingSource.instagram);
    } catch (err) {
      console.error('Instagram webhook error:', err);
    }
  })();

  return new Response('EVENT_RECEIVED', { status: 200 });
}
