import {
  cancelOrder,
  deleteProduct,
  extractStoragePath,
  fetchAdminOrders,
  fetchAdminProductsWithImages,
  formatPrice,
  getCurrentSession,
  isCurrentUserAdmin,
  markOrderFulfilled,
  onAuthStateChange,
  releaseOrderReservation,
  removeStorageObjects,
  replaceProductImages,
  saveProduct,
  signInAdmin,
  signOutAdmin,
  uploadProductImage,
} from "../supabase.js?v=3.0";

const MAX_IMAGES = 8;
const PRODUCT_IMAGE_EXPORT_WIDTH = 1200;
const PRODUCT_IMAGE_EXPORT_HEIGHT = 1500;

const authLoadingView = document.querySelector("#authLoadingView");
const authLoadingMessage = document.querySelector("#authLoadingMessage");
const authView = document.querySelector("#authView");
const accessDeniedView = document.querySelector("#accessDeniedView");
const accessDeniedMessage = document.querySelector("#accessDeniedMessage");
const accessDeniedLogoutButton = document.querySelector("#accessDeniedLogoutButton");
const adminApp = document.querySelector("#adminApp");
const securityNotice = document.querySelector("#securityNotice");
const loginForm = document.querySelector("#loginForm");
const authFeedback = document.querySelector("#authFeedback");
const loginEmailInput = document.querySelector("#loginEmailInput");
const loginPasswordInput = document.querySelector("#loginPasswordInput");
const loginButton = document.querySelector("#loginButton");
const logoutButton = document.querySelector("#logoutButton");
const sessionMeta = document.querySelector("#sessionMeta");
const sessionEmail = document.querySelector("#sessionEmail");
const adminTabButtons = Array.from(document.querySelectorAll("[data-admin-tab]"));
const productsTabPanel = document.querySelector("#productsTabPanel");
const ordersTabPanel = document.querySelector("#ordersTabPanel");
const customersTabPanel = document.querySelector("#customersTabPanel");

const productList = document.querySelector("#productList");
const listStatus = document.querySelector("#listStatus");
const productForm = document.querySelector("#productForm");
const formTitle = document.querySelector("#formTitle");
const formFeedback = document.querySelector("#formFeedback");
const uploadStatus = document.querySelector("#uploadStatus");
const imagePreviewGrid = document.querySelector("#imagePreviewGrid");
const imageCount = document.querySelector("#imageCount");
const imageInput = document.querySelector("#imageInput");
const uploadButtonText = document.querySelector("#uploadButtonText");
const uploadButton = imageInput.closest(".uploadButton");
const newProductButton = document.querySelector("#newProductButton");
const deleteProductButton = document.querySelector("#deleteProductButton");
const saveProductButton = document.querySelector("#saveProductButton");
const nameInput = document.querySelector("#nameInput");
const descriptionInput = document.querySelector("#descriptionInput");
const priceLabelInput = document.querySelector("#priceLabelInput");
const priceInput = document.querySelector("#priceInput");
const priceHint = document.querySelector("#priceHint");
const statusInput = document.querySelector("#statusInput");
const sortOrderInput = document.querySelector("#sortOrderInput");
const ordersStatus = document.querySelector("#ordersStatus");
const ordersList = document.querySelector("#ordersList");

const cropModal = document.querySelector("#cropModal");
const cropViewport = document.querySelector("#cropViewport");
const cropImage = document.querySelector("#cropImage");
const cropZoom = document.querySelector("#cropZoom");
const cropFileName = document.querySelector("#cropFileName");
const cropCancelButton = document.querySelector("#cropCancelButton");
const cropConfirmButton = document.querySelector("#cropConfirmButton");
const cropTitle = document.querySelector("#cropTitle");
const cropRotateButton = document.querySelector("#cropRotateButton");
const cropMirrorButton = document.querySelector("#cropMirrorButton");

const state = {
  activeTab: "products",
  hasLoadedOrders: false,
  products: [],
  orders: [],
  currentProductId: null,
  images: [],
  removedImagePaths: [],
  isUpdatingOrder: false,
  isSaving: false,
  hasLoadedProducts: false,
};

const authState = {
  isReady: false,
  isChecking: false,
  checkingSessionToken: "",
  isSubmitting: false,
  isAdmin: false,
  hasSession: false,
  activeSessionToken: "",
  pendingLoggedOutMessage: "",
  pendingLoggedOutTone: "info",
};

const cropState = {
  resolver: null,
  objectUrl: "",
  zoom: 1,
  baseScale: 1,
  rotation: 0,
  mirrored: false,
  imageX: 0,
  imageY: 0,
  renderWidth: 0,
  renderHeight: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  startImageX: 0,
  startImageY: 0,
};

const PRODUCT_STATUS_LABELS = {
  available: "Beschikbaar",
  reserved: "Gereserveerd",
  sold: "Verkocht",
  hidden: "Verborgen",
};

const ORDER_STATUS_LABELS = {
  draft: "Concept",
  reserved: "Gereserveerd",
  paid: "Betaald",
  cancelled: "Geannuleerd",
  expired: "Verlopen",
  fulfilled: "Afgehaald",
};

const PAYMENT_STATUS_LABELS = {
  open: "Open",
  paid: "Betaald",
  failed: "Mislukt",
  expired: "Verlopen",
  cancelled: "Geannuleerd",
  pending: "In behandeling",
};

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (typeof text === "string") {
    element.textContent = text;
  }

  return element;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function setListStatus(message, tone = "info") {
  listStatus.textContent = message;
  listStatus.classList.toggle("is-error", tone === "error");
}

function setFormFeedback(message, tone = "info") {
  if (!message) {
    formFeedback.hidden = true;
    formFeedback.textContent = "";
    formFeedback.removeAttribute("data-tone");
    return;
  }

  formFeedback.hidden = false;
  formFeedback.textContent = message;
  formFeedback.dataset.tone = tone;
}

function setUploadStatus(message, tone = "info") {
  uploadStatus.textContent = message;
  uploadStatus.classList.toggle("is-error", tone === "error");
}

function setAuthFeedback(message, tone = "info") {
  if (!message) {
    authFeedback.hidden = true;
    authFeedback.textContent = "";
    authFeedback.removeAttribute("data-tone");
    return;
  }

  authFeedback.hidden = false;
  authFeedback.textContent = message;
  authFeedback.dataset.tone = tone;
}

