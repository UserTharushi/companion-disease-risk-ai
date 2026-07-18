"""Trilingual (en/si/ta) display names for ontology entities.

Canonical names stay English everywhere internally — ML class labels,
Neo4j lookups and cross-service matching all use them. These maps are
presentation-only. The same names are stored on the Neo4j nodes as
name_si / name_ta properties (see ontology/neo4j/schema.cypher).

NOTE: mirrored in ai-service app/services/names_i18n.py — keep in sync.
"""
from __future__ import annotations

DISEASE_NAMES: dict[str, dict[str, str]] = {
    "Skin Irritations": {"si": "සමේ කෝපවීම්", "ta": "தோல் எரிச்சல்கள்"},
    "Digestive Issues": {"si": "ජීරණ ගැටලු", "ta": "செரிமான பிரச்சனைகள்"},
    "Parasites": {"si": "පරපෝෂිතයන්", "ta": "ஒட்டுண்ணிகள்"},
    "Ear Infections": {"si": "කන් ආසාදන", "ta": "காது தொற்றுகள்"},
    "Mobility Problems": {"si": "චලන ගැටලු", "ta": "இயக்கச் சிக்கல்கள்"},
    "Kidney Disease": {"si": "වකුගඩු රෝගය", "ta": "சிறுநீரக நோய்"},
    "Gastrointestinal Disorder": {"si": "ආමාශ ආන්ත්‍රික ආබාධය", "ta": "இரைப்பை குடல் கோளாறு"},
    "Respiratory Infection": {"si": "ශ්වසන ආසාදනය", "ta": "சுவாசத் தொற்று"},
    "Skin Infection": {"si": "සමේ ආසාදනය", "ta": "தோல் தொற்று"},
    "Diabetes Mellitus": {"si": "දියවැඩියාව", "ta": "நீரிழிவு நோய்"},
    "Parvovirus": {"si": "පාවෝ වෛරසය", "ta": "பார்வோ வைரஸ்"},
    "Distemper": {"si": "ඩිස්ටෙම්පර් රෝගය", "ta": "டிஸ்டெம்பர் நோய்"},
    "Leptospirosis": {"si": "ලෙප්ටොස්පයිරෝසිස් (මී උණ)", "ta": "லெப்டோஸ்பைரோசிஸ்"},
    "Kennel Cough": {"si": "කෙනල් කැස්ස", "ta": "கென்னல் இருமல்"},
    "Feline Leukemia": {"si": "පූස ලියුකේමියාව", "ta": "பூனை லுகேமியா"},
    "Feline Upper Respiratory Infection": {"si": "පූසන්ගේ ඉහළ ශ්වසන ආසාදනය", "ta": "பூனை மேல் சுவாசத் தொற்று"},
    "Chronic Kidney Disease": {"si": "නිදන්ගත වකුගඩු රෝගය", "ta": "நாள்பட்ட சிறுநீரக நோய்"},
    "Liver Disease": {"si": "අක්මා රෝගය", "ta": "கல்லீரல் நோய்"},
    "Heart Disease": {"si": "හෘද රෝගය", "ta": "இதய நோய்"},
    "Pancreatitis": {"si": "අග්න්‍යාශ ප්‍රදාහය", "ta": "கணைய அழற்சி"},
    "Cancer": {"si": "පිළිකා", "ta": "புற்றுநோய்"},
}

