export const STORAGE_BUCKET = "verdia-products";

const PRODUCT_SELECT_FIELDS = `
  id,
  name,
  description,
  price,
  price_label,
  featured,
  sort_order,
  created_at,
  status,
  sold_at,
  reserved_until,
  sku,
  deleted_at
`;

const LEGACY_PRODUCT_SELECT_FIELDS = `
  id,
  name,
  description,
  price,
  price_label,
  featured,
  sort_order,
  created_at
`;

let cachedClient = null;

function getConfig() {
  return window.VERDIA_SUPABASE || {};
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isMissingProductLifecycleColumnError(error) {
  const message = String(error?.message || "");

  return (
    /schema cache/i.test(message) ||
    /column .* does not exist/i.test(message) ||
    /status/i.test(message) ||
    /sold_at/i.test(message) ||
    /reserved_until/i.test(message) ||
    /sku/i.test(message) ||
    /deleted_at/i.test(message)
  );
}

function mapAuthErrorMessage(error, fallbackMessage) {
  const message = String(error?.message || "").toLowerCase();

  if (message.includes("email not confirmed")) {
    return "Bevestig eerst het e-mailadres van dit beheeraccount.";
  }

  if (message.includes("invalid login credentials") || message.includes("invalid credentials")) {
    return "Het e-mailadres of wachtwoord klopt niet.";
  }

  if (message.includes("email rate limit exceeded")) {
    return "Er zijn te veel aanmeldpogingen. Probeer het straks opnieuw.";
  }

  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Supabase kon niet bereikt worden. Controleer je verbinding en probeer opnieuw.";
  }

  return error?.message ? error.message : fallbackMessage;
}

function mapAdminCheckError(error, fallbackMessage) {
  const message = String(error?.message || "");

  if (/is_admin/i.test(message) || /schema cache/i.test(message) || /permission denied/i.test(message)) {
    return "Admin-toegang is nog niet volledig geconfigureerd in Supabase. Voer eerst `supabase/setup.sql` uit.";
  }

  return error?.message ? error.message : fallbackMessage;
}

function mapRegistrationErrorMessage(error, fallbackMessage) {
  const message = String(error?.message || "").toLowerCase();

  if (message.includes("user already registered")) {
    return "Voor dit e-mailadres bestaat al een account. Log in met je wachtwoord.";
  }

  if (message.includes("password should be at least")) {
    return "Gebruik een wachtwoord van minstens 6 tekens.";
  }

  if (message.includes("unable to validate email address") || message.includes("invalid email")) {
    return "Vul een geldig e-mailadres in.";
  }

  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Supabase kon niet bereikt worden. Controleer je verbinding en probeer opnieuw.";
  }

  return error?.message ? error.message : fallbackMessage;
}

export function getSupabaseErrorMessage() {
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    return "Supabase JS kon niet geladen worden.";
  }

  const { url, anonKey } = getConfig();

  if (!url || !anonKey) {
    return "Supabase is nog niet geconfigureerd. Vul `supabase-config.js` in met je project URL en anon key.";
  }

  return "";
}

export function isSupabaseConfigured() {
  return !getSupabaseErrorMessage();
}

export function getSupabaseClient() {
  const errorMessage = getSupabaseErrorMessage();

  if (errorMessage) {
    throw new Error(errorMessage);
  }

  if (!cachedClient) {
    const { url, anonKey } = getConfig();

    cachedClient = window.supabase.createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
      },
    });
  }

  return cachedClient;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatPrice(product) {
  if (product.price_label === "op_aanvraag") {
    return "Prijs op aanvraag";
  }

  if (product.price == null || Number.isNaN(Number(product.price))) {
    return "Vanaf";
  }

  return `Vanaf ${formatCurrency(product.price)}`;
}

function ensureSuccess(error, fallbackMessage) {
  if (error) {
    throw new Error(error.message || fallbackMessage);
  }
}

function normalizeProductStatus(status) {
  if (["available", "reserved", "sold", "hidden"].includes(status)) {
    return status;
  }

  return "available";
}

