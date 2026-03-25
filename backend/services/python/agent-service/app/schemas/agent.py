from pydantic import BaseModel
from typing import List

class AgentRequest(BaseModel):
    pet_id: str
    risk_level: str
    confidence_score: float
    predicted_diseases: List[str]
