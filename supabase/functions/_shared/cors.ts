export function getCorsHeaders() {
  return {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  };
}

export function jsonResponse(
  payload: unknown,
  init: ResponseInit = {},
) {
  const headers = new Headers(getCorsHeaders());

  if (init.headers) {
    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
}