function setAuthLoadingMessage(message) {
  authLoadingMessage.textContent = message;
}

function setAccessDeniedMessage(message) {
  accessDeniedMessage.textContent = message;
}

function setAdminView(view) {
  authLoadingView.hidden = view !== "loading";
  authView.hidden = view !== "login";
  accessDeniedView.hidden = view !== "denied";
  adminApp.hidden = view !== "admin";
  securityNotice.hidden = view !== "admin";
  logoutButton.hidden = view !== "admin";
  sessionMeta.hidden = view !== "admin";
}

function setOrdersStatus(message, tone = "info") {
  if (!ordersStatus) {
    return;
  }

  ordersStatus.textContent = message;
  ordersStatus.classList.toggle("is-error", tone === "error");
}

function normalizeOrderStatus(status) {
  return Object.prototype.hasOwnProperty.call(ORDER_STATUS_LABELS, status) ? status : "draft";
}

function normalizePaymentStatus(status) {
  return Object.prototype.hasOwnProperty.call(PAYMENT_STATUS_LABELS, status) ? status : "open";
}

function getOrderStatusLabel(status) {
  return ORDER_STATUS_LABELS[normalizeOrderStatus(status)];
}

function getPaymentStatusLabel(status) {
  return PAYMENT_STATUS_LABELS[normalizePaymentStatus(status)];
}

