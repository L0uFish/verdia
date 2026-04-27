import {
  deleteProduct,
  extractStoragePath,
  fetchProductsWithImages,
  formatPrice,
  removeStorageObjects,
  replaceProductImages,
  saveProduct,
  uploadProductImage,
} from "../supabase.js";

const MAX_IMAGES = 8;

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
const featuredInput = document.querySelector("#featuredInput");
const sortOrderInput = document.querySelector("#sortOrderInput");

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
  products: [],
  currentProductId: null,
  images: [],
  removedImagePaths: [],
  isSaving: false,
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

function resetForm() {
  clearCurrentImages();

  state.currentProductId = null;

  productForm.reset();
  nameInput.value = "";
  descriptionInput.value = "";
  priceLabelInput.value = "vanaf";
  priceInput.value = "";
  featuredInput.checked = false;
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
  featuredInput.checked = product.featured;
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
    button.disabled = state.isSaving;
    button.dataset.productId = product.id;

    const title = createElement("div", "productRowTitle");
    const titleText = createElement("strong", "", product.name);
    title.appendChild(titleText);

    if (product.featured) {
      title.appendChild(createElement("span", "pill", "Uitgelicht"));
    }

    const meta = createElement("div", "productMeta");
    meta.appendChild(createElement("span", "", formatPrice(product)));
    meta.appendChild(createElement("span", "", `${product.images.length} beeld(en)`));
    meta.appendChild(createElement("span", "", `Sortering ${product.sort_order}`));

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

    moveLeftButton.disabled = state.isSaving || index === 0;
    moveRightButton.disabled = state.isSaving || index === state.images.length - 1;
    deleteButton.disabled = state.isSaving;

    actions.append(moveLeftButton, moveRightButton, deleteButton);
    body.append(title, actions);
    tile.append(thumb, body);
    fragment.appendChild(tile);
  });

  imagePreviewGrid.appendChild(fragment);
}

