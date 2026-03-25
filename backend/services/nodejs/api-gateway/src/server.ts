import "dotenv/config";
import app from "./app";

const PORT = process.env.API_GATEWAY_PORT || 4000;

app.listen(PORT, () => {
  console.log(`[api-gateway] running on port ${PORT}`);
});
