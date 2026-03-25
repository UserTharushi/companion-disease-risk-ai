# Neo4j Ontology (Agentic Layer)

This ontology supports agentic reasoning for:
- symptom-to-disease interpretation,
- disease-to-vaccine preventive guidance,
- clinic/surgeon recommendation enrichment.

## Apply schema

1. Start Neo4j (`docker-compose up neo4j -d`).
2. Open Neo4j Browser at `http://localhost:7474`.
3. Run `ontology/neo4j/schema.cypher`.

## Core node labels

- `Pet`
- `Symptom`
- `Disease`
- `Vaccine`
- `Clinic`
- `Surgeon`

## Core relationships

- `(:Symptom)-[:INDICATES]->(:Disease)`
- `(:Vaccine)-[:PREVENTS]->(:Disease)`
- `(:Clinic)-[:HAS_SURGEON]->(:Surgeon)`
- `(:Pet)-[:HAS_SYMPTOM]->(:Symptom)`
