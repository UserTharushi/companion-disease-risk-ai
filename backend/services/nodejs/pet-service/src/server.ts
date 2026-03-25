import "dotenv/config";
import app from "./app";
const PORT = process.env.PET_SERVICE_PORT || 4002;
app.listen(PORT, () => console.log(`[pet-service] running on port ${PORT}`));
