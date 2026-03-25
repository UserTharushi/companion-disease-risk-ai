CREATE CONSTRAINT pet_id IF NOT EXISTS FOR (p:Pet) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT disease_name IF NOT EXISTS FOR (d:Disease) REQUIRE d.name IS UNIQUE;
CREATE CONSTRAINT symptom_name IF NOT EXISTS FOR (s:Symptom) REQUIRE s.name IS UNIQUE;
CREATE CONSTRAINT vaccine_name IF NOT EXISTS FOR (v:Vaccine) REQUIRE v.name IS UNIQUE;
CREATE CONSTRAINT clinic_id IF NOT EXISTS FOR (c:Clinic) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT surgeon_id IF NOT EXISTS FOR (sg:Surgeon) REQUIRE sg.id IS UNIQUE;

MERGE (d1:Disease {name: "Kidney Disease"})
MERGE (d2:Disease {name: "Gastrointestinal Disorder"})
MERGE (d3:Disease {name: "Respiratory Infection"})
MERGE (d4:Disease {name: "Skin Infection"})

MERGE (s1:Symptom {name: "reduced_appetite"})
MERGE (s2:Symptom {name: "increased_water_intake"})
MERGE (s3:Symptom {name: "lethargy"})
MERGE (s4:Symptom {name: "vomiting"})
MERGE (s5:Symptom {name: "increased_urination"})

MERGE (v1:Vaccine {name: "Rabies Vaccine"})
MERGE (v2:Vaccine {name: "DHPP Vaccine"})
MERGE (v3:Vaccine {name: "FVRCP Vaccine"})

MERGE (s1)-[:INDICATES {weight: 0.72}]->(d1)
MERGE (s2)-[:INDICATES {weight: 0.68}]->(d1)
MERGE (s3)-[:INDICATES {weight: 0.66}]->(d1)
MERGE (s4)-[:INDICATES {weight: 0.71}]->(d2)
MERGE (s5)-[:INDICATES {weight: 0.69}]->(d1)

MERGE (v1)-[:PREVENTS]->(d3)
MERGE (v2)-[:PREVENTS]->(d2)
MERGE (v3)-[:PREVENTS]->(d4);
