import mongoose from "mongoose";

/**
 * Connect to MongoDB. Uses the provided URI or falls back to MONGO_URI env var.
 * Returns the mongoose connection instance.
 */
export async function connectDB(
  uri?: string,
): Promise<typeof mongoose> {
  const mongoUri = uri ?? process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error(
      "MongoDB URI not provided. Set MONGO_URI environment variable or pass uri argument.",
    );
  }
  return mongoose.connect(mongoUri);
}