function normalizeProduct(row, images) {
  return {
    id: row.id,
    name: row.name || "",
    description: row.description || "",
    price: row.price == null ? null : Number(row.price),
    price_label: row.price_label === "op_aanvraag" ? "op_aanvraag" : "vanaf",
    featured: Boolean(row.featured),
    sort_order: Number(row.sort_order || 0),
    created_at: row.created_at || "",
    status: normalizeProductStatus(row.status),
    sold_at: row.sold_at || null,
    reserved_until: row.reserved_until || null,
    sku: row.sku || null,
    deleted_at: row.deleted_at || null,
    images,
  };
}

async function runProductQuery(selectFields, options = {}) {
  const supabase = getSupabaseClient();
  const { adminScope = false, includeLifecycleFilters = false } = options;
  let query = supabase
    .from("products")
    .select(selectFields)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (includeLifecycleFilters) {
    query = query.is("deleted_at", null);

    if (!adminScope) {
      query = query.eq("status", "available");
    }
  }

  return query;
}

async function fetchProductRows(options = {}) {
  const { adminScope = false } = options;
  let response = await runProductQuery(PRODUCT_SELECT_FIELDS, {
    adminScope,
    includeLifecycleFilters: true,
  });

  if (response.error && isMissingProductLifecycleColumnError(response.error)) {
    // Keep the storefront and admin readable while the SQL migration is being rolled out.
    response = await runProductQuery(LEGACY_PRODUCT_SELECT_FIELDS, {
      adminScope,
      includeLifecycleFilters: false,
    });
  }

  ensureSuccess(response.error, "Producten konden niet geladen worden.");
  return response.data || [];
}

async function fetchImageRows(productIds) {
  if (!productIds.length) {
    return [];
  }

  const supabase = getSupabaseClient();
  const response = await supabase
    .from("product_images")
    .select("id, product_id, image_url, position")
    .in("product_id", productIds)
    .order("product_id", { ascending: true })
    .order("position", { ascending: true });

  ensureSuccess(response.error, "Productafbeeldingen konden niet geladen worden.");
  return response.data || [];
}

async function fetchProductsForScope(options = {}) {
  const productRows = await fetchProductRows(options);
  const imageRows = await fetchImageRows(productRows.map((row) => row.id));
  const imagesByProductId = new Map();

  for (const imageRow of imageRows) {
    const list = imagesByProductId.get(imageRow.product_id) || [];

    list.push({
      id: imageRow.id,
      image_url: imageRow.image_url,
      position: Number(imageRow.position || 0),
    });

    imagesByProductId.set(imageRow.product_id, list);
  }

  return productRows.map((productRow) =>
    normalizeProduct(
      productRow,
      (imagesByProductId.get(productRow.id) || []).sort((left, right) => left.position - right.position),
    ),
  );
}

export async function fetchProductsWithImages() {
  return fetchProductsForScope({ adminScope: false });
}

export async function fetchAdminProductsWithImages() {
  return fetchProductsForScope({ adminScope: true });
}

function createProductPayload(values) {
  const payload = {
    name: values.name,
    description: values.description,
    price: values.price == null || values.price === "" ? null : Number(values.price),
    price_label: values.price_label === "op_aanvraag" ? "op_aanvraag" : "vanaf",
    sort_order: Number.isFinite(Number(values.sort_order)) ? Number(values.sort_order) : 0,
  };

  if (hasOwn(values, "featured")) {
    payload.featured = Boolean(values.featured);
  }

  if (hasOwn(values, "status")) {
    payload.status = normalizeProductStatus(values.status);
  }

  if (hasOwn(values, "sold_at")) {
    payload.sold_at = values.sold_at || null;
  }

  if (hasOwn(values, "reserved_until")) {
    payload.reserved_until = values.reserved_until || null;
  }

  if (hasOwn(values, "sku")) {
    payload.sku = values.sku ? String(values.sku).trim() : null;
  }

  if (hasOwn(values, "deleted_at")) {
    payload.deleted_at = values.deleted_at || null;
  }

  return payload;
}

export async function saveProduct(values) {
  const supabase = getSupabaseClient();
  const payload = createProductPayload(values);

  if (values.id) {
    const response = await supabase
      .from("products")
      .update(payload)
      .eq("id", values.id)
      .select("id")
      .single();

    ensureSuccess(response.error, "Het product kon niet bijgewerkt worden.");
    return response.data;
  }

  const response = await supabase
    .from("products")
    .insert(payload)
    .select("id")
    .single();

  ensureSuccess(response.error, "Het product kon niet aangemaakt worden.");
  return response.data;
}

