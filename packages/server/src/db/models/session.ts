import mongoose, { Schema, type InferSchemaType } from "mongoose";

const sessionSchema = new Schema(
  {
    sessionId: { type: String, required: true },
    userId: { type: String, required: true },
    username: { type: String, required: true },
    identity: {
      type: {
        type: String,
        enum: ["named", "temp", "anon"],
        required: true,
      },
      username: { type: String, default: null },
      verified: { type: Boolean, default: false },
    },
    accessToken: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

sessionSchema.index({ sessionId: 1 }, { unique: true });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionDocument = InferSchemaType<typeof sessionSchema>;

export const SessionModel =
  mongoose.models.Session ?? mongoose.model("Session", sessionSchema);
