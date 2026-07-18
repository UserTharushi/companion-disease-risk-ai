// Companion Disease Risk AI — ontology schema + seed.
// Idempotent (constraints IF NOT EXISTS, MERGE everywhere).
// Applied automatically by ai-service on startup (app/services/ontology.py),
// or manually: python scripts/apply_ontology.py / Neo4j Browser.
// Symptom names are lowercase and MUST match the tokens produced by
// backend/services/python/ai-service/app/services/feature_bridge.py.

CREATE CONSTRAINT pet_id IF NOT EXISTS FOR (p:Pet) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT disease_name IF NOT EXISTS FOR (d:Disease) REQUIRE d.name IS UNIQUE;
CREATE CONSTRAINT symptom_name IF NOT EXISTS FOR (s:Symptom) REQUIRE s.name IS UNIQUE;
CREATE CONSTRAINT vaccine_name IF NOT EXISTS FOR (v:Vaccine) REQUIRE v.name IS UNIQUE;
CREATE CONSTRAINT clinic_id IF NOT EXISTS FOR (c:Clinic) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT surgeon_id IF NOT EXISTS FOR (sg:Surgeon) REQUIRE sg.id IS UNIQUE;

// ── Diseases (trilingual display names on each node) ──
MERGE (d:Disease {name: "Skin Irritations"}) SET d.category = "dataset-condition", d.species = "dog,cat", d.name_si = "සමේ කෝපවීම්", d.name_ta = "தோல் எரிச்சல்கள்";
MERGE (d:Disease {name: "Digestive Issues"}) SET d.category = "dataset-condition", d.species = "dog,cat", d.name_si = "ජීරණ ගැටලු", d.name_ta = "செரிமான பிரச்சனைகள்";
MERGE (d:Disease {name: "Parasites"}) SET d.category = "dataset-condition", d.species = "dog,cat", d.name_si = "පරපෝෂිතයන්", d.name_ta = "ஒட்டுண்ணிகள்";
MERGE (d:Disease {name: "Ear Infections"}) SET d.category = "dataset-condition", d.species = "dog,cat", d.name_si = "කන් ආසාදන", d.name_ta = "காது தொற்றுகள்";
MERGE (d:Disease {name: "Mobility Problems"}) SET d.category = "dataset-condition", d.species = "dog,cat", d.name_si = "චලන ගැටලු", d.name_ta = "இயக்கச் சிக்கல்கள்";
// Migration: replace the old node name with the chronic form
MATCH (old:Disease {name: "Kidney Disease"}) DETACH DELETE old;
MERGE (d:Disease {name: "Chronic Kidney Disease"}) SET d.category = "clinical", d.species = "dog,cat", d.name_si = "නිදන්ගත වකුගඩු රෝගය", d.name_ta = "நாள்பட்ட சிறுநீரக நோய்";
MERGE (d:Disease {name: "Liver Disease"}) SET d.category = "clinical", d.species = "dog,cat", d.name_si = "අක්මා රෝගය", d.name_ta = "கல்லீரல் நோய்";
MERGE (d:Disease {name: "Heart Disease"}) SET d.category = "clinical", d.species = "dog,cat", d.name_si = "හෘද රෝගය", d.name_ta = "இதய நோய்";
MERGE (d:Disease {name: "Pancreatitis"}) SET d.category = "clinical", d.species = "dog,cat", d.name_si = "අග්න්‍යාශ ප්‍රදාහය", d.name_ta = "கணைய அழற்சி";
MERGE (d:Disease {name: "Cancer"}) SET d.category = "clinical", d.species = "dog,cat", d.name_si = "පිළිකා", d.name_ta = "புற்றுநோய்";
MERGE (d:Disease {name: "Gastrointestinal Disorder"}) SET d.category = "clinical", d.species = "dog,cat", d.name_si = "ආමාශ ආන්ත්‍රික ආබාධය", d.name_ta = "இரைப்பை குடல் கோளாறு";
MERGE (d:Disease {name: "Respiratory Infection"}) SET d.category = "clinical", d.species = "dog,cat", d.name_si = "ශ්වසන ආසාදනය", d.name_ta = "சுவாசத் தொற்று";
MERGE (d:Disease {name: "Skin Infection"}) SET d.category = "clinical", d.species = "dog,cat", d.name_si = "සමේ ආසාදනය", d.name_ta = "தோல் தொற்று";
MERGE (d:Disease {name: "Diabetes Mellitus"}) SET d.category = "clinical", d.species = "dog,cat", d.name_si = "දියවැඩියාව", d.name_ta = "நீரிழிவு நோய்";
MERGE (d:Disease {name: "Parvovirus"}) SET d.category = "clinical", d.species = "dog", d.name_si = "පාවෝ වෛරසය", d.name_ta = "பார்வோ வைரஸ்";
MERGE (d:Disease {name: "Distemper"}) SET d.category = "clinical", d.species = "dog", d.name_si = "ඩිස්ටෙම්පර් රෝගය", d.name_ta = "டிஸ்டெம்பர் நோய்";
MERGE (d:Disease {name: "Leptospirosis"}) SET d.category = "clinical", d.species = "dog", d.name_si = "ලෙප්ටොස්පයිරෝසිස් (මී උණ)", d.name_ta = "லெப்டோஸ்பைரோசிஸ்";
MERGE (d:Disease {name: "Kennel Cough"}) SET d.category = "clinical", d.species = "dog", d.name_si = "කෙනල් කැස්ස", d.name_ta = "கென்னல் இருமல்";
MERGE (d:Disease {name: "Feline Leukemia"}) SET d.category = "clinical", d.species = "cat", d.name_si = "පූස ලියුකේමියාව", d.name_ta = "பூனை லுகேமியா";
MERGE (d:Disease {name: "Feline Upper Respiratory Infection"}) SET d.category = "clinical", d.species = "cat", d.name_si = "පූසන්ගේ ඉහළ ශ්වසන ආසාදනය", d.name_ta = "பூனை மேல் சுவாசத் தொற்று";

