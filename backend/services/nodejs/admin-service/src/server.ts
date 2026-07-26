import "dotenv/config";
import app from "./app";

const PORT = process.env.ADMIN_SERVICE_PORT || 4006;
app.listen(PORT, () => console.log(`[admin-service] running on port ${PORT}`));
