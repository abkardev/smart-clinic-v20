// Shared messages for WhatsApp + Instagram bots

export const CALL_TIMES = [
  { id: 'call_morning', title: '🌅 الصباح (8 ص - 12 م)',  description: 'من 8 صباحاً حتى 12 ظهراً' },
  { id: 'call_noon',    title: '☀️ الظهيرة (12 م - 4 م)', description: 'من 12 ظهراً حتى 4 عصراً' },
  { id: 'call_evening', title: '🌆 المساء (4 م - 8 م)',   description: 'من 4 عصراً حتى 8 مساءً' },
];

export interface BookingData {
  doctorId?: string;
  doctorName?: string;
  service?: string;
  date?: string;
  time?: string;
  name?: string;
  callTime?: string;
  whatsappNumber?: string; // Instagram only
}

export const MSG = {
  welcome:       (c = 'SmartClinic') => `🏥 *أهلاً وسهلاً في ${c}!*\n\nيسعدنا خدمتك. اختر ما يناسبك:`,
  selectDoctor:  '👨‍⚕️ *اختر الطبيب المناسب لك:*',
  selectService: (n: string) => `✅ اخترت *الدكتور ${n}*\n\n💊 *ما الخدمة التي تحتاجها؟*`,
  selectDate:    '📅 *أرسل تاريخ الموعد بصيغة:*\nYYYY-MM-DD\nمثال: 2025-03-20',
  noSlots: (date: string, alts: { date: string; availableCount: number }[]) => {
    let msg = `❌ لا توجد مواعيد متاحة في *${date}*.\n\n`;
    if (alts?.length) {
      msg += `📅 *أقرب التواريخ المتاحة:*\n`;
      msg += alts.map(a => `• ${a.date} — ${a.availableCount} موعد`).join('\n');
      msg += '\n\nأرسل أحد هذه التواريخ.';
    } else {
      msg += 'لا توجد مواعيد في الأيام القادمة.';
    }
    return msg;
  },
  invalidDate: '⚠️ صيغة التاريخ غير صحيحة.\nيرجى الإرسال بصيغة: YYYY-MM-DD\nمثال: 2025-03-20',
  pastDate:    '⚠️ يرجى اختيار تاريخ مستقبلي.',
  selectTime:  (d: string) => `🕐 *اختر وقت موعدك ليوم ${d}:*`,
  askName:     '📝 *أرسل اسمك الكامل لتأكيد الحجز*\nأو اكتب *إلغاء* للبدء من جديد.',
  askCallTime: '📞 *ما أفضل وقت للتواصل معك؟*\nسنتصل لتأكيد موعدك:\n\n1. 🌅 الصباح (8 ص - 12 م)\n2. ☀️ الظهيرة (12 م - 4 م)\n3. 🌆 المساء (4 م - 8 م)\n\nأرسل رقم اختيارك.',
  askWhatsapp: '📱 *أرسل رقم واتساب للتواصل معك:*\nمثال: 966501234567\n\nسنستخدمه لتأكيد موعدك وإرسال التذكيرات.',
  confirmationSummary: (name: string, doctorName: string, service: string, date: string, time: string, callTime: string) =>
    `✅ *تم تأكيد حجزك!*\n\n` +
    `👤 *الاسم:* ${name}\n` +
    `👨‍⚕️ *الطبيب:* د. ${doctorName}\n` +
    `💊 *الخدمة:* ${service}\n` +
    `📅 *التاريخ:* ${date}\n` +
    `🕐 *الوقت:* ${time}\n` +
    `📞 *أفضل وقت للتواصل:* ${callTime || '—'}\n\n` +
    `سيتصل بك فريقنا قريباً. شكراً لثقتك! 💙`,
  reminder: (name: string, doctorName: string, service: string, date: string, time: string) =>
    `⏰ *تذكير بموعدك*\n\nعزيزي *${name}*:\n\n` +
    `👨‍⚕️ *الطبيب:* د. ${doctorName}\n` +
    `💊 *الخدمة:* ${service}\n` +
    `📅 *التاريخ:* ${date}\n` +
    `🕐 *الوقت:* ${time}\n\n` +
    `يرجى الحضور قبل 10 دقائق. 💙`,
  slotTaken:   '❌ تم حجز هذا الموعد للتو. أرسل *مرحبا* لاختيار موعد آخر.',
  cancelled:   '🔄 تم الإلغاء. أرسل *مرحبا* لبدء حجز جديد.',
  error:       '⚠️ حدث خطأ. يرجى المحاولة مجدداً.',
  notFound:    'أرسل *مرحبا* أو *احجز* لبدء حجز جديد.',
  noDoctors:   '⚠️ لا يوجد أطباء متاحون حالياً.',
  noOffers:    '😔 لا توجد عروض متاحة حالياً. تابعونا!',
  offersHeader: '🎁 *عروضنا الحالية:*\n\n',
  offersFooter: '\n\nأرسل *احجز* للحجز أو *رئيسية* للقائمة.',
  menuOptions:  { book: '📅 حجز موعد', offers: '🎁 العروض والخصومات', contact: '📞 تواصل معنا' },
  invalidWhatsapp: '⚠️ رقم الواتساب غير صحيح. يرجى إرسال رقم صحيح مثل: 966501234567',
};

export const TRIGGERS = ['مرحبا', 'مرحباً', 'احجز', 'hi', 'hello', 'start', 'book', 'هلا', 'السلام عليكم', 'اهلا', 'رئيسية'];
