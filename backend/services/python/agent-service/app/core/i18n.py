"""Trilingual (en/si/ta) message templates for owner-facing agent output.

Used by the rule-based fallback, the response composer, and the monitoring
agent. The Gemini path is instructed to reply directly in the target language;
these templates cover every deterministic string.
"""
from __future__ import annotations

SUPPORTED = {"en", "si", "ta"}

LANGUAGE_NAMES = {"en": "English", "si": "Sinhala", "ta": "Tamil"}

MESSAGES: dict[str, dict[str, str]] = {
    # ── fallback / composer recommendations ──
    "vet_visit_title": {
        "en": "Veterinary care needed",
        "si": "පශු වෛද්‍ය සත්කාරය අවශ්‍යයි",
        "ta": "கால்நடை மருத்துவ பராமரிப்பு தேவை",
    },
    "vet_visit_within": {
        "en": "Seek veterinary care within {hours} hours.",
        "si": "පැය {hours}ක් ඇතුළත පශු වෛද්‍ය සත්කාරය ලබාගන්න.",
        "ta": "{hours} மணிநேரத்திற்குள் கால்நடை மருத்துவ பராமரிப்பைப் பெறவும்.",
    },
    "high_risk_conditions": {
        "en": " High-risk conditions detected: {diseases}.",
        "si": " හඳුනාගත් ඉහළ අවදානම් තත්ත්ව: {diseases}.",
        "ta": " கண்டறியப்பட்ட உயர் அபாய நிலைகள்: {diseases}.",
    },
    "until_visit_title": {
        "en": "Until the visit",
        "si": "පැමිණීමට පෙර",
        "ta": "வருகைக்கு முன்",
    },
    "until_visit_message": {
        "en": "Monitor closely; contact an emergency clinic immediately if the condition deteriorates. Bring vaccination and medical records to the appointment.",
        "si": "සමීපව නිරීක්ෂණය කරන්න; තත්ත්වය නරක වුවහොත් වහාම හදිසි ක්ලිනිකයක් අමතන්න. හමුවීමට එන්නත් සහ වෛද්‍ය වාර්තා රැගෙන එන්න.",
        "ta": "நெருக்கமாக கண்காணிக்கவும்; நிலை மோசமானால் உடனடியாக அவசர கிளினிக்கைத் தொடர்பு கொள்ளவும். சந்திப்பிற்கு தடுப்பூசி மற்றும் மருத்துவ பதிவுகளைக் கொண்டு வாருங்கள்.",
    },
    "schedule_consult_title": {
        "en": "Schedule a consultation",
        "si": "උපදේශනයක් වෙන් කරන්න",
        "ta": "ஆலோசனையை பதிவு செய்யவும்",
    },
    "schedule_consult_message": {
        "en": "Schedule a veterinary consultation within 48 hours.",
        "si": "පැය 48ක් ඇතුළත පශු වෛද්‍ය උපදේශනයක් වෙන් කරන්න.",
        "ta": "48 மணிநேரத்திற்குள் கால்நடை மருத்துவ ஆலோசனையை பதிவு செய்யவும்.",
    },
    "likely_conditions": {
        "en": " Likely conditions: {diseases}.",
        "si": " විය හැකි තත්ත්ව: {diseases}.",
        "ta": " சாத்தியமான நிலைகள்: {diseases}.",
    },
    "monitor_vitals_title": {
        "en": "Monitor vitals",
        "si": "ජීව ලක්ෂණ නිරීක්ෂණය",
        "ta": "முக்கியக் குறிகளை கண்காணி",
    },
    "monitor_vitals_message": {
        "en": "Check appetite, hydration and activity every 6 hours and keep a symptom log for the vet.",
        "si": "සෑම පැය 6කට වරක් ආහාර රුචිය, ජලය පානය සහ ක්‍රියාකාරීත්වය පරීක්ෂා කර වෙට් සඳහා රෝග ලක්ෂණ සටහනක් තබන්න.",
        "ta": "ஒவ்வொரு 6 மணிநேரமும் பசி, நீரேற்றம் மற்றும் செயல்பாட்டை சரிபார்த்து, வெட்டுக்காக அறிகுறி பதிவை வைத்திருங்கள்.",
    },
    "home_monitoring_title": {
        "en": "Home monitoring",
        "si": "නිවසේ නිරීක්ෂණය",
        "ta": "வீட்டில் கண்காணிப்பு",
    },
    "home_monitoring_message": {
        "en": "Continue monitoring at home and log symptoms daily. Recheck in 3-7 days if symptoms persist or worsen.",
        "si": "නිවසේ නිරීක්ෂණය දිගටම කර දිනපතා රෝග ලක්ෂණ සටහන් කරන්න. රෝග ලක්ෂණ පවතින්නේ නම් හෝ නරක වන්නේ නම් දින 3-7කින් නැවත පරීක්ෂා කරන්න.",
        "ta": "வீட்டில் கண்காணிப்பைத் தொடர்ந்து தினமும் அறிகுறிகளைப் பதிவு செய்யவும். அறிகுறிகள் தொடர்ந்தால் அல்லது மோசமானால் 3-7 நாட்களில் மீண்டும் சரிபார்க்கவும்.",
    },
    "composer_vet_message": {
        "en": "Based on the {risk} risk assessment, a veterinary consultation is recommended",
        "si": "{risk} අවදානම් ඇගයීම මත, පශු වෛද්‍ය උපදේශනයක් නිර්දේශ කෙරේ",
        "ta": "{risk} அபாய மதிப்பீட்டின் அடிப்படையில், கால்நடை மருத்துவ ஆலோசனை பரிந்துரைக்கப்படுகிறது",
    },
    "composer_within_hours": {
        "en": " within {hours} hours.",
        "si": " පැය {hours}ක් ඇතුළත.",
        "ta": " {hours} மணிநேரத்திற்குள்.",
    },
    "composer_consult_title": {
        "en": "Veterinary consultation",
        "si": "පශු වෛද්‍ය උපදේශනය",
        "ta": "கால்நடை மருத்துவ ஆலோசனை",
    },
    "risk_word_high": {"en": "high", "si": "ඉහළ", "ta": "உயர்"},
    "risk_word_medium": {"en": "medium", "si": "මධ්‍යම", "ta": "நடுத்தர"},
    "risk_word_low": {"en": "low", "si": "අඩු", "ta": "குறைந்த"},

    # ── vaccination findings ──
    "vaccine_overdue": {"en": "overdue", "si": "කල් ඉකුත් වී ඇත", "ta": "காலாவதியானது"},
    "vaccine_due_soon": {"en": "due soon", "si": "ළඟදීම නියමිතයි", "ta": "விரைவில் நிலுவை"},
    "vaccine_linked_message": {
        "en": "{vaccine} is {status} and protects against {diseases} — one of the predicted conditions. Prioritise this booster within 48 hours.",
        "si": "{vaccine} {status} — එය පුරෝකථනය කළ තත්ත්වයක් වන {diseases} වලින් ආරක්ෂා කරයි. පැය 48ක් ඇතුළත මෙම බූස්ටරයට ප්‍රමුඛත්වය දෙන්න.",
        "ta": "{vaccine} {status} — இது கணிக்கப்பட்ட நிலைகளில் ஒன்றான {diseases}க்கு எதிராக பாதுகாக்கிறது. 48 மணிநேரத்திற்குள் இந்த பூஸ்டருக்கு முன்னுரிமை கொடுங்கள்.",
    },
    "vaccine_plain_message": {
        "en": "{vaccine} is {status} (due {date}). Schedule a booster.",
        "si": "{vaccine} {status} (නියමිත දිනය {date}). බූස්ටරයක් වෙන් කරන්න.",
        "ta": "{vaccine} {status} (நிலுவைத் தேதி {date}). பூஸ்டரை பதிவு செய்யவும்.",
    },

    # ── explanations ──
    "fallback_explanation": {
        "en": "Rule-based guidance from risk level '{risk}' with {confidence_category} confidence ({confidence}).",
        "si": "'{risk}' අවදානම් මට්ටම සහ {confidence_category} විශ්වාසය ({confidence}) මත පදනම් වූ නීති මාර්ගෝපදේශනය.",
        "ta": "'{risk}' அபாய நிலை மற்றும் {confidence_category} நம்பிக்கை ({confidence}) அடிப்படையிலான விதி வழிகாட்டுதல்.",
    },
    "top_conditions_suffix": {
        "en": " Top predicted conditions: {diseases}.",
        "si": " ප්‍රධාන පුරෝකථනය කළ තත්ත්ව: {diseases}.",
        "ta": " முதன்மை கணிக்கப்பட்ட நிலைகள்: {diseases}.",
    },
    "composer_explanation": {
        "en": "Combined ML risk ({risk}, {confidence} confidence), ontology links and preventive-care status to produce this guidance.",
        "si": "මෙම මඟපෙන්වීම ML අවදානම ({risk}, {confidence} විශ්වාසය), ඔන්ටොලොජි සම්බන්ධතා සහ වැළැක්වීමේ සත්කාර තත්ත්වය ඒකාබද්ධ කර සකසන ලදී.",
        "ta": "இந்த வழிகாட்டுதல் ML அபாயம் ({risk}, {confidence} நம்பிக்கை), ஆன்டாலஜி இணைப்புகள் மற்றும் தடுப்பு பராமரிப்பு நிலையை இணைத்து உருவாக்கப்பட்டது.",
    },

    # ── monitoring notifications ──
    "notif_risk_title": {
        "en": "{pet}: {risk} disease risk needs follow-up",
        "si": "{pet}: {risk} රෝග අවදානමට පසු විපරමක් අවශ්‍යයි",
        "ta": "{pet}: {risk} நோய் அபாயத்திற்கு பின்தொடர்தல் தேவை",
    },
    "notif_risk_body": {
        "en": "The last assessment flagged {risk} risk ({disease}). ",
        "si": "අවසන් ඇගයීමෙන් {risk} අවදානමක් ({disease}) හඳුනාගන්නා ලදී. ",
        "ta": "கடைசி மதிப்பீடு {risk} அபாயத்தைக் ({disease}) கண்டறிந்தது. ",
    },
    "notif_risk_high_action": {
        "en": "Book a vet visit as soon as possible.",
        "si": "හැකි ඉක්මනින් වෙට් හමුවක් වෙන් කරන්න.",
        "ta": "கூடிய விரைவில் வெட் வருகையை பதிவு செய்யவும்.",
    },
    "notif_risk_medium_action": {
        "en": "Consider a vet check-up if symptoms persist.",
        "si": "රෝග ලක්ෂණ පවතින්නේ නම් වෙට් පරීක්ෂාවක් සලකා බලන්න.",
        "ta": "அறிகுறிகள் தொடர்ந்தால் வெட் பரிசோதனையை பரிசீலிக்கவும்.",
    },
    "notif_health_concern": {
        "en": "a health concern",
        "si": "සෞඛ්‍ය ගැටලුවක්",
        "ta": "ஒரு சுகாதார கவலை",
    },
    "notif_vacc_title": {
        "en": "{pet}: {vaccine} {status}",
        "si": "{pet}: {vaccine} {status}",
        "ta": "{pet}: {vaccine} {status}",
    },
    "notif_vacc_overdue_body": {
        "en": "{vaccine} was due {date}.",
        "si": "{vaccine} නියමිත දිනය {date} විය.",
        "ta": "{vaccine} நிலுவைத் தேதி {date} ஆகும்.",
    },
    "notif_vacc_due_body": {
        "en": "{vaccine} is due by {date}.",
        "si": "{vaccine} {date} වන විට ලබා දිය යුතුය.",
        "ta": "{vaccine} {date}க்குள் வழங்கப்பட வேண்டும்.",
    },

    # ── three-agent pipeline ──
    "agent1_name": {
        "en": "Disease Risk Prediction Agent",
        "si": "රෝග අවදානම් පුරෝකථන නියෝජිතයා",
        "ta": "நோய் அபாய கணிப்பு முகவர்",
    },
    "agent2_name": {
        "en": "Explainable Care Recommendation Agent",
        "si": "පැහැදිලි කළ හැකි සත්කාර නිර්දේශ නියෝජිතයා",
        "ta": "விளக்கக்கூடிய பராமரிப்பு பரிந்துரை முகவர்",
    },
    "agent3_name": {
        "en": "Veterinary Discovery & Booking Agent",
        "si": "පශු වෛද්‍ය සොයාගැනීම් සහ වෙන්කිරීම් නියෝජිතයා",
        "ta": "கால்நடை மருத்துவ கண்டறிதல் & முன்பதிவு முகவர்",
    },
    "confidence_interp_high": {
        "en": "The model is highly confident in this assessment ({confidence}).",
        "si": "මෙම ඇගයීම පිළිබඳව ආකෘතිය ඉතා විශ්වාසදායකයි ({confidence}).",
        "ta": "இந்த மதிப்பீட்டில் மாதிரி மிகவும் நம்பிக்கையுடன் உள்ளது ({confidence}).",
    },
    "confidence_interp_medium": {
        "en": "The model is moderately confident ({confidence}) — monitor your pet closely.",
        "si": "ආකෘතියේ විශ්වාසය මධ්‍යස්ථයි ({confidence}) — ඔබේ සුරතලා සමීපව නිරීක්ෂණය කරන්න.",
        "ta": "மாதிரியின் நம்பிக்கை மிதமானது ({confidence}) — உங்கள் பிராணியை நெருக்கமாக கண்காணிக்கவும்.",
    },
    "confidence_interp_low": {
        "en": "Model confidence is low ({confidence}) — treat this as an early signal only.",
        "si": "ආකෘතියේ විශ්වාසය අඩුයි ({confidence}) — මෙය මූලික සංඥාවක් ලෙස පමණක් සලකන්න.",
        "ta": "மாதிரியின் நம்பிக்கை குறைவு ({confidence}) — இதை ஆரம்ப சமிக்ஞையாக மட்டுமே கருதவும்.",
    },
    "top_symptoms_prefix": {
        "en": " Signals that most influenced this prediction: {features}.",
        "si": " මෙම පුරෝකථනයට වැඩිම බලපෑමක් කළ සංඥා: {features}.",
        "ta": " இந்த கணிப்பை அதிகம் பாதித்த சமிக்ஞைகள்: {features}.",
    },
    "match_reason_spec": {
        "en": "Best nearby match for {spec}",
        "si": "{spec} සඳහා ආසන්නතම ගැළපීම",
        "ta": "{spec}க்கு அருகிலுள்ள சிறந்த பொருத்தம்",
    },
    "match_reason_general": {
        "en": "Nearest clinic with available time slots",
        "si": "වේලාවන් ලබාගත හැකි ආසන්නතම ක්ලිනිකය",
        "ta": "நேரங்கள் கிடைக்கும் அருகிலுள்ள கிளினிக்",
    },
    "spec_dermatology": {"en": "dermatology care", "si": "සම් රෝග සත්කාරය", "ta": "தோல் சிகிச்சை"},
    "spec_orthopedics": {"en": "orthopedic care", "si": "අස්ථි සත්කාරය", "ta": "எலும்பியல் சிகிச்சை"},
    "spec_internal": {"en": "internal medicine", "si": "අභ්‍යන්තර වෛද්‍ය සත්කාරය", "ta": "உள் மருத்துவம்"},
    "spec_emergency": {"en": "emergency care", "si": "හදිසි සත්කාරය", "ta": "அவசர சிகிச்சை"},
    "spec_general": {"en": "general care", "si": "පොදු සත්කාරය", "ta": "பொது சிகிச்சை"},
    "spec_cardiology": {"en": "cardiology care", "si": "හෘද රෝග සත්කාරය", "ta": "இதய சிகிச்சை"},
    "spec_oncology": {"en": "oncology care", "si": "පිළිකා සත්කාරය", "ta": "புற்றுநோய் சிகிச்சை"},
    "notif_vacc_linked_suffix": {
        "en": " This vaccine protects against a condition flagged in the latest risk assessment — prioritise it.",
        "si": " මෙම එන්නත අවසන් අවදානම් ඇගයීමේදී හඳුනාගත් තත්ත්වයකින් ආරක්ෂා කරයි — එයට ප්‍රමුඛත්වය දෙන්න.",
        "ta": " இந்த தடுப்பூசி சமீபத்திய அபாய மதிப்பீட்டில் கண்டறியப்பட்ட நிலைக்கு எதிராக பாதுகாக்கிறது — இதற்கு முன்னுரிமை கொடுங்கள்.",
    },
}


def normalize(language: str | None) -> str:
    return language if language in SUPPORTED else "en"


def msg(language: str | None, key: str, **params: object) -> str:
    lang = normalize(language)
    template = MESSAGES.get(key, {}).get(lang) or MESSAGES.get(key, {}).get("en", key)
    try:
        return template.format(**params)
    except (KeyError, IndexError):
        return template


def risk_word(language: str | None, risk_level: str) -> str:
    return msg(language, f"risk_word_{risk_level}") if risk_level in {"high", "medium", "low"} else risk_level
