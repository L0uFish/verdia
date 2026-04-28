export const STORAGE_BUCKET = "verdia-products";

let cachedClient = null;

function getConfig() {
  return window.VERDIA_SUPABASE || {};
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
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
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

function normalizeProduct(row, images) {
  return {
    id: row.id,
    name: row.name || "",
    description: row.description || "",
    price: row.price == null ? null : Number(row.price),
    price_label: row.price_label === "op_aanvraag" ? "op_aanvraag" : "vanaf",
    sort_order: Number(row.sort_order || 0),
    created_at: row.created_at || "",
    images,
  };
}

export async function fetchProductsWithImages() {
  const supabase = getSupabaseClient();

  const [productsResponse, imagesResponse] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, description, price, price_label, sort_order, created_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("product_images")
      .select("id, product_id, image_url, position")
      .order("product_id", { ascending: true })
      .order("position", { ascending: true }),
  ]);

  ensureSuccess(productsResponse.error, "Producten konden niet geladen worden.");
  ensureSuccess(imagesResponse.error, "Productafbeeldingen konden niet geladen worden.");

  const imagesByProductId = new Map();

  for (const imageRow of imagesResponse.data || []) {
    const list = imagesByProductId.get(imageRow.product_id) || [];

    list.push({
      id: imageRow.id,
      image_url: imageRow.image_url,
      position: Number(imageRow.position || 0),
    });

    imagesByProductId.set(imageRow.product_id, list);
  }

  return (productsResponse.data || []).map((productRow) =>
    normalizeProduct(
      productRow,
      (imagesByProductId.get(productRow.id) || []).sort((left, right) => left.position - right.position),
    ),
  );
}

function createProductPayload(values) {
  return {
    name: values.name,
    description: values.description,
    price: values.price == null || values.price === "" ? null : Number(values.price),
    price_label: values.price_label === "op_aanvraag" ? "op_aanvraag" : "vanaf",
    sort_order: Number.isFinite(Number(values.sort_order)) ? Number(values.sort_order) : 0,
  };
}

export async function saveProduct(values) {
  const supabase = getSupabaseClient();
  const payload = createProductPayload(values);

  if (values.id) {
    const response = await supabase
      .from("products")
      .update(payload)
      .eq("id", values.id)
      .select("id, name, description, price, price_label, sort_order, created_at")
      .single();

    ensureSuccess(response.error, "Het product kon niet bijgewerkt worden.");
    return response.data;
  }

  const response = await supabase
    .from("products")
    .insert(payload)
    .select("id, name, description, price, price_label, sort_order, created_at")
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
