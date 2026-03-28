function normalizeBackendUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "http://localhost:3333";
  }

  const withScheme = /^https?:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`;
  return withScheme.replace(/\/+$/, "");
}

export const backendUrl = normalizeBackendUrl(
  process.env.MOVY_BACKEND_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? process.env.MOVY_BACKEND_HOSTPORT
);