// ── Symptoms (lowercase - align with feature_bridge tokens; trilingual names) ──
MERGE (s:Symptom {name: "lethargy"}) SET s.name_si = "අලසභාවය", s.name_ta = "சோர்வு";
MERGE (s:Symptom {name: "loss of appetite"}) SET s.name_si = "ආහාර රුචිය නැතිවීම", s.name_ta = "பசியின்மை";
MERGE (s:Symptom {name: "vomiting"}) SET s.name_si = "වමනය", s.name_ta = "வாந்தி";
MERGE (s:Symptom {name: "diarrhoea"}) SET s.name_si = "පාචනය", s.name_ta = "வயிற்றுப்போக்கு";
MERGE (s:Symptom {name: "increased urination"}) SET s.name_si = "මුත්‍රා කිරීම වැඩිවීම", s.name_ta = "அதிக சிறுநீர் கழித்தல்";
MERGE (s:Symptom {name: "increased thirst"}) SET s.name_si = "පිපාසය වැඩිවීම", s.name_ta = "அதிக தாகம்";
MERGE (s:Symptom {name: "coughing"}) SET s.name_si = "කැස්ස", s.name_ta = "இருமல்";
MERGE (s:Symptom {name: "fever"}) SET s.name_si = "උණ", s.name_ta = "காய்ச்சல்";
MERGE (s:Symptom {name: "difficulty breathing"}) SET s.name_si = "හුස්ම ගැනීමේ අපහසුතාව", s.name_ta = "மூச்சுத்திணறல்";
MERGE (s:Symptom {name: "skin lesions"}) SET s.name_si = "සමේ තුවාල", s.name_ta = "தோல் புண்கள்";
MERGE (s:Symptom {name: "lameness"}) SET s.name_si = "කොර ගැසීම", s.name_ta = "நொண்டுதல்";
MERGE (s:Symptom {name: "reduced activity"}) SET s.name_si = "ක්‍රියාකාරීත්වය අඩුවීම", s.name_ta = "செயல்பாடு குறைவு";
MERGE (s:Symptom {name: "ear scratching"}) SET s.name_si = "කන් කැසීම", s.name_ta = "காது சொறிதல்";
MERGE (s:Symptom {name: "head shaking"}) SET s.name_si = "හිස සෙලවීම", s.name_ta = "தலை உலுக்குதல்";
MERGE (s:Symptom {name: "weight loss"}) SET s.name_si = "බර අඩුවීම", s.name_ta = "எடை இழப்பு";
MERGE (s:Symptom {name: "dehydration"}) SET s.name_si = "විජලනය", s.name_ta = "நீரிழப்பு";
MERGE (s:Symptom {name: "pale gums"}) SET s.name_si = "සුදුමැලි විදුරුමස්", s.name_ta = "வெளிறிய ஈறுகள்";
MERGE (s:Symptom {name: "excessive scratching"}) SET s.name_si = "අධික කැසීම", s.name_ta = "அதிக சொறிதல்";
MERGE (s:Symptom {name: "hair loss"}) SET s.name_si = "ලොම් වැටීම", s.name_ta = "முடி உதிர்தல்";
MERGE (s:Symptom {name: "nasal discharge"}) SET s.name_si = "නාසයෙන් දියර ගැලීම", s.name_ta = "மூக்கு ஒழுகுதல்";
MERGE (s:Symptom {name: "swollen abdomen"}) SET s.name_si = "ඉදිමුණු උදරය", s.name_ta = "வீங்கிய வயிறு";
MERGE (s:Symptom {name: "lump or swelling"}) SET s.name_si = "ගැටිත්තක් හෝ ඉදිමීමක්", s.name_ta = "கட்டி அல்லது வீக்கம்";
MERGE (s:Symptom {name: "jaundice"}) SET s.name_si = "කහ පැහැ වීම (කාමලාව)", s.name_ta = "மஞ்சள் காமாலை";
MERGE (s:Symptom {name: "fainting"}) SET s.name_si = "සිහිසුන් වීම", s.name_ta = "மயக்கம்";

