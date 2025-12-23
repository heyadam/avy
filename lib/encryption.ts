import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a string using AES-256-GCM
 *
 * @param plaintext - The string to encrypt
 * @param key - 32-byte hex string encryption key (from ENCRYPTION_KEY env var)
 * @returns Base64-encoded string containing IV + ciphertext + auth tag
 */
export function encrypt(plaintext: string, key: string): string {
  const keyBuffer = Buffer.from(key, "hex");
  if (keyBuffer.length !== 32) {
    throw new Error("Encryption key must be 32 bytes (64 hex characters)");
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Combine IV + ciphertext + auth tag
  const combined = Buffer.concat([iv, encrypted, authTag]);
  return combined.toString("base64");
}

/**
 * Decrypt a string encrypted with AES-256-GCM
 *
 * @param ciphertext - Base64-encoded string containing IV + ciphertext + auth tag
 * @param key - 32-byte hex string encryption key (from ENCRYPTION_KEY env var)
 * @returns Decrypted plaintext string
 */
export function decrypt(ciphertext: string, key: string): string {
  const keyBuffer = Buffer.from(key, "hex");
  if (keyBuffer.length !== 32) {
    throw new Error("Encryption key must be 32 bytes (64 hex characters)");
  }

  const combined = Buffer.from(ciphertext, "base64");

  // Extract IV, ciphertext, and auth tag
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * API keys structure for encryption/decryption
 */
export interface StoredApiKeys {
  openai?: string;
  google?: string;
  anthropic?: string;
}

/**
 * Encrypt API keys for storage
 */
export function encryptKeys(keys: StoredApiKeys, encryptionKey: string): string {
  return encrypt(JSON.stringify(keys), encryptionKey);
}

/**
 * Decrypt stored API keys
 */
export function decryptKeys(encrypted: string, encryptionKey: string): StoredApiKeys {
  const json = decrypt(encrypted, encryptionKey);
  return JSON.parse(json) as StoredApiKeys;
}

/**
 * Generate a random 12-character alphanumeric share token
 */
export function generateShareToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(12);
  let token = "";
  for (let i = 0; i < 12; i++) {
    token += chars[bytes[i] % chars.length];
  }
  return token;
}

/**
 * Generate a random 4-digit live ID
 * Returns a string like "0042" or "1234"
 */
export function generateLiveId(): string {
  const num = Math.floor(Math.random() * 10000);
  return num.toString().padStart(4, "0");
}
