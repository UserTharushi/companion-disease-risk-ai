import "dotenv/config";
import app from "./app";

const PORT = process.env.CLINIC_SERVICE_PORT || 4003;
app.listen(PORT, () => console.log(`[clinic-service] running on port ${PORT}`));
