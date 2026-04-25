const encoder = new TextEncoder();
const decoder = new TextDecoder();
export const CRYPTO_VERSION = 1;

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

function base64ToBytes(value) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function deriveKey(secret, existingSalt) {
  if (!secret) {
    throw new Error("A vault secret is required");
  }

  const salt = existingSalt ? base64ToBytes(existingSalt) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, [
    "deriveBits",
    "deriveKey"
  ]);

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 310000,
      hash: "SHA-256"
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );

  return {
    key,
    salt: bytesToBase64(salt)
  };
}

export async function encryptPrivateContact(plaintextObj, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const { key, salt } = await deriveKey(secret);
  const payload = encoder.encode(JSON.stringify(plaintextObj));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, payload);

  return {
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
    salt,
    crypto_version: CRYPTO_VERSION
  };
}

export async function decryptPrivateContact(payload, secret) {
  const { key } = await deriveKey(secret, payload.salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(payload.iv) },
    key,
    base64ToBytes(payload.ciphertext)
  );

  return JSON.parse(decoder.decode(decrypted));
}

