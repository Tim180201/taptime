const base64Alphabet =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function encodeBase64Url(bytes: Uint8Array): string {
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]!;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const value = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    output += base64Alphabet[(value >>> 18) & 63]!;
    output += base64Alphabet[(value >>> 12) & 63]!;
    output += second === undefined ? '=' : base64Alphabet[(value >>> 6) & 63]!;
    output += third === undefined ? '=' : base64Alphabet[value & 63]!;
  }
  return output.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function decodeBase64Url32(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) {
    return null;
  }
  const canonical = value.replaceAll('-', '+').replaceAll('_', '/') + '=';
  const bytes = new Uint8Array(32);
  let outputIndex = 0;
  for (let index = 0; index < canonical.length; index += 4) {
    const a = base64Alphabet.indexOf(canonical[index]!);
    const b = base64Alphabet.indexOf(canonical[index + 1]!);
    const c = canonical[index + 2] === '=' ? 0 : base64Alphabet.indexOf(canonical[index + 2]!);
    const d = canonical[index + 3] === '=' ? 0 : base64Alphabet.indexOf(canonical[index + 3]!);
    if (a < 0 || b < 0 || c < 0 || d < 0) {
      return null;
    }
    const combined = (a << 18) | (b << 12) | (c << 6) | d;
    if (outputIndex < bytes.length) bytes[outputIndex++] = (combined >>> 16) & 0xff;
    if (outputIndex < bytes.length) bytes[outputIndex++] = (combined >>> 8) & 0xff;
    if (outputIndex < bytes.length) bytes[outputIndex++] = combined & 0xff;
  }
  return outputIndex === 32 && encodeBase64Url(bytes) === value ? bytes : null;
}

export function bytesToLowercaseHex(bytes: Uint8Array): string {
  let value = '';
  for (const byte of bytes) value += byte.toString(16).padStart(2, '0');
  return value;
}