function setActiveTab(nextTab) {
  state.activeTab = ["products", "orders", "customers"].includes(nextTab) ? nextTab : "products";

  adminTabButtons.forEach((button) => {
    const isActive = button.dataset.adminTab === state.activeTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  if (productsTabPanel) {
    productsTabPanel.hidden = state.activeTab !== "products";
  }

  if (ordersTabPanel) {
    ordersTabPanel.hidden = state.activeTab !== "orders";
  }

  if (customersTabPanel) {
    customersTabPanel.hidden = state.activeTab !== "customers";
  }
}

function syncAuthControls() {
  const isBusy = authState.isSubmitting || authState.isChecking;

  loginEmailInput.disabled = isBusy;
  loginPasswordInput.disabled = isBusy;
  loginButton.disabled = isBusy;
  loginButton.textContent = authState.isSubmitting ? "Inloggen..." : "Inloggen";
  logoutButton.disabled = authState.isSubmitting || authState.isChecking;
  accessDeniedLogoutButton.disabled = authState.isSubmitting || authState.isChecking;
}

function clearAdminState() {
  state.activeTab = "products";
  state.orders = [];
  state.products = [];
  state.currentProductId = null;
  state.hasLoadedOrders = false;
  state.isUpdatingOrder = false;
  state.hasLoadedProducts = false;
  state.isSaving = false;
  clearCurrentImages();
  productList.replaceChildren();
  if (ordersList) {
    ordersList.replaceChildren();
  }
  setListStatus("");
  setOrdersStatus("");
  setFormFeedback("", "info");
  setUploadStatus("", "info");
  productForm.reset();
  formTitle.textContent = "Nieuw product";
  loginPasswordInput.value = "";
  setActiveTab("products");
  renderProductList();
  renderImagePreviewGrid();
}

function disposeImages(images) {
  images.forEach((image) => {
    if (image.revokeOnDispose && image.previewUrl) {
      URL.revokeObjectURL(image.previewUrl);
    }
  });
}

function clearCurrentImages() {
  disposeImages(state.images);
  state.images = [];
  state.removedImagePaths = [];
}

function mapImagesForEditor(product) {
  return product.images.map((image, index) => ({
    id: image.id || crypto.randomUUID(),
    imageUrl: image.image_url,
    previewUrl: image.image_url,
    filePath: extractStoragePath(image.image_url),
    blob: null,
    pending: false,
    revokeOnDispose: false,
    label: `Afbeelding ${index + 1}`,
  }));
}

function getSelectedProduct() {
  return state.products.find((product) => product.id === state.currentProductId) || null;
}

function formatInputPrice(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return "";
  }

  return String(value);
}

function normalizeProductStatus(status) {
  return Object.prototype.hasOwnProperty.call(PRODUCT_STATUS_LABELS, status) ? status : "available";
}

function getProductStatusLabel(status) {
  return PRODUCT_STATUS_LABELS[normalizeProductStatus(status)];
}

function formatSoldAtLabel(soldAt) {
  if (!soldAt) {
    return "";
  }

  const date = new Date(soldAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTimeLabel(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getOrderById(orderId) {
  return state.orders.find((order) => order.id === orderId) || null;
}

function renderOrdersList() {
  if (!ordersList) {
    return;
  }

  ordersList.replaceChildren();

  if (!state.orders.length) {
    const emptyState = createElement("div", "emptyTile");
    emptyState.appendChild(createElement("p", "", "Nog geen bestellingen gevonden."));
    ordersList.appendChild(emptyState);
    return;
  }

  const fragment = document.createDocumentFragment();

  state.orders.forEach((order) => {
    const orderCard = createElement("article", "orderCard");
    const header = createElement("div", "orderCardHeader");
    const headerCopy = createElement("div", "orderCardCopy");
    const headerBadges = createElement("div", "orderBadgeRow");
    const orderNumber = createElement("strong", "orderNumber", order.order_number);
    const customer = createElement(
      "p",
      "orderCustomerLine",
      `${order.customer_name} · ${order.customer_email} · ${order.customer_phone}`,
    );
    const orderStatusBadge = createElement(
      "span",
      `pill is-${normalizeOrderStatus(order.status)}`,
      getOrderStatusLabel(order.status),
    );
    const paymentStatusBadge = createElement(
      "span",
      `pill is-payment-${normalizePaymentStatus(order.payment_status)}`,
      getPaymentStatusLabel(order.payment_status),
    );
    const metaGrid = createElement("div", "orderMetaGrid");
    const productsList = createElement("div", "orderProductsList");
    const actions = createElement("div", "orderActions");
    const createdLabel = formatDateTimeLabel(order.created_at) || "-";
    const paidLabel = formatDateTimeLabel(order.paid_at) || "Nog niet betaald";
    const reservationLabel = formatDateTimeLabel(order.reservation_expires_at) || "Geen actieve reservatie";
    const paymentMethod = order.payment_method || "Nog niet gekozen";
    const pickupNote = order.pickup_note || "Geen pickup-opmerking opgegeven.";

    headerCopy.append(orderNumber, customer);
    headerBadges.append(orderStatusBadge, paymentStatusBadge);
    header.append(headerCopy, headerBadges);

    [
      ["Aangemaakt", createdLabel],
      ["Totaal", `€ ${order.total_amount.toFixed(2)}`],
      ["Betaalmethode", paymentMethod],
      ["Betaald op", paidLabel],
      ["Reservatie tot", reservationLabel],
      ["Pickup-opmerking", pickupNote],
    ].forEach(([label, value]) => {
      const block = createElement("div", "orderMetaBlock");
      block.appendChild(createElement("span", "orderMetaLabel", label));
      block.appendChild(createElement("strong", "", value));
      metaGrid.appendChild(block);
    });

    order.order_items.forEach((item) => {
      const productRow = createElement("div", "orderProductRow");
      const productName = createElement("strong", "", item.product_name);
      const productPrice = createElement("span", "", `€ ${item.product_price.toFixed(2)}`);

      productRow.append(productName, productPrice);
      productsList.appendChild(productRow);
    });

    if (order.status === "paid") {
      const fulfillButton = createElement("button", "btn ghost orderActionButton", "Markeer als afgehaald");
      fulfillButton.type = "button";
      fulfillButton.disabled = state.isUpdatingOrder || !authState.isAdmin;
      fulfillButton.dataset.orderAction = "fulfill";
      fulfillButton.dataset.orderId = order.id;
      actions.appendChild(fulfillButton);
    }

    if (["draft", "reserved"].includes(order.status)) {
      const cancelButton = createElement("button", "btn danger orderActionButton", "Annuleer order");
      const releaseButton = createElement("button", "btn ghost orderActionButton", "Geef reservatie vrij");

      cancelButton.type = "button";
      releaseButton.type = "button";
      cancelButton.disabled = state.isUpdatingOrder || !authState.isAdmin;
      releaseButton.disabled = state.isUpdatingOrder || !authState.isAdmin;
      cancelButton.dataset.orderAction = "cancel";
      releaseButton.dataset.orderAction = "release";
      cancelButton.dataset.orderId = order.id;
      releaseButton.dataset.orderId = order.id;

      actions.append(cancelButton, releaseButton);
    }

    orderCard.append(header, metaGrid, productsList);

    if (actions.childElementCount) {
      orderCard.appendChild(actions);
    }

    fragment.appendChild(orderCard);
  });

  ordersList.appendChild(fragment);
}

async function loadOrders() {
  if (!authState.isAdmin) {
    return;
  }

  setOrdersStatus("Bestellingen laden...");

  try {
    state.orders = await fetchAdminOrders();
    state.hasLoadedOrders = true;
    renderOrdersList();
    setOrdersStatus(state.orders.length ? `${state.orders.length} bestelling(en) geladen.` : "Nog geen bestellingen.");
  } catch (error) {
    setOrdersStatus(error.message || "Bestellingen konden niet geladen worden.", "error");
    throw error;
  }
}

async function ensureOrdersLoaded() {
  if (state.hasLoadedOrders) {
    return;
  }

  await loadOrders();
}

async function handleOrderAction(orderId, action) {
  if (!orderId || !["fulfill", "cancel", "release"].includes(action)) {
    return;
  }

  const order = getOrderById(orderId);

  if (!order || state.isUpdatingOrder || !authState.isAdmin) {
    return;
  }

  const actionLabels = {
    cancel: "annuleren",
    fulfill: "als afgehaald markeren",
    release: "vrijgeven",
  };
  const confirmed = window.confirm(
    `Weet je zeker dat je bestelling ${order.order_number} wilt ${actionLabels[action]}?`,
  );

  if (!confirmed) {
    return;
  }

  state.isUpdatingOrder = true;
  syncControls();
  setOrdersStatus(`Bestelling ${order.order_number} wordt bijgewerkt...`);

  try {
    if (action === "fulfill") {
      await markOrderFulfilled(orderId);
    }

    if (action === "cancel") {
      await cancelOrder(orderId);
    }

    if (action === "release") {
      await releaseOrderReservation(orderId);
    }

    await Promise.all([
      loadOrders(),
      loadProducts(state.currentProductId),
    ]);
    setOrdersStatus(`Bestelling ${order.order_number} is bijgewerkt.`);
  } catch (error) {
    setOrdersStatus(error.message || "Bestelling kon niet bijgewerkt worden.", "error");
  } finally {
    state.isUpdatingOrder = false;
    syncControls();
    renderOrdersList();
  }
}

function resetForm() {
  clearCurrentImages();

  state.currentProductId = null;

  productForm.reset();
  nameInput.value = "";
  descriptionInput.value = "";
  priceLabelInput.value = "vanaf";
  priceInput.value = "";
  statusInput.value = "available";
  sortOrderInput.value = "0";
  formTitle.textContent = "Nieuw product";

  renderImagePreviewGrid();
  syncControls();
}

function applyProductToForm(product) {
  clearCurrentImages();

  state.currentProductId = product.id;
  nameInput.value = product.name;
  descriptionInput.value = product.description;
  priceLabelInput.value = product.price_label;
  priceInput.value = formatInputPrice(product.price);
  statusInput.value = normalizeProductStatus(product.status);
  sortOrderInput.value = String(product.sort_order != null ? product.sort_order : 0);
  state.images = mapImagesForEditor(product);
  formTitle.textContent = `Bewerk: ${product.name}`;

  renderImagePreviewGrid();
  syncControls();
}

function renderProductList() {
  productList.replaceChildren();

  if (!state.products.length) {
    const emptyState = createElement("div", "emptyTile");
    emptyState.appendChild(createElement("p", "", "Nog geen producten toegevoegd."));
    productList.appendChild(emptyState);
    return;
  }

  const fragment = document.createDocumentFragment();

  state.products.forEach((product) => {
    const button = createElement(
      "button",
      product.id === state.currentProductId ? "productRow active" : "productRow",
    );
    button.type = "button";
    button.disabled = state.isSaving || !authState.isAdmin;
    button.dataset.productId = product.id;

    const title = createElement("div", "productRowTitle");
    const titleText = createElement("strong", "", product.name);
    const statusBadge = createElement(
      "span",
      `pill is-${normalizeProductStatus(product.status)}`,
      getProductStatusLabel(product.status),
    );
    title.appendChild(titleText);
    title.appendChild(statusBadge);

    const meta = createElement("div", "productMeta");
    meta.appendChild(createElement("span", "", formatPrice(product)));
    meta.appendChild(createElement("span", "", `${product.images.length} beeld(en)`));
    meta.appendChild(createElement("span", "", `Sortering ${product.sort_order}`));

    const soldAtLabel = formatSoldAtLabel(product.sold_at);

    if (soldAtLabel) {
      meta.appendChild(createElement("span", "", `Verkocht op ${soldAtLabel}`));
    }

    button.append(title, meta);
    fragment.appendChild(button);
  });

  productList.appendChild(fragment);
}

function renderImagePreviewGrid() {
  imagePreviewGrid.replaceChildren();
  imageCount.textContent = `${state.images.length} / ${MAX_IMAGES}`;

  if (!state.images.length) {
    const emptyTile = createElement("div", "emptyTile");
    emptyTile.appendChild(
      createElement("p", "", "Nog geen galerijbeelden toegevoegd voor dit product."),
    );
    imagePreviewGrid.appendChild(emptyTile);
    return;
  }

  const fragment = document.createDocumentFragment();

  state.images.forEach((image, index) => {
    const tile = createElement("div", "imageTile");
    const thumb = createElement("div", "imageThumb");
    const img = document.createElement("img");
    img.src = image.previewUrl;
    img.alt = `Voorbeeld ${index + 1}`;
    img.loading = "lazy";

    const badge = createElement("span", "imageBadge", image.pending ? "Nieuw" : "Bestaand");
    thumb.append(img, badge);

    const body = createElement("div", "imageTileBody");
    const title = createElement("div", "imageTileTitle");
    title.appendChild(createElement("strong", "", `Afbeelding ${index + 1}`));
    title.appendChild(createElement("span", "", image.pending ? "Nog niet geupload" : "Klaar"));

    const actions = createElement("div", "imageTileActions");
    const moveLeftButton = createElement("button", "imageAction", "Naar links");
    const moveRightButton = createElement("button", "imageAction", "Naar rechts");
    const deleteButton = createElement("button", "imageAction danger", "Verwijderen");

    moveLeftButton.type = "button";
    moveRightButton.type = "button";
    deleteButton.type = "button";

    moveLeftButton.dataset.action = "move-left";
    moveRightButton.dataset.action = "move-right";
    deleteButton.dataset.action = "delete";

    moveLeftButton.dataset.imageId = image.id;
    moveRightButton.dataset.imageId = image.id;
    deleteButton.dataset.imageId = image.id;

    moveLeftButton.disabled = state.isSaving || !authState.isAdmin || index === 0;
    moveRightButton.disabled = state.isSaving || !authState.isAdmin || index === state.images.length - 1;
    deleteButton.disabled = state.isSaving || !authState.isAdmin;

    actions.append(moveLeftButton, moveRightButton, deleteButton);
    body.append(title, actions);
    tile.append(thumb, body);
    fragment.appendChild(tile);
  });

  imagePreviewGrid.appendChild(fragment);
}

function syncControls() {
  const isEditorLocked = state.isSaving || !authState.isAdmin;
  const isOrderActionLocked = state.isUpdatingOrder || !authState.isAdmin;
  const priceOnRequest = priceLabelInput.value === "op_aanvraag";
  const hasSavedProduct = Boolean(state.currentProductId);
  const limitReached = state.images.length >= MAX_IMAGES;

  adminTabButtons.forEach((button) => {
    button.disabled = !authState.isAdmin || state.isSaving || state.isUpdatingOrder;
  });

  nameInput.disabled = isEditorLocked;
  descriptionInput.disabled = isEditorLocked;
  priceLabelInput.disabled = isEditorLocked;
  priceInput.disabled = isEditorLocked || priceOnRequest;
  statusInput.disabled = isEditorLocked;
  sortOrderInput.disabled = isEditorLocked;
  imageInput.disabled = isEditorLocked || limitReached;
  newProductButton.disabled = isEditorLocked;
  deleteProductButton.disabled = isEditorLocked || !hasSavedProduct;
  saveProductButton.disabled = isEditorLocked;
  saveProductButton.textContent = state.isSaving ? "Opslaan..." : "Product opslaan";

  uploadButton.classList.toggle("is-disabled", imageInput.disabled);
  uploadButtonText.textContent = limitReached && !isEditorLocked
    ? `Maximum van ${MAX_IMAGES} afbeeldingen bereikt`
    : "Afbeeldingen toevoegen";

  priceHint.textContent = priceOnRequest
    ? "De prijs wordt niet gebruikt. Op de site verschijnt 'Prijs op aanvraag'."
    : "Deze prijs verschijnt op de site als 'Vanaf EUR ...'.";

  document.querySelectorAll("[data-order-action]").forEach((button) => {
    button.disabled = isOrderActionLocked;
  });
}

function moveImage(imageId, direction) {
  const currentIndex = state.images.findIndex((image) => image.id === imageId);

  if (currentIndex === -1) {
    return;
  }

  const nextIndex = currentIndex + direction;

  if (nextIndex < 0 || nextIndex >= state.images.length) {
    return;
  }

  const nextImages = [...state.images];
  const [moved] = nextImages.splice(currentIndex, 1);
  nextImages.splice(nextIndex, 0, moved);
  state.images = nextImages;

  renderImagePreviewGrid();
  syncControls();
}

function removeImage(imageId) {
  const image = state.images.find((entry) => entry.id === imageId);

  if (!image) {
    return;
  }

  if (image.filePath) {
    state.removedImagePaths.push(image.filePath);
  }

  if (image.revokeOnDispose && image.previewUrl) {
    URL.revokeObjectURL(image.previewUrl);
  }

  state.images = state.images.filter((entry) => entry.id !== imageId);
  renderImagePreviewGrid();
  syncControls();
}

function collectFormValues() {
  const rawPrice = priceInput.value.trim();
  const parsedSortOrder = Number.parseInt(sortOrderInput.value.trim() || "0", 10);
  const priceLabel = priceLabelInput.value === "op_aanvraag" ? "op_aanvraag" : "vanaf";
  const status = normalizeProductStatus(statusInput.value);
  const existingProduct = getSelectedProduct();
  const soldAt = status === "sold"
    ? (existingProduct?.sold_at || new Date().toISOString())
    : (existingProduct?.sold_at || null);

  return {
    id: state.currentProductId,
    name: nameInput.value.trim(),
    description: descriptionInput.value.trim(),
    price_label: priceLabel,
    price: priceLabel === "op_aanvraag" || rawPrice === "" ? null : Number(rawPrice),
    status,
    sold_at: soldAt,
    sort_order: Number.isNaN(parsedSortOrder) ? null : parsedSortOrder,
  };
}

function validateForm(values) {
  if (!values.name) {
    return "Geef het product een naam.";
  }

  if (!values.description) {
    return "Geef het product een beschrijving.";
  }

  if (values.sort_order == null) {
    return "Geef een geldige sorteervolgorde in.";
  }

  if (values.price_label === "vanaf" && (values.price == null || Number.isNaN(values.price))) {
    return "Vul een prijs in of kies 'Prijs op aanvraag'.";
  }

  if (values.price != null && (Number.isNaN(values.price) || values.price < 0)) {
    return "Geef een geldige prijs in.";
  }

  if (state.images.length > MAX_IMAGES) {
    return `Je kan maximaal ${MAX_IMAGES} afbeeldingen opslaan.`;
  }

  return "";
}

async function loadProducts(preferredProductId = state.currentProductId) {
  if (!authState.isAdmin) {
    return;
  }

  setListStatus("Producten laden...");

  try {
    const products = await fetchAdminProductsWithImages();
    state.products = products;
    state.hasLoadedProducts = true;

    if (!products.length) {
      setListStatus("Nog geen producten toegevoegd.");
      resetForm();
      renderProductList();
      setFormFeedback("", "info");
      setUploadStatus("", "info");
      return;
    }

    const selectedProduct =
      products.find((product) => product.id === preferredProductId) ||
      products[0];

    applyProductToForm(selectedProduct);
    renderProductList();
    setListStatus(`${products.length} product(en) geladen.`);
  } catch (error) {
    setListStatus(error.message || "Producten konden niet geladen worden.", "error");
    setFormFeedback(error.message || "Admin kon niet verbinden met Supabase.", "error");
    throw error;
  }
}

async function ensureProductsLoaded(preferredProductId) {
  if (state.hasLoadedProducts) {
    return;
  }

  await loadProducts(preferredProductId);
}

function showLoadingState(message = "Toegang controleren...") {
  setAuthLoadingMessage(message);
  setAdminView("loading");
  syncAuthControls();
}

function showLoggedOutState(message = "", tone = "info") {
  authState.isChecking = false;
  authState.isAdmin = false;
  authState.hasSession = false;
  authState.activeSessionToken = "";
  sessionEmail.textContent = "";

  if (!cropModal.hidden) {
    cancelCropper();
  }

  clearAdminState();
  setAdminView("login");
  setAccessDeniedMessage("Je hebt geen toegang tot dit beheer.");
  setAuthFeedback(message || "Meld je aan om het beheer te openen.", tone);
  syncAuthControls();
  syncControls();
}

function showAccessDeniedState(session, message = "Je hebt geen toegang tot dit beheer.") {
  authState.isChecking = false;
  authState.isAdmin = false;
  authState.hasSession = true;
  authState.activeSessionToken = session.access_token || "";
  sessionEmail.textContent = "";

  if (!cropModal.hidden) {
    cancelCropper();
  }

  clearAdminState();
  setAdminView("denied");
  setAccessDeniedMessage(message);
  setAuthFeedback("", "info");
  syncAuthControls();
  syncControls();
}

async function showAdminState(session) {
  authState.isAdmin = true;
  authState.isChecking = false;
  authState.hasSession = true;
  authState.activeSessionToken = session.access_token || "";
  sessionEmail.textContent = session.user.email || "";
  setAdminView("admin");
  setAuthFeedback("", "info");
  syncAuthControls();
  syncControls();

  try {
    await ensureProductsLoaded(state.currentProductId);
  } catch (error) {
    console.error(error);
  }
}

async function handleSessionChange(session) {
  const sessionToken = session?.access_token || "";

  if (sessionToken && authState.checkingSessionToken === sessionToken) {
    return;
  }

  authState.isChecking = true;
  authState.checkingSessionToken = sessionToken;
  syncAuthControls();

  if (sessionToken && authState.isAdmin && authState.activeSessionToken === sessionToken) {
    authState.isChecking = false;
    authState.checkingSessionToken = "";
    syncAuthControls();
    return;
  }

  if (!session?.user) {
    const pendingMessage = authState.pendingLoggedOutMessage;
    const pendingTone = authState.pendingLoggedOutTone;
    authState.pendingLoggedOutMessage = "";
    authState.pendingLoggedOutTone = "info";
    showLoggedOutState(
      pendingMessage || "Meld je aan om het beheer te openen.",
      pendingMessage ? pendingTone : "info",
    );
    authState.isReady = true;
    return;
  }

  showLoadingState("Toegang controleren...");

  try {
    // Auth alone is not enough: the user must also exist in public.admin_users.
    const isAdmin = await isCurrentUserAdmin();

    if (!isAdmin) {
      showAccessDeniedState(session);
      return;
    }

    await showAdminState(session);
  } catch (error) {
    showLoggedOutState(error.message || "De admintoegang kon niet gecontroleerd worden.", "error");
  } finally {
    if (authState.checkingSessionToken === sessionToken) {
      authState.checkingSessionToken = "";
    }
    authState.isReady = true;
    authState.isChecking = false;
    syncAuthControls();
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  if (authState.isSubmitting || authState.isChecking) {
    return;
  }

  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value;

  if (!email) {
    setAuthFeedback("Vul je e-mailadres in.", "error");
    loginEmailInput.focus();
    return;
  }

  if (!password) {
    setAuthFeedback("Vul je wachtwoord in.", "error");
    loginPasswordInput.focus();
    return;
  }

  authState.isSubmitting = true;
  setAuthFeedback("Aanmelden...", "info");
  syncAuthControls();

  try {
    const session = await signInAdmin(email, password);
    await handleSessionChange(session);
    loginPasswordInput.value = "";
  } catch (error) {
    setAuthFeedback(error.message || "Inloggen mislukte.", "error");
  } finally {
    authState.isSubmitting = false;
    syncAuthControls();
  }
}

async function handleLogout() {
  if (authState.isSubmitting || authState.isChecking) {
    return;
  }

  authState.isChecking = true;
  showLoadingState("Uitloggen...");
  syncAuthControls();

  try {
    authState.pendingLoggedOutMessage = "Je bent uitgelogd.";
    authState.pendingLoggedOutTone = "info";
    await signOutAdmin();
  } catch (error) {
    if (authState.hasSession && !authState.isAdmin) {
      setAdminView("denied");
      setAccessDeniedMessage(error.message || "Uitloggen mislukte.");
    } else if (authState.isAdmin) {
      setAdminView("admin");
      setFormFeedback(error.message || "Uitloggen mislukte.", "error");
    } else {
      setAdminView("login");
      setAuthFeedback(error.message || "Uitloggen mislukte.", "error");
    }
  } finally {
    authState.isChecking = false;
    syncAuthControls();
  }
}

async function initializeAdminAuth() {
  showLoadingState("Toegang controleren...");
  setAuthFeedback("", "info");
  syncAuthControls();
  syncControls();

  onAuthStateChange((session) => {
    if (!authState.isReady) {
      return;
    }

    handleSessionChange(session).catch((error) => {
      showLoggedOutState(error.message || "De sessie kon niet gecontroleerd worden.", "error");
    });
  });

  try {
    const session = await getCurrentSession();
    await handleSessionChange(session);
  } catch (error) {
    showLoggedOutState(error.message || "De sessie kon niet gecontroleerd worden.", "error");
    authState.isReady = true;
  }
}

async function handleSave(event) {
  event.preventDefault();

  if (state.isSaving || !authState.isAdmin) {
    return;
  }

  const values = collectFormValues();
  const validationMessage = validateForm(values);

  if (validationMessage) {
    setFormFeedback(validationMessage, "error");
    return;
  }

  state.isSaving = true;
  syncControls();
  setFormFeedback("Product wordt opgeslagen...", "info");
  setUploadStatus(state.images.length ? "Afbeeldingen worden voorbereid..." : "", "info");

  const uploadedPaths = [];
  let changesCommitted = false;

  try {
    const product = await saveProduct(values);
    const finalImageUrls = [];

    for (let index = 0; index < state.images.length; index += 1) {
      const image = state.images[index];

      if (image.pending) {
        setUploadStatus(
          `Afbeelding ${index + 1} van ${state.images.length} wordt geupload...`,
          "info",
        );

        const uploadResult = await uploadProductImage(product.id, image.blob);
        uploadedPaths.push(uploadResult.filePath);
        finalImageUrls.push(uploadResult.imageUrl);
      } else {
        finalImageUrls.push(image.imageUrl);
      }
    }

    await replaceProductImages(product.id, finalImageUrls);
    changesCommitted = true;

    let cleanupWarning = "";

    if (state.removedImagePaths.length) {
      try {
        await removeStorageObjects(state.removedImagePaths);
      } catch (error) {
        cleanupWarning = " Oude afbeeldingen bleven nog in Storage staan.";
      }
    }

    await loadProducts(product.id);
    renderProductList();
    setFormFeedback(`Product opgeslagen.${cleanupWarning}`, cleanupWarning ? "info" : "success");
    setUploadStatus(
      finalImageUrls.length
        ? "Galerij is bijgewerkt en staat klaar op de website."
        : "Product opgeslagen zonder galerijbeelden.",
      "info",
    );
  } catch (error) {
    if (!changesCommitted && uploadedPaths.length) {
      try {
        await removeStorageObjects(uploadedPaths);
      } catch (cleanupError) {
        console.error(cleanupError);
      }
    }

    if (changesCommitted) {
      setFormFeedback(
        "Product opgeslagen, maar de admin kon de nieuwste data niet opnieuw laden.",
        "info",
      );
      setUploadStatus("Ververs de pagina om de laatste data terug op te halen.", "info");
    } else {
      setFormFeedback(error.message || "Het product kon niet opgeslagen worden.", "error");
      setUploadStatus("Opslaan afgebroken.", "error");
    }
  } finally {
    state.isSaving = false;
    syncControls();
    renderImagePreviewGrid();
  }
}

async function handleDeleteProduct() {
  const product = getSelectedProduct();

  if (!product || state.isSaving || !authState.isAdmin) {
    return;
  }

  const confirmed = window.confirm(`Weet je zeker dat je "${product.name}" wilt verwijderen?`);

  if (!confirmed) {
    return;
  }

  state.isSaving = true;
  syncControls();
  setFormFeedback(`"${product.name}" wordt verwijderd...`, "info");
  setUploadStatus("", "info");

  const imagePaths = product.images
    .map((image) => extractStoragePath(image.image_url))
    .filter(Boolean);
  let productDeleted = false;

  try {
    await deleteProduct(product.id);
    productDeleted = true;

    let cleanupWarning = "";

    if (imagePaths.length) {
      try {
        await removeStorageObjects(imagePaths);
      } catch (error) {
        cleanupWarning = " Sommige bestanden bleven nog in Storage staan.";
      }
    }

    const remainingProducts = state.products.filter((entry) => entry.id !== product.id);
    const nextProductId = remainingProducts[0] ? remainingProducts[0].id : null;

    await loadProducts(nextProductId);
    renderProductList();
    setFormFeedback(`Product verwijderd.${cleanupWarning}`, cleanupWarning ? "info" : "success");
  } catch (error) {
    if (productDeleted) {
      setFormFeedback(
        "Product verwijderd, maar de admin kon de lijst niet opnieuw laden.",
        "info",
      );
    } else {
      setFormFeedback(error.message || "Het product kon niet verwijderd worden.", "error");
    }
  } finally {
    state.isSaving = false;
    syncControls();
    renderImagePreviewGrid();
  }
}

function getCropFrameSize() {
  return {
    width: cropViewport.clientWidth,
    height: cropViewport.clientHeight,
  };
}

function updateCropImageMetrics() {
  if (!cropImage.naturalWidth || !cropImage.naturalHeight) {
    return;
  }

  const { width: frameWidth, height: frameHeight } = getCropFrameSize();
  const previousCenterX = cropState.imageX + cropState.renderWidth / 2;
  const previousCenterY = cropState.imageY + cropState.renderHeight / 2;
  const hasPreviousLayout = cropState.renderWidth > 0 && cropState.renderHeight > 0;

  cropState.baseScale = getFitScale(frameWidth, frameHeight);
  cropState.renderWidth = cropImage.naturalWidth * cropState.baseScale * cropState.zoom;
  cropState.renderHeight = cropImage.naturalHeight * cropState.baseScale * cropState.zoom;

  if (hasPreviousLayout) {
    cropState.imageX = previousCenterX - cropState.renderWidth / 2;
    cropState.imageY = previousCenterY - cropState.renderHeight / 2;
  } else {
    cropState.imageX = (frameWidth - cropState.renderWidth) / 2;
    cropState.imageY = (frameHeight - cropState.renderHeight) / 2;
  }

  clampCropImagePosition(frameWidth, frameHeight);
  applyCropImageStyles();
}

function getNormalizedRotation() {
  return ((cropState.rotation % 360) + 360) % 360;
}

function getFitScale(frameWidth, frameHeight) {
  const normalizedRotation = getNormalizedRotation();
  const isQuarterTurn = normalizedRotation === 90 || normalizedRotation === 270;
  const rotatedWidth = isQuarterTurn ? cropImage.naturalHeight : cropImage.naturalWidth;
  const rotatedHeight = isQuarterTurn ? cropImage.naturalWidth : cropImage.naturalHeight;

  return Math.min(frameWidth / rotatedWidth, frameHeight / rotatedHeight);
}

function getCropBounds() {
  const normalizedRotation = getNormalizedRotation();
  const isQuarterTurn = normalizedRotation === 90 || normalizedRotation === 270;

  return {
    width: isQuarterTurn ? cropState.renderHeight : cropState.renderWidth,
    height: isQuarterTurn ? cropState.renderWidth : cropState.renderHeight,
  };
}

function clampCropImagePosition(frameWidth, frameHeight) {
  const bounds = getCropBounds();
  let centerX = cropState.imageX + cropState.renderWidth / 2;
  let centerY = cropState.imageY + cropState.renderHeight / 2;

  if (bounds.width <= frameWidth) {
    centerX = frameWidth / 2;
  } else {
    centerX = clamp(centerX, frameWidth - bounds.width / 2, bounds.width / 2);
  }

  if (bounds.height <= frameHeight) {
    centerY = frameHeight / 2;
  } else {
    centerY = clamp(centerY, frameHeight - bounds.height / 2, bounds.height / 2);
  }

  cropState.imageX = centerX - cropState.renderWidth / 2;
  cropState.imageY = centerY - cropState.renderHeight / 2;
}

function applyCropImageStyles() {
  cropImage.style.width = `${cropState.renderWidth}px`;
  cropImage.style.height = `${cropState.renderHeight}px`;
  cropImage.style.left = `${cropState.imageX}px`;
  cropImage.style.top = `${cropState.imageY}px`;
  cropImage.style.transform = `scaleX(${cropState.mirrored ? -1 : 1}) rotate(${cropState.rotation}deg)`;
}

function syncCropUi() {
  cropZoom.disabled = false;
  cropConfirmButton.textContent = "Gebruik beeld";
  cropTitle.textContent = "Volledig beeld passen";
  cropMirrorButton.classList.toggle("is-active", cropState.mirrored);
  cropMirrorButton.setAttribute("aria-pressed", String(cropState.mirrored));
}

function initializeCropper() {
  cropState.zoom = 1;
  cropState.rotation = 0;
  cropState.mirrored = false;
  cropState.renderWidth = 0;
  cropState.renderHeight = 0;
  cropZoom.value = "1";
  syncCropUi();
  updateCropImageMetrics();
}

function closeCropper() {
  cropModal.hidden = true;
  document.body.classList.remove("crop-open");
  cropState.isDragging = false;
  cropViewport.classList.remove("is-dragging");
  cropImage.removeAttribute("src");

  if (cropState.objectUrl) {
    URL.revokeObjectURL(cropState.objectUrl);
    cropState.objectUrl = "";
  }
}

function cancelCropper() {
  if (cropState.resolver) {
    cropState.resolver(null);
    cropState.resolver = null;
  }

  closeCropper();
}

async function confirmCropper() {
  if (!cropState.resolver) {
    return;
  }

  cropConfirmButton.disabled = true;
  cropCancelButton.disabled = true;

  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("De browser kon de afbeelding niet verwerken.");
    }

    canvas.width = PRODUCT_IMAGE_EXPORT_WIDTH;
    canvas.height = PRODUCT_IMAGE_EXPORT_HEIGHT;
    const { width: frameWidth, height: frameHeight } = getCropFrameSize();
    const viewportToCanvasScaleX = canvas.width / frameWidth;
    const viewportToCanvasScaleY = canvas.height / frameHeight;
    const centerX = (cropState.imageX + cropState.renderWidth / 2) * viewportToCanvasScaleX;
    const centerY = (cropState.imageY + cropState.renderHeight / 2) * viewportToCanvasScaleY;
    const drawWidth = cropState.renderWidth * viewportToCanvasScaleX;
    const drawHeight = cropState.renderHeight * viewportToCanvasScaleY;

    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.translate(centerX, centerY);
    context.scale(cropState.mirrored ? -1 : 1, 1);
    context.rotate((cropState.rotation * Math.PI) / 180);
    context.drawImage(
      cropImage,
      -drawWidth / 2,
      -drawHeight / 2,
      drawWidth,
      drawHeight,
    );

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.9);
    });

    if (!blob) {
      throw new Error("De afbeelding kon niet omgezet worden naar WebP.");
    }

    cropState.resolver(blob);
    cropState.resolver = null;
    closeCropper();
  } catch (error) {
    setUploadStatus(error.message || "De afbeelding kon niet verwerkt worden.", "error");
  } finally {
    cropConfirmButton.disabled = false;
    cropCancelButton.disabled = false;
  }
}

