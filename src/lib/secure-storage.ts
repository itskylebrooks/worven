const DB_NAME = 'worven-secure-storage';
const STORE_NAME = 'crypto-keys';
const SETTINGS_KEY_ID = 'settings-api-keys';
const ENCRYPTION_ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;

export interface EncryptedValue {
  scheme: 'aes-gcm';
  iv: string;
  ciphertext: string;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let cachedKeyPromise: Promise<CryptoKey> | null = null;

function encodeBase64(value: Uint8Array): string {
  let binary = '';

  for (let index = 0; index < value.length; index += 1) {
    binary += String.fromCharCode(value[index]);
  }

  return window.btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(value.byteLength);
  new Uint8Array(buffer).set(value);
  return buffer;
}

function supportsSecureStorage() {
  return (
    typeof window !== 'undefined' &&
    typeof window.indexedDB !== 'undefined' &&
    typeof window.crypto !== 'undefined' &&
    typeof window.crypto.subtle !== 'undefined'
  );
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open secure storage.'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const result = await operation(store);

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('Secure storage transaction failed.'));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('Secure storage transaction was aborted.'));
    });

    return result;
  } finally {
    database.close();
  }
}

async function readStoredKey(): Promise<CryptoKey | null> {
  return withStore('readonly', async (store) =>
    new Promise<CryptoKey | null>((resolve, reject) => {
      const request = store.get(SETTINGS_KEY_ID);

      request.onsuccess = () => {
        const record = request.result as { id: string; key?: CryptoKey } | undefined;
        resolve(record?.key ?? null);
      };
      request.onerror = () =>
        reject(request.error ?? new Error('Could not read secure storage key.'));
    }),
  );
}

async function writeStoredKey(key: CryptoKey): Promise<void> {
  await withStore('readwrite', async (store) =>
    new Promise<void>((resolve, reject) => {
      const request = store.put({ id: SETTINGS_KEY_ID, key });

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(request.error ?? new Error('Could not persist secure storage key.'));
    }),
  );
}

async function getOrCreateKey(): Promise<CryptoKey> {
  if (!supportsSecureStorage()) {
    throw new Error('Secure storage is unavailable in this browser.');
  }

  if (!cachedKeyPromise) {
    cachedKeyPromise = (async () => {
      const existingKey = await readStoredKey();
      if (existingKey) {
        return existingKey;
      }

      const createdKey = await window.crypto.subtle.generateKey(
        { name: ENCRYPTION_ALGORITHM, length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );

      await writeStoredKey(createdKey);
      return createdKey;
    })().catch((error) => {
      cachedKeyPromise = null;
      throw error;
    });
  }

  return cachedKeyPromise;
}

export function isEncryptedValue(value: unknown): value is EncryptedValue {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<EncryptedValue>;
  return (
    candidate.scheme === 'aes-gcm' &&
    typeof candidate.iv === 'string' &&
    typeof candidate.ciphertext === 'string'
  );
}

export async function encryptValue(value: string): Promise<EncryptedValue> {
  const key = await getOrCreateKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: ENCRYPTION_ALGORITHM, iv },
    key,
    textEncoder.encode(value),
  );

  return {
    scheme: 'aes-gcm',
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptValue(payload: EncryptedValue): Promise<string> {
  const key = await getOrCreateKey();
  const decrypted = await window.crypto.subtle.decrypt(
    { name: ENCRYPTION_ALGORITHM, iv: toArrayBuffer(decodeBase64(payload.iv)) },
    key,
    toArrayBuffer(decodeBase64(payload.ciphertext)),
  );

  return textDecoder.decode(decrypted);
}
