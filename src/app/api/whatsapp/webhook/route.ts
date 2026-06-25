// export const dynamic = 'force-dynamic';

// import { NextRequest, NextResponse } from 'next/server';
// import { processMessage, BotAdapter } from '@/app/lib/botEngine';
// import { BookingSource } from '@prisma/client';

// const WA_URL = () => `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
// const WA_HEADERS = () => ({
//   Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
//   'Content-Type': 'application/json',
// });

// // ─── WhatsApp adapter ─────────────────────────────────────────────────────────
// function makeWhatsAppAdapter(): BotAdapter {
//   return {
//     async sendText(to, text) {
//       try {
//         await fetch(WA_URL(), {
//           method: 'POST',
//           headers: WA_HEADERS(),
//           body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
//         });
//       } catch (err) {
//         console.error('WA sendText error:', err);
//       }
//     },

//     async sendList(to, header, body, button, sections) {
//       try {
//         const res = await fetch(WA_URL(), {
//           method: 'POST',
//           headers: WA_HEADERS(),
//           body: JSON.stringify({
//             messaging_product: 'whatsapp',
//             to,
//             type: 'interactive',
//             interactive: {
//               type: 'list',
//               header: { type: 'text', text: header },
//               body: { text: body },
//               footer: { text: 'SmartClinic 🏥' },
//               action: { button, sections },
//             },
//           }),
//         });
//         if (!res.ok) throw new Error(await res.text());
//       } catch {
//         // Fallback: plain text
//         const items = sections.flatMap(s => s.rows).map((r, i) => `${i + 1}. ${r.title}`).join('\n');
//         await this.sendText(to, `${body}\n\n${items}\n\nأرسل رقم اختيارك.`);
//       }
//     },
//   };
// }

// // ─── GET — webhook verification ───────────────────────────────────────────────
// export async function GET(req: NextRequest) {
//   const { searchParams } = new URL(req.url);
//   const mode      = searchParams.get('hub.mode');
//   const token     = searchParams.get('hub.verify_token');
//   const challenge = searchParams.get('hub.challenge');

//   if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
//     return new Response(challenge, { status: 200 });
//   }
//   return new Response('Forbidden', { status: 403 });
// }

// // ─── POST — incoming message ──────────────────────────────────────────────────
// export async function POST(req: NextRequest) {
//   // Always respond 200 immediately (Meta requires this within 20s)
//   const body = await req.json().catch(() => null);

//   // Fire-and-forget
//   (async () => {
//     try {
//       const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
//       if (!message) return;

//       const phone = message.from as string;
//       const userInput: string =
//         message.type === 'text' ? message.text.body.trim() :
//         message.type === 'interactive'
//           ? (message.interactive?.list_reply?.id ?? message.interactive?.button_reply?.id ?? '')
//           : '';

//       const adapter = makeWhatsAppAdapter();
//       await processMessage(phone, userInput, adapter, BookingSource.whatsapp);
//     } catch (err) {
//       console.error('WhatsApp webhook error:', err);
//     }
//   })();

//   return new Response('OK', { status: 200 });
// }
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { processMessage, BotAdapter } from '@/app/lib/botEngine';
import { BookingSource } from '@prisma/client';

const WA_URL = () =>
  `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`;

const WA_HEADERS = () => ({
  Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
  'Content-Type': 'application/json',
});

// ─── WhatsApp adapter ─────────────────────────────────────────────────────────
function makeWhatsAppAdapter(): BotAdapter {
  return {
    async sendText(to, text) {
      try {
        console.log('📤 sendText called', {
          to,
          textLength: text?.length,
        });

        const res = await fetch(WA_URL(), {
          method: 'POST',
          headers: WA_HEADERS(),
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: {
              body: text,
            },
          }),
        });

        const responseText = await res.text();

        console.log('📤 WHATSAPP STATUS:', res.status);
        console.log('📤 WHATSAPP RESPONSE:', responseText);

        if (!res.ok) {
          throw new Error(responseText);
        }
      } catch (err) {
        console.error('❌ WA sendText error:', err);
      }
    },

    async sendList(to, header, body, button, sections) {
      try {
        console.log('📤 sendList called');

        const res = await fetch(WA_URL(), {
          method: 'POST',
          headers: WA_HEADERS(),
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'interactive',
            interactive: {
              type: 'list',
              header: {
                type: 'text',
                text: header,
              },
              body: {
                text: body,
              },
              footer: {
                text: 'SmartClinic 🏥',
              },
              action: {
                button,
                sections,
              },
            },
          }),
        });

        const responseText = await res.text();

        console.log('📤 LIST STATUS:', res.status);
        console.log('📤 LIST RESPONSE:', responseText);

        if (!res.ok) {
          throw new Error(responseText);
        }
      } catch (err) {
        console.error('❌ sendList failed, fallback to text:', err);

        const items = sections
          .flatMap(s => s.rows)
          .map((r, i) => `${i + 1}. ${r.title}`)
          .join('\n');

        await this.sendText(
          to,
          `${body}\n\n${items}\n\nأرسل رقم اختيارك.`
        );
      }
    },
  };
}

// ─── GET — webhook verification ───────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('🔍 Webhook verification request', {
    mode,
    tokenReceived: !!token,
    challengeReceived: !!challenge,
  });

  if (
    mode === 'subscribe' &&
    token === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    console.log('✅ Webhook verified successfully');

    return new Response(challenge, {
      status: 200,
    });
  }

  console.log('❌ Webhook verification failed');

  return new Response('Forbidden', {
    status: 403,
  });
}

// ─── POST — incoming message ──────────────────────────────────────────────────
// export async function POST(req: NextRequest) {
//   const body = await req.json().catch(err => {
//     console.error('❌ JSON parse error:', err);
//     return null;
//   });

//   console.log(
//     '📥 WEBHOOK BODY:',
//     JSON.stringify(body, null, 2)
//   );

//   // Fire and forget
//   (async () => {
//     try {
//       const message =
//         body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

//       console.log('📥 MESSAGE OBJECT:', message);

//       if (!message) {
//         console.log(
//           '⚠️ No message found in payload (likely status update)'
//         );
//         return;
//       }

//       const phone = message.from as string;

//       const userInput =
//         message.type === 'text'
//           ? message.text?.body?.trim()
//           : message.type === 'interactive'
//           ? (
//               message.interactive?.list_reply?.id ??
//               message.interactive?.button_reply?.id ??
//               ''
//             )
//           : '';

//       console.log('📥 PROCESSING MESSAGE:', {
//         phone,
//         type: message.type,
//         userInput,
//       });

//       const adapter = makeWhatsAppAdapter();

//       console.log('🚀 Calling processMessage');

//       await processMessage(
//         phone,
//         userInput,
//         adapter,
//         BookingSource.whatsapp
//       );

//       console.log('✅ processMessage completed');
//     } catch (err) {
//       console.error(
//         '❌ WhatsApp webhook error:',
//         err
//       );
//     }
//   })();

//   return new Response('OK', {
//     status: 200,
//   });
// }

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  console.error(
    'FULL WHATSAPP PAYLOAD:',
    JSON.stringify(body, null, 2)
  );

  return new Response('OK', { status: 200 });
}