function openCropper(file) {
  return new Promise((resolve, reject) => {
    cropState.resolver = resolve;
    cropState.objectUrl = URL.createObjectURL(file);
    cropState.zoom = 1;
    cropState.rotation = 0;
    cropState.mirrored = false;
    cropState.renderWidth = 0;
    cropState.renderHeight = 0;
    cropFileName.textContent = file.name;
    cropConfirmButton.disabled = false;
    cropCancelButton.disabled = false;
    cropViewport.classList.remove("is-dragging");
    syncCropUi();
    cropModal.hidden = false;
    document.body.classList.add("crop-open");
    cropImage.onload = () => {
      initializeCropper();
    };
    cropImage.onerror = () => {
      cropState.resolver = null;
      closeCropper();
      reject(new Error("De gekozen afbeelding kon niet gelezen worden."));
    };
    cropImage.src = cropState.objectUrl;
  });
}

async function handleImageSelection(event) {
  if (!authState.isAdmin) {
    return;
  }

  const files = Array.from(event.target.files || []);
  event.target.value = "";

  if (!files.length) {
    return;
  }

  const availableSlots = MAX_IMAGES - state.images.length;

  if (availableSlots <= 0) {
    setUploadStatus(`Je kan maximaal ${MAX_IMAGES} afbeeldingen toevoegen.`, "error");
    syncControls();
    return;
  }

  const filesToProcess = files.slice(0, availableSlots);
  let skippedCount = 0;

  if (files.length > availableSlots) {
    setUploadStatus(
      `Er waren te veel bestanden geselecteerd. Alleen de eerste ${availableSlots} worden verwerkt.`,
      "error",
    );
  }

  for (let index = 0; index < filesToProcess.length; index += 1) {
    const file = filesToProcess[index];

    setUploadStatus(
      `Afbeelding ${index + 1} van ${filesToProcess.length} klaarzetten...`,
      "info",
    );

    try {
      const blob = await openCropper(file);

      if (!blob) {
        skippedCount += 1;
        continue;
      }

      const previewUrl = URL.createObjectURL(blob);

      state.images.push({
        id: crypto.randomUUID(),
        imageUrl: null,
        previewUrl,
        filePath: null,
        blob,
        pending: true,
        revokeOnDispose: true,
      });

      renderImagePreviewGrid();
      syncControls();
    } catch (error) {
      skippedCount += 1;
      setUploadStatus(error.message || "Een afbeelding kon niet voorbereid worden.", "error");
    }
  }

  const addedCount = filesToProcess.length - skippedCount;

  if (addedCount > 0) {
    setUploadStatus(
      `${addedCount} afbeelding(en) klaar om op te slaan.${skippedCount ? ` ${skippedCount} overgeslagen.` : ""}`,
      "info",
    );
  } else if (skippedCount > 0) {
    setUploadStatus("Er zijn geen nieuwe afbeeldingen toegevoegd.", "error");
  }
}