// ── INDICATES (symptom -> disease, weighted) ──
MATCH (s:Symptom {name: "vomiting"}), (d:Disease {name: "Digestive Issues"}) MERGE (s)-[:INDICATES {weight: 0.78}]->(d);
MATCH (s:Symptom {name: "diarrhoea"}), (d:Disease {name: "Digestive Issues"}) MERGE (s)-[:INDICATES {weight: 0.80}]->(d);
MATCH (s:Symptom {name: "loss of appetite"}), (d:Disease {name: "Digestive Issues"}) MERGE (s)-[:INDICATES {weight: 0.55}]->(d);
MATCH (s:Symptom {name: "vomiting"}), (d:Disease {name: "Gastrointestinal Disorder"}) MERGE (s)-[:INDICATES {weight: 0.71}]->(d);
MATCH (s:Symptom {name: "diarrhoea"}), (d:Disease {name: "Parvovirus"}) MERGE (s)-[:INDICATES {weight: 0.62}]->(d);
MATCH (s:Symptom {name: "lethargy"}), (d:Disease {name: "Parvovirus"}) MERGE (s)-[:INDICATES {weight: 0.50}]->(d);

MATCH (s:Symptom {name: "skin lesions"}), (d:Disease {name: "Skin Irritations"}) MERGE (s)-[:INDICATES {weight: 0.82}]->(d);
MATCH (s:Symptom {name: "excessive scratching"}), (d:Disease {name: "Skin Irritations"}) MERGE (s)-[:INDICATES {weight: 0.76}]->(d);
MATCH (s:Symptom {name: "hair loss"}), (d:Disease {name: "Skin Irritations"}) MERGE (s)-[:INDICATES {weight: 0.68}]->(d);
MATCH (s:Symptom {name: "skin lesions"}), (d:Disease {name: "Skin Infection"}) MERGE (s)-[:INDICATES {weight: 0.66}]->(d);