SYMPTOM_NAMES: dict[str, dict[str, str]] = {
    "lethargy": {"si": "අලසභාවය", "ta": "சோர்வு"},
    "loss of appetite": {"si": "ආහාර රුචිය නැතිවීම", "ta": "பசியின்மை"},
    "vomiting": {"si": "වමනය", "ta": "வாந்தி"},
    "diarrhoea": {"si": "පාචනය", "ta": "வயிற்றுப்போக்கு"},
    "increased urination": {"si": "මුත්‍රා කිරීම වැඩිවීම", "ta": "அதிக சிறுநீர் கழித்தல்"},
    "increased thirst": {"si": "පිපාසය වැඩිවීම", "ta": "அதிக தாகம்"},
    "coughing": {"si": "කැස්ස", "ta": "இருமல்"},
    "fever": {"si": "උණ", "ta": "காய்ச்சல்"},
    "difficulty breathing": {"si": "හුස්ම ගැනීමේ අපහසුතාව", "ta": "மூச்சுத்திணறல்"},
    "skin lesions": {"si": "සමේ තුවාල", "ta": "தோல் புண்கள்"},
    "lameness": {"si": "කොර ගැසීම", "ta": "நொண்டுதல்"},
    "reduced activity": {"si": "ක්‍රියාකාරීත්වය අඩුවීම", "ta": "செயல்பாடு குறைவு"},
    "ear scratching": {"si": "කන් කැසීම", "ta": "காது சொறிதல்"},
    "head shaking": {"si": "හිස සෙලවීම", "ta": "தலை உலுக்குதல்"},
    "weight loss": {"si": "බර අඩුවීම", "ta": "எடை இழப்பு"},
    "dehydration": {"si": "විජලනය", "ta": "நீரிழப்பு"},
    "pale gums": {"si": "සුදුමැලි විදුරුමස්", "ta": "வெளிறிய ஈறுகள்"},
    "excessive scratching": {"si": "අධික කැසීම", "ta": "அதிக சொறிதல்"},
    "hair loss": {"si": "ලොම් වැටීම", "ta": "முடி உதிர்தல்"},
    "nasal discharge": {"si": "නාසයෙන් දියර ගැලීම", "ta": "மூக்கு ஒழுகுதல்"},
    "swollen abdomen": {"si": "ඉදිමුණු උදරය", "ta": "வீங்கிய வயிறு"},
    "lump or swelling": {"si": "ගැටිත්තක් හෝ ඉදිමීමක්", "ta": "கட்டி அல்லது வீக்கம்"},
    "jaundice": {"si": "කහ පැහැ වීම (කාමලාව)", "ta": "மஞ்சள் காமாலை"},
    "fainting": {"si": "සිහිසුන් වීම", "ta": "மயக்கம்"},
}

VACCINE_NAMES: dict[str, dict[str, str]] = {
    "Rabies Vaccine": {"si": "ජලභීතිකා එන්නත", "ta": "ரேபிஸ் தடுப்பூசி"},
    "DHPP Vaccine": {"si": "DHPP එන්නත", "ta": "DHPP தடுப்பூசி"},
    "Leptospirosis Vaccine": {"si": "ලෙප්ටොස්පයිරෝසිස් එන්නත", "ta": "லெப்டோஸ்பைரோசிஸ் தடுப்பூசி"},
    "Bordetella Vaccine": {"si": "බෝඩෙටෙලා එන්නත", "ta": "போர்டெடெல்லா தடுப்பூசி"},
    "FVRCP Vaccine": {"si": "FVRCP එන්නත", "ta": "FVRCP தடுப்பூசி"},
    "FeLV Vaccine": {"si": "FeLV එන්නත", "ta": "FeLV தடுப்பூசி"},
    "Deworming Treatment": {"si": "පණු මර්දන ප්‍රතිකාරය", "ta": "குடற்புழு நீக்க சிகிச்சை"},
    "Flea & Tick Prevention": {"si": "මැක්කන් සහ කිනිතුල්ලන් වැළැක්වීම", "ta": "தெள்ளு & உண்ணி தடுப்பு"},
}

_SYMPTOM_LOWER = {k.lower(): v for k, v in SYMPTOM_NAMES.items()}
_DISEASE_LOWER = {k.lower(): v for k, v in DISEASE_NAMES.items()}
_VACCINE_LOWER = {k.lower(): v for k, v in VACCINE_NAMES.items()}


def localize_disease(name: str, language: str | None) -> str:
    if language not in ("si", "ta"):
        return name
    return _DISEASE_LOWER.get(name.lower(), {}).get(language, name)


def localize_symptom(name: str, language: str | None) -> str:
    if language not in ("si", "ta"):
        return name
    return _SYMPTOM_LOWER.get(name.lower(), {}).get(language, name)


def localize_vaccine(name: str, language: str | None) -> str:
    if language not in ("si", "ta"):
        return name
    return _VACCINE_LOWER.get(name.lower(), {}).get(language, name)