productList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-product-id]");

  if (!button || state.isSaving || !authState.isAdmin) {
    return;
  }

  const product = state.products.find((entry) => entry.id === button.dataset.productId);

  if (!product) {
    return;
  }

  applyProductToForm(product);
  renderProductList();
  setFormFeedback("", "info");
  setUploadStatus("", "info");
});

imagePreviewGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");

  if (!button || state.isSaving || !authState.isAdmin) {
    return;
  }

  const imageId = button.dataset.imageId;

  if (button.dataset.action === "move-left") {
    moveImage(imageId, -1);
  }

  if (button.dataset.action === "move-right") {
    moveImage(imageId, 1);
  }

  if (button.dataset.action === "delete") {
    removeImage(imageId);
  }
});

adminTabButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    if (!authState.isAdmin) {
      return;
    }

    const nextTab = button.dataset.adminTab || "products";
    setActiveTab(nextTab);

    if (nextTab === "orders") {
      try {
        await ensureOrdersLoaded();
      } catch (error) {
        console.error(error);
      }
    }
  });
});

if (ordersList) {
  ordersList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-order-action]");

    if (!button) {
      return;
    }

    handleOrderAction(button.dataset.orderId, button.dataset.orderAction);
  });
}

priceLabelInput.addEventListener("change", () => {
  if (priceLabelInput.value === "op_aanvraag") {
    priceInput.value = "";
  }

  syncControls();
});