MATCH (s:Symptom {name: "lethargy"}), (d:Disease {name: "Parasites"}) MERGE (s)-[:INDICATES {weight: 0.48}]->(d);
MATCH (s:Symptom {name: "weight loss"}), (d:Disease {name: "Parasites"}) MERGE (s)-[:INDICATES {weight: 0.64}]->(d);
MATCH (s:Symptom {name: "diarrhoea"}), (d:Disease {name: "Parasites"}) MERGE (s)-[:INDICATES {weight: 0.58}]->(d);
MATCH (s:Symptom {name: "pale gums"}), (d:Disease {name: "Parasites"}) MERGE (s)-[:INDICATES {weight: 0.61}]->(d);

MATCH (s:Symptom {name: "ear scratching"}), (d:Disease {name: "Ear Infections"}) MERGE (s)-[:INDICATES {weight: 0.84}]->(d);
MATCH (s:Symptom {name: "head shaking"}), (d:Disease {name: "Ear Infections"}) MERGE (s)-[:INDICATES {weight: 0.79}]->(d);

MATCH (s:Symptom {name: "lameness"}), (d:Disease {name: "Mobility Problems"}) MERGE (s)-[:INDICATES {weight: 0.81}]->(d);
MATCH (s:Symptom {name: "reduced activity"}), (d:Disease {name: "Mobility Problems"}) MERGE (s)-[:INDICATES {weight: 0.57}]->(d);

MATCH (s:Symptom {name: "increased urination"}), (d:Disease {name: "Chronic Kidney Disease"}) MERGE (s)-[:INDICATES {weight: 0.69}]->(d);
MATCH (s:Symptom {name: "increased thirst"}), (d:Disease {name: "Chronic Kidney Disease"}) MERGE (s)-[:INDICATES {weight: 0.68}]->(d);
MATCH (s:Symptom {name: "loss of appetite"}), (d:Disease {name: "Chronic Kidney Disease"}) MERGE (s)-[:INDICATES {weight: 0.52}]->(d);
MATCH (s:Symptom {name: "dehydration"}), (d:Disease {name: "Chronic Kidney Disease"}) MERGE (s)-[:INDICATES {weight: 0.63}]->(d);
MATCH (s:Symptom {name: "increased thirst"}), (d:Disease {name: "Diabetes Mellitus"}) MERGE (s)-[:INDICATES {weight: 0.72}]->(d);
MATCH (s:Symptom {name: "increased urination"}), (d:Disease {name: "Diabetes Mellitus"}) MERGE (s)-[:INDICATES {weight: 0.70}]->(d);
MATCH (s:Symptom {name: "weight loss"}), (d:Disease {name: "Diabetes Mellitus"}) MERGE (s)-[:INDICATES {weight: 0.58}]->(d);

MATCH (s:Symptom {name: "coughing"}), (d:Disease {name: "Respiratory Infection"}) MERGE (s)-[:INDICATES {weight: 0.74}]->(d);
MATCH (s:Symptom {name: "difficulty breathing"}), (d:Disease {name: "Respiratory Infection"}) MERGE (s)-[:INDICATES {weight: 0.77}]->(d);
MATCH (s:Symptom {name: "nasal discharge"}), (d:Disease {name: "Respiratory Infection"}) MERGE (s)-[:INDICATES {weight: 0.67}]->(d);
MATCH (s:Symptom {name: "coughing"}), (d:Disease {name: "Kennel Cough"}) MERGE (s)-[:INDICATES {weight: 0.80}]->(d);
MATCH (s:Symptom {name: "nasal discharge"}), (d:Disease {name: "Feline Upper Respiratory Infection"}) MERGE (s)-[:INDICATES {weight: 0.71}]->(d);
MATCH (s:Symptom {name: "fever"}), (d:Disease {name: "Leptospirosis"}) MERGE (s)-[:INDICATES {weight: 0.54}]->(d);
MATCH (s:Symptom {name: "lethargy"}), (d:Disease {name: "Feline Leukemia"}) MERGE (s)-[:INDICATES {weight: 0.45}]->(d);
MATCH (s:Symptom {name: "pale gums"}), (d:Disease {name: "Feline Leukemia"}) MERGE (s)-[:INDICATES {weight: 0.59}]->(d);

