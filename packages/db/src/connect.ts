import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line no-var
  var _monocouponMongoose:
    | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
    | undefined;
}

const cached = globalThis._monocouponMongoose ?? { conn: null, promise: null };
globalThis._monocouponMongoose = cached;

export async function connectToDatabase(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env.local (or .env) and add your MongoDB connection string."
    );
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, { bufferCommands: false, maxPoolSize: 10 }).catch((err) => {
      // Don't leave a rejected promise cached — a transient failure (e.g. a
      // DNS blip resolving the SRV record) would otherwise be replayed on
      // every request forever instead of retrying.
      cached.promise = null;
      throw err;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