newProductButton.addEventListener("click", () => {
  if (state.isSaving || !authState.isAdmin) {
    return;
  }

  resetForm();
  renderProductList();
  setFormFeedback("", "info");
  setUploadStatus("", "info");
});

deleteProductButton.addEventListener("click", handleDeleteProduct);
productForm.addEventListener("submit", handleSave);
imageInput.addEventListener("change", handleImageSelection);
loginForm.addEventListener("submit", handleLoginSubmit);
logoutButton.addEventListener("click", handleLogout);
accessDeniedLogoutButton.addEventListener("click", handleLogout);
cropCancelButton.addEventListener("click", cancelCropper);
cropConfirmButton.addEventListener("click", confirmCropper);
cropRotateButton.addEventListener("click", () => {
  cropState.rotation = (cropState.rotation + 90) % 360;
  updateCropImageMetrics();
});
cropMirrorButton.addEventListener("click", () => {
  cropState.mirrored = !cropState.mirrored;
  syncCropUi();
  applyCropImageStyles();
});

cropModal.addEventListener("click", (event) => {
  if (event.target === cropModal) {
    cancelCropper();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !cropModal.hidden) {
    cancelCropper();
  }
});

cropZoom.addEventListener("input", () => {
  cropState.zoom = Number(cropZoom.value);
  updateCropImageMetrics();
});