// ── INDICATES: chronic diseases ──
MATCH (s:Symptom {name: "weight loss"}), (d:Disease {name: "Chronic Kidney Disease"}) MERGE (s)-[:INDICATES {weight: 0.60}]->(d);
MATCH (s:Symptom {name: "jaundice"}), (d:Disease {name: "Liver Disease"}) MERGE (s)-[:INDICATES {weight: 0.88}]->(d);
MATCH (s:Symptom {name: "swollen abdomen"}), (d:Disease {name: "Liver Disease"}) MERGE (s)-[:INDICATES {weight: 0.58}]->(d);
MATCH (s:Symptom {name: "vomiting"}), (d:Disease {name: "Liver Disease"}) MERGE (s)-[:INDICATES {weight: 0.45}]->(d);
MATCH (s:Symptom {name: "coughing"}), (d:Disease {name: "Heart Disease"}) MERGE (s)-[:INDICATES {weight: 0.72}]->(d);
MATCH (s:Symptom {name: "difficulty breathing"}), (d:Disease {name: "Heart Disease"}) MERGE (s)-[:INDICATES {weight: 0.75}]->(d);
MATCH (s:Symptom {name: "fainting"}), (d:Disease {name: "Heart Disease"}) MERGE (s)-[:INDICATES {weight: 0.80}]->(d);
MATCH (s:Symptom {name: "reduced activity"}), (d:Disease {name: "Heart Disease"}) MERGE (s)-[:INDICATES {weight: 0.55}]->(d);
MATCH (s:Symptom {name: "swollen abdomen"}), (d:Disease {name: "Heart Disease"}) MERGE (s)-[:INDICATES {weight: 0.42}]->(d);
MATCH (s:Symptom {name: "vomiting"}), (d:Disease {name: "Pancreatitis"}) MERGE (s)-[:INDICATES {weight: 0.68}]->(d);
MATCH (s:Symptom {name: "swollen abdomen"}), (d:Disease {name: "Pancreatitis"}) MERGE (s)-[:INDICATES {weight: 0.66}]->(d);
MATCH (s:Symptom {name: "loss of appetite"}), (d:Disease {name: "Pancreatitis"}) MERGE (s)-[:INDICATES {weight: 0.50}]->(d);
MATCH (s:Symptom {name: "lump or swelling"}), (d:Disease {name: "Cancer"}) MERGE (s)-[:INDICATES {weight: 0.85}]->(d);
MATCH (s:Symptom {name: "weight loss"}), (d:Disease {name: "Cancer"}) MERGE (s)-[:INDICATES {weight: 0.62}]->(d);
MATCH (s:Symptom {name: "pale gums"}), (d:Disease {name: "Cancer"}) MERGE (s)-[:INDICATES {weight: 0.45}]->(d);

