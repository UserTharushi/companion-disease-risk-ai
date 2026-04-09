import "dotenv/config";
import app from "./app";

const PORT = process.env.VACCINATION_SERVICE_PORT || 4005;
app.listen(PORT, () => console.log(`[vaccination-service] running on port ${PORT}`));
