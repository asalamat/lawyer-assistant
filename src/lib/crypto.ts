import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { getMasterKey } from "./masterKey";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
// Distinguishes files written after encryption-at-rest shipped from files
// already on disk before it did, so old plaintext documents stay readable.
const FILE_MAGIC = Buffer.from("LAE1");
const TEXT_PREFIX = "enc:";

async function aesEncrypt(plaintext: Buffer): Promise<Buffer> {
  const key = await getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

async function aesDecrypt(data: Buffer): Promise<Buffer> {
  const key = await getMasterKey();
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function isEncryptedFile(data: Buffer): boolean {
  return data.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC);
}

export async function encryptFile(plaintext: Buffer): Promise<Buffer> {
  return Buffer.concat([FILE_MAGIC, await aesEncrypt(plaintext)]);
}

export async function decryptFile(data: Buffer): Promise<Buffer> {
  if (!isEncryptedFile(data)) return data;
  return aesDecrypt(data.subarray(FILE_MAGIC.length));
}

export function isEncryptedText(payload: string): boolean {
  return payload.startsWith(TEXT_PREFIX);
}

export async function encryptText(plaintext: string): Promise<string> {
  return TEXT_PREFIX + (await aesEncrypt(Buffer.from(plaintext, "utf-8"))).toString("base64");
}

export async function decryptText(payload: string): Promise<string> {
  if (!isEncryptedText(payload)) return payload;
  const data = Buffer.from(payload.slice(TEXT_PREFIX.length), "base64");
  return (await aesDecrypt(data)).toString("utf-8");
}