export async function replaceProductImages(productId, imageUrls) {
  const supabase = getSupabaseClient();

  const deleteResponse = await supabase.from("product_images").delete().eq("product_id", productId);
  ensureSuccess(deleteResponse.error, "Bestaande productafbeeldingen konden niet vervangen worden.");

  if (!imageUrls.length) {
    return [];
  }

  const rows = imageUrls.map((imageUrl, index) => ({
    product_id: productId,
    image_url: imageUrl,
    position: index + 1,
  }));

  const insertResponse = await supabase
    .from("product_images")
    .insert(rows)
    .select("id, product_id, image_url, position");

  ensureSuccess(insertResponse.error, "Nieuwe productafbeeldingen konden niet opgeslagen worden.");
  return insertResponse.data || [];
}

export async function uploadProductImage(productId, blob) {
  const supabase = getSupabaseClient();
  const fileName = `${Date.now()}-${crypto.randomUUID()}.webp`;
  const filePath = `products/${productId}/${fileName}`;

  const uploadResponse = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, blob, {
    cacheControl: "3600",
    contentType: "image/webp",
    upsert: false,
  });

  ensureSuccess(uploadResponse.error, "De afbeelding kon niet geupload worden.");

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);

  return {
    filePath,
    imageUrl: data.publicUrl,
  };
}

export function extractStoragePath(imageUrl) {
  if (!imageUrl) {
    return null;
  }

  try {
    const url = new URL(imageUrl);
    const marker = `/object/public/${STORAGE_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch (error) {
    return null;
  }
}

export async function removeStorageObjects(paths) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];

  if (!uniquePaths.length) {
    return;
  }

  const supabase = getSupabaseClient();
  const response = await supabase.storage.from(STORAGE_BUCKET).remove(uniquePaths);

  ensureSuccess(response.error, "Afbeeldingen konden niet uit Storage verwijderd worden.");
}

export async function deleteProduct(productId) {
  const supabase = getSupabaseClient();

  const imagesResponse = await supabase.from("product_images").delete().eq("product_id", productId);
  ensureSuccess(imagesResponse.error, "De gekoppelde afbeeldingen konden niet verwijderd worden.");

  const productResponse = await supabase.from("products").delete().eq("id", productId);
  ensureSuccess(productResponse.error, "Het product kon niet verwijderd worden.");
}

export async function getCurrentSession() {
  const supabase = getSupabaseClient();
  const response = await supabase.auth.getSession();

  ensureSuccess(response.error, "De aanmeldsessie kon niet gecontroleerd worden.");
  return response.data.session || null;
}

export async function signInWithEmailPassword(email, password) {
  const supabase = getSupabaseClient();
  const response = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (response.error) {
    throw new Error(mapAuthErrorMessage(response.error, "Inloggen mislukte."));
  }

  return response.data.session || null;
}

export async function signUpWithEmailPassword(email, password) {
  const supabase = getSupabaseClient();
  const response = await supabase.auth.signUp({
    email,
    password,
  });

  if (response.error) {
    throw new Error(mapRegistrationErrorMessage(response.error, "Registreren mislukte."));
  }

  return {
    session: response.data.session || null,
    user: response.data.user || null,
  };
}

export async function signOutCurrentUser() {
  const supabase = getSupabaseClient();
  const response = await supabase.auth.signOut();

  ensureSuccess(response.error, "Uitloggen mislukte.");
}

export async function signInAdmin(email, password) {
  return signInWithEmailPassword(email, password);
}

export async function signOutAdmin() {
  return signOutCurrentUser();
}

export async function isCurrentUserAdmin() {
  const session = await getCurrentSession();

  if (!session?.user) {
    return false;
  }

  const supabase = getSupabaseClient();
  const response = await supabase.rpc("is_admin");

  if (response.error) {
    throw new Error(
      mapAdminCheckError(response.error, "De admintoegang kon niet gecontroleerd worden."),
    );
  }

  return Boolean(response.data);
}

export function onAuthStateChange(callback) {
  const supabase = getSupabaseClient();
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session || null);
  });

  return () => {
    data.subscription.unsubscribe();
  };
}
