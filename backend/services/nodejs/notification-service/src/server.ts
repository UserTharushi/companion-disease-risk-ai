import "dotenv/config";
import app from "./app";

const PORT = process.env.NOTIFICATION_SERVICE_PORT || 4004;
app.listen(PORT, () => console.log(`[notification-service] running on port ${PORT}`));
