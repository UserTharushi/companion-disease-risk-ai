import "dotenv/config";
import mongoose from "mongoose";
import app from "./app";

const PORT = process.env.AUTH_SERVICE_PORT || 4001;

function buildMongoCandidates() {
	const localUri = "mongodb://root:rootpassword@localhost:27017/companion_ai?authSource=admin";
	const dockerUri = "mongodb://root:rootpassword@mongodb:27017/companion_ai?authSource=admin";

	return [process.env.MONGODB_URI, process.env.MONGO_URI, localUri, dockerUri]
		.filter((uri): uri is string => Boolean(uri))
		.filter((uri, index, list) => list.indexOf(uri) === index);
}

async function startServer() {
	try {
		let lastError: unknown;
		for (let attempt = 0; attempt < 5; attempt += 1) {
			for (const uri of buildMongoCandidates()) {
				try {
					await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
					console.log(`[auth-service] MongoDB connected (${uri.includes("@mongodb:") ? "docker" : "local/env"})`);
					app.listen(PORT, () => console.log(`[auth-service] running on port ${PORT}`));
					return;
				} catch (err) {
					lastError = err;
					console.warn(`[auth-service] MongoDB connection failed for URI: ${uri}`);
				}
			}

			await new Promise((resolve) => setTimeout(resolve, 2000));
		}

		throw lastError instanceof Error ? lastError : new Error("MongoDB connection failed");
	} catch (err) {
		console.error("[auth-service] MongoDB connection error:", err);
		process.exit(1);
	}
}

startServer();
