/**
 * Trilingual notification copy for clinic-service, plus the recipient's
 * language lookup.
 *
 * The monitoring agent in agent-service already writes notifications in the
 * owner's own language; these four were the exception, so a Sinhala-speaking
 * owner got an English push telling them their appointment was cancelled.
 * This mirrors that agent's approach: ask auth-service for the recipient's
 * preferred language, cache it briefly, and fall back to English.
 *
 * NOTE: message wording is mirrored from agent-service app/core/i18n.py in
 * spirit — keep the tone consistent if either side changes.
 */

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:4001";
const SERVICE_KEY = process.env.SERVICE_KEY || "internal-dev-key";

export type NotifyLanguage = "en" | "si" | "ta";

type Copy = { title: string; body: string };
type Entry = Record<NotifyLanguage, Copy>;

/** {pet} is substituted where a pet name is known; otherwise the neutral form is used. */
const MESSAGES: Record<string, Entry> = {
  appointment_cancelled: {
    en: {
      title: "Appointment cancelled",
      body: "Your veterinary appointment has been cancelled by the clinic. Please book another time slot.",
    },
    si: {
      title: "හමුවීම අවලංගු කර ඇත",
      body: "ඔබේ පශු වෛද්‍ය හමුවීම සායනය විසින් අවලංගු කර ඇත. කරුණාකර වෙනත් වේලාවක් වෙන් කරන්න.",
    },
    ta: {
      title: "சந்திப்பு ரத்து செய்யப்பட்டது",
      body: "உங்கள் கால்நடை மருத்துவ சந்திப்பு கிளினிக்கால் ரத்து செய்யப்பட்டது. வேறு நேரத்தைப் பதிவு செய்யவும்.",
    },
  },
  appointment_rescheduled: {
    en: {
      title: "Appointment rescheduled",
      body: "Your veterinary appointment has been moved by the clinic. Please check the new time in your appointments.",
    },
    si: {
      title: "හමුවීම නැවත සකසා ඇත",
      body: "ඔබේ පශු වෛද්‍ය හමුවීම සායනය විසින් වෙනස් කර ඇත. කරුණාකර ඔබේ හමුවීම් තුළ නව වේලාව පරීක්ෂා කරන්න.",
    },
    ta: {
      title: "சந்திப்பு மாற்றியமைக்கப்பட்டது",
      body: "உங்கள் கால்நடை மருத்துவ சந்திப்பு கிளினிக்கால் மாற்றப்பட்டது. உங்கள் சந்திப்புகளில் புதிய நேரத்தைச் சரிபார்க்கவும்.",
    },
  },
  inquiry_replied: {
    en: {
      title: "A veterinarian replied to your question",
      body: "Your question about {pet} has been answered. Open Inquiries to read the reply.",
    },
    si: {
      title: "පශු වෛද්‍යවරයෙක් ඔබේ ප්‍රශ්නයට පිළිතුරු දී ඇත",
      body: "{pet} පිළිබඳ ඔබේ ප්‍රශ්නයට පිළිතුරු ලැබී ඇත. පිළිතුර කියවීමට විමසීම් විවෘත කරන්න.",
    },
    ta: {
      title: "கால்நடை மருத்துவர் உங்கள் கேள்விக்கு பதிலளித்துள்ளார்",
      body: "{pet} பற்றிய உங்கள் கேள்விக்கு பதில் அளிக்கப்பட்டுள்ளது. பதிலைப் படிக்க விசாரணைகளைத் திறக்கவும்.",
    },
  },
  inquiry_replied_generic: {
    en: { title: "A veterinarian replied to your question", body: "Your question has been answered. Open Inquiries to read the reply." },
    si: { title: "පශු වෛද්‍යවරයෙක් ඔබේ ප්‍රශ්නයට පිළිතුරු දී ඇත", body: "ඔබේ ප්‍රශ්නයට පිළිතුරු ලැබී ඇත. පිළිතුර කියවීමට විමසීම් විවෘත කරන්න." },
    ta: { title: "கால்நடை மருத்துவர் உங்கள் கேள்விக்கு பதிலளித்துள்ளார்", body: "உங்கள் கேள்விக்கு பதில் அளிக்கப்பட்டுள்ளது. பதிலைப் படிக்க விசாரணைகளைத் திறக்கவும்." },
  },
  inquiry_message: {
    en: { title: "New message about a patient", body: "An owner sent a message about {pet}." },
    si: { title: "රෝගියෙකු පිළිබඳ නව පණිවිඩයක්", body: "හිමිකරුවෙක් {pet} පිළිබඳ පණිවිඩයක් එවා ඇත." },
    ta: { title: "நோயாளி பற்றிய புதிய செய்தி", body: "உரிமையாளர் {pet} பற்றி ஒரு செய்தியை அனுப்பியுள்ளார்." },
  },
  inquiry_message_generic: {
    en: { title: "New message about a patient", body: "An owner sent a message about their pet." },
    si: { title: "රෝගියෙකු පිළිබඳ නව පණිවිඩයක්", body: "හිමිකරුවෙක් ඔවුන්ගේ සුරතලා පිළිබඳ පණිවිඩයක් එවා ඇත." },
    ta: { title: "நோயாளி பற்றிய புதிய செய்தி", body: "உரிமையாளர் தனது செல்லப்பிராணி பற்றி ஒரு செய்தியை அனுப்பியுள்ளார்." },
  },
};

export function notifyCopy(key: string, language: string, pet?: string): Copy {
  const lang = (["en", "si", "ta"].includes(language) ? language : "en") as NotifyLanguage;
  const entry = MESSAGES[key] ?? MESSAGES.inquiry_message_generic;
  const copy = entry[lang];
  return { title: copy.title, body: copy.body.replace("{pet}", pet ?? "") };
}

// Cached per process: a language preference changes rarely, and this avoids an
// auth-service round trip on every notification.
const languageCache = new Map<string, { value: string; at: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Recipient's preferred language; English whenever it cannot be determined. */
export async function recipientLanguage(userId: string): Promise<string> {
  if (!userId) return "en";
  const cached = languageCache.get(userId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  let language = "en";
  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/api/auth/users/${encodeURIComponent(userId)}/language`, {
      headers: { "x-service-key": SERVICE_KEY },
    });
    if (response.ok) {
      const body = (await response.json()) as { data?: { language?: string } };
      const value = body.data?.language;
      if (value === "en" || value === "si" || value === "ta") language = value;
    }
  } catch (err) {
    console.warn("[clinic-service] language lookup failed", err);
  }
  languageCache.set(userId, { value: language, at: Date.now() });
  return language;
}
