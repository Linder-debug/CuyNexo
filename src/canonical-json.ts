export function canonicalJson(value: unknown): string {
  // CuyNexo payloads contain validated ASCII strings and safe integers.
  // RFC 8785 orders object keys by UTF-16 and preserves array order.
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  const object = value as Record<string, unknown>;
  const fields = Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(object[key])}`);
  return `{${fields.join(",")}}`;
}
