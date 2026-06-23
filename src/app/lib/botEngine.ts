import { prisma } from './prisma';
import { getAvailableSlots, suggestAlternativeDates, SERVICES } from './availability';
import { MSG, CALL_TIMES, TRIGGERS, BookingData } from './botMessages';
import { BookingSource } from '@prisma/client';

// ─── Adapter interface (implemented separately for WA and IG) ────────────────
export interface BotAdapter {
  sendText(to: string, text: string): Promise<void>;
  sendList(to: string, header: string, body: string, button: string, sections: ListSection[]): Promise<void>;
}

export interface ListSection {
  title: string;
  rows: { id: string; title: string; description?: string }[];
}

// ─── Session helpers using Prisma WhatsAppSession ────────────────────────────
async function getSession(phone: string) {
  return prisma.whatsAppSession.findUnique({ where: { phone } });
}

async function setSession(phone: string, step: string, data: BookingData) {
  return prisma.whatsAppSession.upsert({
    where: { phone },
    create: {
      phone,
      step: step as never,
      data: data as never,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
    update: {
      step: step as never,
      data: data as never,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
}

async function clearSession(phone: string) {
  await prisma.whatsAppSession.deleteMany({ where: { phone } });
}

// ─── Main entry point ────────────────────────────────────────────────────────
export async function processMessage(
  userId: string,
  input: string,
  adapter: BotAdapter,
  source: BookingSource = BookingSource.whatsapp
) {
  const norm  = (input || '').trim();
  const lower = norm.toLowerCase();
  const session = await getSession(userId);
  const isGreeting = TRIGGERS.some(w => lower.includes(w));
  const isExpired = session && session.expiresAt < new Date();

  if (!session || isGreeting || isExpired) {
    await clearSession(userId);
    await setSession(userId, 'main_menu', {});
    return sendMainMenu(userId, adapter);
  }

  const data = session.data as BookingData;

  switch (session.step) {
    case 'main_menu':      return handleMainMenu(userId, data, norm, adapter);
    case 'select_doctor':  return handleDoctor(userId, data, norm, adapter);
    case 'select_service': return handleService(userId, data, norm, adapter);
    case 'select_date':    return handleDate(userId, data, norm, adapter);
    case 'select_time':    return handleTime(userId, data, norm, adapter);
    case 'ask_name':       return handleName(userId, data, norm, adapter);
    case 'ask_whatsapp':   return handleWhatsapp(userId, data, norm, adapter, source); // Instagram only
    case 'ask_call_time':  return handleCallTime(userId, data, norm, adapter, source);
    case 'offers':         return handleOfferAction(userId, data, norm, adapter);
    default:               return adapter.sendText(userId, MSG.notFound);
  }
}

// ─── Menu ─────────────────────────────────────────────────────────────────────
async function sendMainMenu(userId: string, adapter: BotAdapter) {
  const sections: ListSection[] = [{ title: 'الخيارات', rows: [
    { id: 'menu_book',    title: MSG.menuOptions.book,    description: 'احجز موعدك مع أحد أطبائنا' },
    { id: 'menu_offers',  title: MSG.menuOptions.offers,  description: 'اعرض العروض والخصومات' },
    { id: 'menu_contact', title: MSG.menuOptions.contact, description: 'للتواصل مع فريق الدعم' },
  ]}];
  return adapter.sendList(userId, '🏥 SmartClinic', MSG.welcome(), 'اختر', sections);
}

async function handleMainMenu(userId: string, data: BookingData, input: string, adapter: BotAdapter) {
  if (input === 'menu_book' || input.includes('حجز')) {
    await setSession(userId, 'select_doctor', data);
    return sendDoctors(userId, adapter);
  }
  if (input === 'menu_offers' || input.includes('عرض')) {
    await setSession(userId, 'offers', data);
    return sendOffers(userId, adapter);
  }
  if (input === 'menu_contact') {
    return adapter.sendText(userId, '📞 *تواصل معنا*\n\n☎️ هاتف: 920XXXXXXX\n✉️ info@smartclinic.sa\n\nأوقات العمل: الأحد – الخميس، 9 ص – 5 م');
  }
  return sendMainMenu(userId, adapter);
}

// ─── Offers ───────────────────────────────────────────────────────────────────
async function sendOffers(userId: string, adapter: BotAdapter) {
  const offers = await prisma.offer.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  if (!offers.length) return adapter.sendText(userId, MSG.noOffers);

  let text = MSG.offersHeader;
  offers.forEach((o, i) => {
    text += `${i + 1}. *${o.titleAr}*\n   ${o.descriptionAr || ''}\n`;
    if (o.code) text += `   كود الخصم: \`${o.code}\`\n`;
    if (o.expiresAt) text += `   ⏰ صالح حتى: ${new Date(o.expiresAt).toLocaleDateString('ar-SA')}\n`;
    text += '\n';
  });
  text += MSG.offersFooter;

  const sections: ListSection[] = [{ title: 'الإجراءات', rows: [
    { id: 'menu_book', title: '📅 احجز الآن', description: 'اضغط للحجز' },
  ]}];
  return adapter.sendList(userId, '🎁 العروض', text, 'الإجراءات', sections);
}

async function handleOfferAction(userId: string, data: BookingData, _input: string, adapter: BotAdapter) {
  await setSession(userId, 'select_doctor', data);
  return sendDoctors(userId, adapter);
}

// ─── Doctors ──────────────────────────────────────────────────────────────────
async function sendDoctors(userId: string, adapter: BotAdapter) {
  const doctors = await prisma.doctor.findMany({ where: { isActive: true } });
  if (!doctors.length) return adapter.sendText(userId, MSG.noDoctors);

  const sections: ListSection[] = [{ title: 'الأطباء', rows: doctors.map(d => ({
    id: d.id,
    title: `د. ${d.nameAr || d.nameEn}`,
    description: d.specialtyAr || d.specialtyEn || 'طب عام',
  }))}];
  return adapter.sendList(userId, '👨‍⚕️ اختر الطبيب', MSG.selectDoctor, 'اختر طبيباً', sections);
}

async function handleDoctor(userId: string, data: BookingData, input: string, adapter: BotAdapter) {
  const doc = await prisma.doctor.findUnique({ where: { id: input } }).catch(() => null);
  if (!doc) return adapter.sendText(userId, '⚠️ اختيار غير صحيح. أرسل *مرحبا* للبدء.');
  data.doctorId   = doc.id;
  data.doctorName = doc.nameAr || doc.nameEn;
  await setSession(userId, 'select_service', data);
  const sections: ListSection[] = [{ title: 'الخدمات', rows: SERVICES.map((s, i) => ({ id: `svc_${i}`, title: s })) }];
  return adapter.sendList(userId, `د. ${data.doctorName}`, MSG.selectService(data.doctorName), 'اختر خدمة', sections);
}

// ─── Service ──────────────────────────────────────────────────────────────────
async function handleService(userId: string, data: BookingData, input: string, adapter: BotAdapter) {
  const idx = parseInt(input.replace('svc_', ''));
  const svc = SERVICES[isNaN(idx) ? -1 : idx];
  if (!svc) return adapter.sendText(userId, '⚠️ اختيار غير صحيح.');
  data.service = svc;
  await setSession(userId, 'select_date', data);
  return adapter.sendText(userId, MSG.selectDate);
}

// ─── Date ─────────────────────────────────────────────────────────────────────
async function handleDate(userId: string, data: BookingData, input: string, adapter: BotAdapter) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return adapter.sendText(userId, MSG.invalidDate);
  const d = new Date(input);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (d < today) return adapter.sendText(userId, MSG.pastDate);

  const doc = await prisma.doctor.findUnique({ where: { id: data.doctorId! } });
  if (!doc) return adapter.sendText(userId, MSG.error);

  const { available, reason } = await getAvailableSlots(doc, input);
  if (!available.length) {
    if (reason === 'holiday') return adapter.sendText(userId, `🎌 هذا اليوم عطلة رسمية. يرجى اختيار تاريخ آخر.`);
    const alts = await suggestAlternativeDates(doc, input);
    return adapter.sendText(userId, MSG.noSlots(input, alts));
  }

  data.date = input;
  await setSession(userId, 'select_time', data);
  const sections: ListSection[] = [{ title: `الأوقات المتاحة — ${input}`, rows: available.slice(0, 10).map(t => ({ id: `time_${t}`, title: t, description: 'متاح ✓' })) }];
  return adapter.sendList(userId, '🕐 اختر الوقت', MSG.selectTime(input), 'اختر وقتاً', sections);
}

// ─── Time ─────────────────────────────────────────────────────────────────────
async function handleTime(userId: string, data: BookingData, input: string, adapter: BotAdapter) {
  const t = input.replace('time_', '');
  if (!/^\d{2}:\d{2}$/.test(t)) return adapter.sendText(userId, '⚠️ اختيار غير صحيح.');
  data.time = t;
  await setSession(userId, 'ask_name', data);
  return adapter.sendText(userId, MSG.askName);
}

// ─── Name ─────────────────────────────────────────────────────────────────────
async function handleName(userId: string, data: BookingData, input: string, adapter: BotAdapter) {
  if (['إلغاء', 'cancel'].includes(input.toLowerCase())) {
    await clearSession(userId);
    return adapter.sendText(userId, MSG.cancelled);
  }
  if (input.length < 2) return adapter.sendText(userId, '⚠️ يرجى إرسال اسمك الكامل.');
  data.name = input;
  // Instagram: ask for WhatsApp number next. WhatsApp: go straight to call time.
  const nextStep = userId.startsWith('ig_') ? 'ask_whatsapp' : 'ask_call_time';
  await setSession(userId, nextStep, data);
  if (nextStep === 'ask_whatsapp') return adapter.sendText(userId, MSG.askWhatsapp);
  return adapter.sendText(userId, MSG.askCallTime);
}

// ─── WhatsApp number (Instagram only) ────────────────────────────────────────
async function handleWhatsapp(userId: string, data: BookingData, input: string, adapter: BotAdapter, source: BookingSource) {
  // Accept formats: 966501234567 / 0501234567 / +966501234567
  const cleaned = input.replace(/\D/g, '');
  if (cleaned.length < 9 || cleaned.length > 15) {
    return adapter.sendText(userId, MSG.invalidWhatsapp);
  }
  data.whatsappNumber = cleaned.startsWith('966') ? cleaned : cleaned.startsWith('0') ? `966${cleaned.slice(1)}` : `966${cleaned}`;
  await setSession(userId, 'ask_call_time', data);
  return adapter.sendText(userId, MSG.askCallTime);
}

// ─── Call time → Create booking ──────────────────────────────────────────────
async function handleCallTime(userId: string, data: BookingData, input: string, adapter: BotAdapter, source: BookingSource) {
  // Accept: call_morning / call_noon / call_evening OR 1/2/3
  const numMap: Record<string, string> = { '1': 'call_morning', '2': 'call_noon', '3': 'call_evening' };
  const resolvedId = numMap[input] ?? input;
  const ct = CALL_TIMES.find(c => c.id === resolvedId);
  data.callTime = ct ? ct.title : input;

  try {
    // Use WhatsApp number for Instagram users, userId for WhatsApp users
    const phone = source === BookingSource.instagram && data.whatsappNumber
      ? data.whatsappNumber
      : userId;

    const booking = await prisma.booking.create({
      data: {
        name:     data.name!,
        phone,
        service:  data.service!,
        date:     data.date!,
        time:     data.time!,
        doctorId: data.doctorId!,
        source,
        status:   'confirmed',
        notes:    `أفضل وقت للتواصل: ${data.callTime}${data.whatsappNumber ? ` | واتساب: ${data.whatsappNumber}` : ''}`,
      },
    });

    // Google Calendar sync (non-fatal)
    try {
      const doc = await prisma.doctor.findUnique({ where: { id: data.doctorId! } });
      if (doc) {
        const { createCalendarEvent } = await import('./googleCalendar');
        const cal = await createCalendarEvent(booking, doc);
        if (cal) await prisma.booking.update({ where: { id: booking.id }, data: { ...cal, calendarSynced: true } });
      }
    } catch { /* non-fatal */ }

    await clearSession(userId);

    const summary = MSG.confirmationSummary(
      data.name!, data.doctorName!, data.service!, data.date!, data.time!, data.callTime!
    );
    return adapter.sendText(userId, summary);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === 'P2002') return adapter.sendText(userId, MSG.slotTaken);
    console.error('Bot booking error:', err);
    return adapter.sendText(userId, MSG.error);
  }
}

// ─── Instagram numeric reply resolver ────────────────────────────────────────
// Converts "1", "2", "3" replies into the correct list row IDs
// based on the current session step and available options.
export async function resolveInstagramInput(userId: string, rawInput: string): Promise<string> {
  const num = parseInt(rawInput.trim());
  if (isNaN(num)) return rawInput; // not numeric — pass through as-is

  const session = await getSession(userId);
  if (!session) return rawInput;

  const data = session.data as BookingData;

  switch (session.step) {
    case 'main_menu': {
      const opts = ['menu_book', 'menu_offers', 'menu_contact'];
      return opts[num - 1] ?? rawInput;
    }
    case 'select_doctor': {
      const doctors = await prisma.doctor.findMany({ where: { isActive: true } });
      return doctors[num - 1]?.id ?? rawInput;
    }
    case 'select_service': {
      return `svc_${num - 1}`;
    }
    case 'select_time': {
      // Time slots: we need to re-fetch available slots
      if (data.doctorId && data.date) {
        const doc = await prisma.doctor.findUnique({ where: { id: data.doctorId } });
        if (doc) {
          const { available } = await getAvailableSlots(doc, data.date);
          const slot = available[num - 1];
          if (slot) return `time_${slot}`;
        }
      }
      return rawInput;
    }
    case 'ask_call_time': {
      const ctMap: Record<number, string> = { 1: 'call_morning', 2: 'call_noon', 3: 'call_evening' };
      return ctMap[num] ?? rawInput;
    }
    case 'offers': {
      return 'menu_book'; // any reply from offers → proceed to booking
    }
    default:
      return rawInput;
  }
}
