import mongoose, { Schema, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    wikiUserName: { type: String, required: true },
    identity: {
      type: {
        type: String,
        enum: ["named", "temp", "anon"],
        required: true,
      },
      username: { type: String, default: null },
      verified: { type: Boolean, default: false },
    },
    contributionCount: { type: Number, default: 0 },
    lastActive: { type: String, required: true },
  },
  { timestamps: true },
);

userSchema.index({ wikiUserName: 1 }, { unique: true });

export type UserDocument = InferSchemaType<typeof userSchema>;

export const UserModel =
  mongoose.models.User ?? mongoose.model("User", userSchema);