function syncControls() {
  const priceOnRequest = priceLabelInput.value === "op_aanvraag";
  const hasSavedProduct = Boolean(state.currentProductId);
  const limitReached = state.images.length >= MAX_IMAGES;

  nameInput.disabled = state.isSaving;
  descriptionInput.disabled = state.isSaving;
  priceLabelInput.disabled = state.isSaving;
  priceInput.disabled = state.isSaving || priceOnRequest;
  featuredInput.disabled = state.isSaving;
  sortOrderInput.disabled = state.isSaving;
  imageInput.disabled = state.isSaving || limitReached;
  newProductButton.disabled = state.isSaving;
  deleteProductButton.disabled = state.isSaving || !hasSavedProduct;
  saveProductButton.disabled = state.isSaving;
  saveProductButton.textContent = state.isSaving ? "Opslaan..." : "Product opslaan";

  uploadButton.classList.toggle("is-disabled", imageInput.disabled);
  uploadButtonText.textContent = limitReached && !state.isSaving
    ? `Maximum van ${MAX_IMAGES} afbeeldingen bereikt`
    : "Afbeeldingen toevoegen";

  priceHint.textContent = priceOnRequest
    ? "De prijs wordt niet gebruikt. Op de site verschijnt 'Prijs op aanvraag'."
    : "Deze prijs verschijnt op de site als 'Vanaf EUR ...'.";
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

  return {
    id: state.currentProductId,
    name: nameInput.value.trim(),
    description: descriptionInput.value.trim(),
    price_label: priceLabel,
    price: priceLabel === "op_aanvraag" || rawPrice === "" ? null : Number(rawPrice),
    featured: featuredInput.checked,
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
  setListStatus("Producten laden...");

  try {
    const products = await fetchProductsWithImages();
    state.products = products;

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

async function handleSave(event) {
  event.preventDefault();

  if (state.isSaving) {
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

  if (!product || state.isSaving) {
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

function updateCropImageMetrics() {
  if (!cropImage.naturalWidth || !cropImage.naturalHeight) {
    return;
  }

  const frameSize = cropViewport.clientWidth;
  const previousCenterX = cropState.imageX + cropState.renderWidth / 2;
  const previousCenterY = cropState.imageY + cropState.renderHeight / 2;
  const hasPreviousLayout = cropState.renderWidth > 0 && cropState.renderHeight > 0;

  cropState.baseScale = getFitScale(frameSize);
  cropState.renderWidth = cropImage.naturalWidth * cropState.baseScale * cropState.zoom;
  cropState.renderHeight = cropImage.naturalHeight * cropState.baseScale * cropState.zoom;

  if (hasPreviousLayout) {
    cropState.imageX = previousCenterX - cropState.renderWidth / 2;
    cropState.imageY = previousCenterY - cropState.renderHeight / 2;
  } else {
    cropState.imageX = (frameSize - cropState.renderWidth) / 2;
    cropState.imageY = (frameSize - cropState.renderHeight) / 2;
  }

  clampCropImagePosition(frameSize);
  applyCropImageStyles();
}

function getNormalizedRotation() {
  return ((cropState.rotation % 360) + 360) % 360;
}

function getFitScale(frameSize) {
  const normalizedRotation = getNormalizedRotation();
  const isQuarterTurn = normalizedRotation === 90 || normalizedRotation === 270;
  const rotatedWidth = isQuarterTurn ? cropImage.naturalHeight : cropImage.naturalWidth;
  const rotatedHeight = isQuarterTurn ? cropImage.naturalWidth : cropImage.naturalHeight;

  return Math.min(frameSize / rotatedWidth, frameSize / rotatedHeight);
}

function getCropBounds() {
  const normalizedRotation = getNormalizedRotation();
  const isQuarterTurn = normalizedRotation === 90 || normalizedRotation === 270;

  return {
    width: isQuarterTurn ? cropState.renderHeight : cropState.renderWidth,
    height: isQuarterTurn ? cropState.renderWidth : cropState.renderHeight,
  };
}

function clampCropImagePosition(frameSize) {
  const bounds = getCropBounds();
  let centerX = cropState.imageX + cropState.renderWidth / 2;
  let centerY = cropState.imageY + cropState.renderHeight / 2;

  if (bounds.width <= frameSize) {
    centerX = frameSize / 2;
  } else {
    centerX = clamp(centerX, frameSize - bounds.width / 2, bounds.width / 2);
  }

  if (bounds.height <= frameSize) {
    centerY = frameSize / 2;
  } else {
    centerY = clamp(centerY, frameSize - bounds.height / 2, bounds.height / 2);
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

    canvas.width = 1000;
    canvas.height = 1000;
    const frameSize = cropViewport.clientWidth;
    const viewportToCanvasScale = canvas.width / frameSize;
    const centerX = (cropState.imageX + cropState.renderWidth / 2) * viewportToCanvasScale;
    const centerY = (cropState.imageY + cropState.renderHeight / 2) * viewportToCanvasScale;
    const drawWidth = cropState.renderWidth * viewportToCanvasScale;
    const drawHeight = cropState.renderHeight * viewportToCanvasScale;

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

  if (!button || state.isSaving) {
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

  if (!button || state.isSaving) {
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

priceLabelInput.addEventListener("change", () => {
  if (priceLabelInput.value === "op_aanvraag") {
    priceInput.value = "";
  }

  syncControls();
});

newProductButton.addEventListener("click", () => {
  if (state.isSaving) {
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
  clampCropImagePosition(cropViewport.clientWidth);
  applyCropImageStyles();
});

function stopCropDrag(event) {
  if (cropState.isDragging) {
    cropState.isDragging = false;
    cropViewport.classList.remove("is-dragging");
    cropViewport.releasePointerCapture(event.pointerId);
  }
}

cropViewport.addEventListener("pointerup", stopCropDrag);
cropViewport.addEventListener("pointercancel", stopCropDrag);

resetForm();
renderProductList();
setUploadStatus("", "info");
syncControls();
loadProducts().catch(() => {});