cropViewport.addEventListener("pointerdown", (event) => {
  if (cropModal.hidden) {
    return;
  }

  cropState.isDragging = true;
  cropViewport.classList.add("is-dragging");
  cropState.dragStartX = event.clientX;
  cropState.dragStartY = event.clientY;
  cropState.startImageX = cropState.imageX;
  cropState.startImageY = cropState.imageY;
  cropViewport.setPointerCapture(event.pointerId);
});

cropViewport.addEventListener("pointermove", (event) => {
  if (!cropState.isDragging) {
    return;
  }

  cropState.imageX = cropState.startImageX + (event.clientX - cropState.dragStartX);
  cropState.imageY = cropState.startImageY + (event.clientY - cropState.dragStartY);
  clampCropImagePosition(cropViewport.clientWidth, cropViewport.clientHeight);
  applyCropImageStyles();
});

function stopCropDrag(event) {
  if (cropState.isDragging) {
    cropState.isDragging = false;
    cropViewport.classList.remove("is-dragging");
    if (cropViewport.hasPointerCapture(event.pointerId)) {
      cropViewport.releasePointerCapture(event.pointerId);
    }
  }
}

cropViewport.addEventListener("pointerup", stopCropDrag);
cropViewport.addEventListener("pointercancel", stopCropDrag);
window.addEventListener("resize", () => {
  if (!cropModal.hidden) {
    updateCropImageMetrics();
  }
});

resetForm();
renderProductList();
setAuthLoadingMessage("Toegang controleren...");
setAccessDeniedMessage("Je hebt geen toegang tot dit beheer.");
setAuthFeedback("", "info");
setUploadStatus("", "info");
syncAuthControls();
syncControls();
initializeAdminAuth().catch((error) => {
  showLoggedOutState(error.message || "Het beheer kon niet gestart worden.", "error");
});
