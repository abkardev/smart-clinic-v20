export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { processMessage, BotAdapter } from '@/app/lib/botEngine';
import { BookingSource } from '@prisma/client';

const WA_URL = () => `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
const WA_HEADERS = () => ({
  Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
  'Content-Type': 'application/json',
});

// ─── WhatsApp adapter ─────────────────────────────────────────────────────────
function makeWhatsAppAdapter(): BotAdapter {
  return {
    async sendText(to, text) {
      try {
        await fetch(WA_URL(), {
          method: 'POST',
          headers: WA_HEADERS(),
          body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
        });
      } catch (err) {
        console.error('WA sendText error:', err);
      }
    },

    async sendList(to, header, body, button, sections) {
      try {
        const res = await fetch(WA_URL(), {
          method: 'POST',
          headers: WA_HEADERS(),
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'interactive',
            interactive: {
              type: 'list',
              header: { type: 'text', text: header },
              body: { text: body },
              footer: { text: 'SmartClinic 🏥' },
              action: { button, sections },
            },
          }),
        });
        if (!res.ok) throw new Error(await res.text());
      } catch {
        // Fallback: plain text
        const items = sections.flatMap(s => s.rows).map((r, i) => `${i + 1}. ${r.title}`).join('\n');
        await this.sendText(to, `${body}\n\n${items}\n\nأرسل رقم اختيارك.`);
      }
    },
  };
}

// ─── GET — webhook verification ───────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

// ─── POST — incoming message ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Always respond 200 immediately (Meta requires this within 20s)
  const body = await req.json().catch(() => null);

  // Fire-and-forget
  (async () => {
    try {
      const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!message) return;

      const phone = message.from as string;
      const userInput: string =
        message.type === 'text' ? message.text.body.trim() :
        message.type === 'interactive'
          ? (message.interactive?.list_reply?.id ?? message.interactive?.button_reply?.id ?? '')
          : '';

      const adapter = makeWhatsAppAdapter();
      await processMessage(phone, userInput, adapter, BookingSource.whatsapp);
    } catch (err) {
      console.error('WhatsApp webhook error:', err);
    }
  })();

  return new Response('OK', { status: 200 });
}