// ── Vaccines (trilingual names) ──
MERGE (v:Vaccine {name: "Rabies Vaccine"}) SET v.species = "dog,cat", v.frequency_months = 12, v.name_si = "ජලභීතිකා එන්නත", v.name_ta = "ரேபிஸ் தடுப்பூசி";
MERGE (v:Vaccine {name: "DHPP Vaccine"}) SET v.species = "dog", v.frequency_months = 12, v.name_si = "DHPP එන්නත", v.name_ta = "DHPP தடுப்பூசி";
MERGE (v:Vaccine {name: "Leptospirosis Vaccine"}) SET v.species = "dog", v.frequency_months = 12, v.name_si = "ලෙප්ටොස්පයිරෝසිස් එන්නත", v.name_ta = "லெப்டோஸ்பைரோசிஸ் தடுப்பூசி";
MERGE (v:Vaccine {name: "Bordetella Vaccine"}) SET v.species = "dog", v.frequency_months = 12, v.name_si = "බෝඩෙටෙලා එන්නත", v.name_ta = "போர்டெடெல்லா தடுப்பூசி";
MERGE (v:Vaccine {name: "FVRCP Vaccine"}) SET v.species = "cat", v.frequency_months = 12, v.name_si = "FVRCP එන්නත", v.name_ta = "FVRCP தடுப்பூசி";
MERGE (v:Vaccine {name: "FeLV Vaccine"}) SET v.species = "cat", v.frequency_months = 12, v.name_si = "FeLV එන්නත", v.name_ta = "FeLV தடுப்பூசி";
MERGE (v:Vaccine {name: "Deworming Treatment"}) SET v.species = "dog,cat", v.frequency_months = 3, v.name_si = "පණු මර්දන ප්‍රතිකාරය", v.name_ta = "குடற்புழு நீக்க சிகிச்சை";
MERGE (v:Vaccine {name: "Flea & Tick Prevention"}) SET v.species = "dog,cat", v.frequency_months = 1, v.name_si = "මැක්කන් සහ කිනිතුල්ලන් වැළැක්වීම", v.name_ta = "தெள்ளு & உண்ணி தடுப்பு";

// ── PREVENTS (vaccine -> disease) ──
MATCH (v:Vaccine {name: "DHPP Vaccine"}), (d:Disease {name: "Parvovirus"}) MERGE (v)-[:PREVENTS]->(d);
MATCH (v:Vaccine {name: "DHPP Vaccine"}), (d:Disease {name: "Distemper"}) MERGE (v)-[:PREVENTS]->(d);
MATCH (v:Vaccine {name: "DHPP Vaccine"}), (d:Disease {name: "Digestive Issues"}) MERGE (v)-[:PREVENTS]->(d);
MATCH (v:Vaccine {name: "Leptospirosis Vaccine"}), (d:Disease {name: "Leptospirosis"}) MERGE (v)-[:PREVENTS]->(d);
MATCH (v:Vaccine {name: "Leptospirosis Vaccine"}), (d:Disease {name: "Chronic Kidney Disease"}) MERGE (v)-[:PREVENTS]->(d);
MATCH (v:Vaccine {name: "Bordetella Vaccine"}), (d:Disease {name: "Kennel Cough"}) MERGE (v)-[:PREVENTS]->(d);
MATCH (v:Vaccine {name: "Bordetella Vaccine"}), (d:Disease {name: "Respiratory Infection"}) MERGE (v)-[:PREVENTS]->(d);
MATCH (v:Vaccine {name: "FVRCP Vaccine"}), (d:Disease {name: "Feline Upper Respiratory Infection"}) MERGE (v)-[:PREVENTS]->(d);
MATCH (v:Vaccine {name: "FeLV Vaccine"}), (d:Disease {name: "Feline Leukemia"}) MERGE (v)-[:PREVENTS]->(d);
MATCH (v:Vaccine {name: "Deworming Treatment"}), (d:Disease {name: "Parasites"}) MERGE (v)-[:PREVENTS]->(d);
MATCH (v:Vaccine {name: "Flea & Tick Prevention"}), (d:Disease {name: "Parasites"}) MERGE (v)-[:PREVENTS]->(d);
MATCH (v:Vaccine {name: "Flea & Tick Prevention"}), (d:Disease {name: "Skin Irritations"}) MERGE (v)-[:PREVENTS]->(d);
