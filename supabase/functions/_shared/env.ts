export function requireEnv(name: string): string {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Environment variable ${name} ontbreekt.`);
  }

  return value;
}

export const SUPABASE_URL = requireEnv("SUPABASE_URL");
export const SUPABASE_ANON_KEY = requireEnv("SUPABASE_ANON_KEY");
export const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
export const MOLLIE_API_KEY = requireEnv("MOLLIE_API_KEY");
export const SITE_URL = requireEnv("SITE_URL").replace(/\/+$/, "");
export const MOLLIE_API_BASE_URL = "https://api.mollie.com/v2";
