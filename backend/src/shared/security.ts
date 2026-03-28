import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

const SALT_ROUNDS = 10;

export function hashPassword(password: string) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compareSync(password, hash);
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
