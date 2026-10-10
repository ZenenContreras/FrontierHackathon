export function redact(value: string, secret: string | undefined): string {
  if (secret === undefined || secret.length === 0 || !value.includes(secret)) {
    return value;
  }
  return value.split(secret).join("[REDACTED]");
}

export function containsSecret(value: unknown, secret: string | undefined): boolean {
  if (secret === undefined || secret.length === 0) {
    return false;
  }
  return containsString(value, secret);
}

function containsString(value: unknown, secret: string): boolean {
  if (typeof value === "string") {
    return value.includes(secret);
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsString(item, secret));
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).some(
      ([key, item]) => key.includes(secret) || containsString(item, secret),
    );
  }
  return false;
}
