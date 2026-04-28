import { fetchProductsWithImages, formatPrice } from "./supabase.js";

const productGrid = document.querySelector("#productGrid");
const productStatus = document.querySelector("#productStatus");
const demoBanner = document.querySelector("#demoBanner");
const closeDemoBanner = document.querySelector("#closeDemoBanner");
const productModal = document.querySelector("#productModal");
const productModalClose = document.querySelector("#productModalClose");
const productModalTitle = document.querySelector("#productModalTitle");
const productModalPrice = document.querySelector("#productModalPrice");
const productModalDescription = document.querySelector("#productModalDescription");
const productModalImage = document.querySelector("#productModalImage");
const productModalPlaceholder = document.querySelector("#productModalPlaceholder");
const productModalDots = document.querySelector("#productModalDots");
const productModalPrevious = document.querySelector("#productModalPrev");
const productModalNext = document.querySelector("#productModalNext");
const contactForm = document.querySelector("#contactForm");
const contactFormStatus = document.querySelector("#contactFormStatus");

const CARD_SLIDE_INTERVAL = 3200;
const CARD_SLIDE_TRANSITION_MS = 820;

let cardObserver = null;
let currentProducts = [];

const modalState = {
  product: null,
  imageUrls: [],
  currentIndex: 0,
};

const preloadCache = new Map();
const prefersReducedMotion = window.matchMedia
  ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
  : false;

const spotlightState = {
  rafId: 0,
  currentX: 0,
  currentY: 0,
  targetX: 0,
  targetY: 0,
  ambientX: 0,
  ambientY: 0,
  currentOpacity: 0.24,
  targetOpacity: 0.24,
  isCoarse: window.matchMedia ? window.matchMedia("(pointer: coarse)").matches : false,
  pointerIsActive: false,
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

function createSlideImage(source, alt, className = "") {
  const image = document.createElement("img");
  image.src = source;
  image.alt = alt;
  image.loading = "lazy";
  image.decoding = "async";
  image.className = className;
  return image;
}

function preloadImage(source) {
  if (!source) {
    return Promise.resolve();
  }

  if (!preloadCache.has(source)) {
    preloadCache.set(
      source,
      new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => resolve();
        image.src = source;

        if (image.complete) {
          resolve();
        }
      }),
    );
  }

  return preloadCache.get(source);
}

function waitForTransition(element, duration) {
  return new Promise((resolve) => {
    let settled = false;

    function finish() {
      if (settled) {
        return;
      }

      settled = true;
      element.removeEventListener("transitionend", handleTransitionEnd);
      window.clearTimeout(timeoutId);
      resolve();
    }

    function handleTransitionEnd(event) {
      if (event.target !== element || event.propertyName !== "opacity") {
        return;
      }

      finish();
    }

    const timeoutId = window.setTimeout(finish, duration);
    element.addEventListener("transitionend", handleTransitionEnd);
  });
}

function setSpotlightVariables() {
  document.documentElement.style.setProperty("--glow-x", `${spotlightState.currentX}px`);
  document.documentElement.style.setProperty("--glow-y", `${spotlightState.currentY}px`);
  document.documentElement.style.setProperty("--glow-opacity", spotlightState.currentOpacity.toFixed(3));
}

function scheduleSpotlightFrame() {
  if (!spotlightState.rafId) {
    spotlightState.rafId = window.requestAnimationFrame(animateSpotlight);
  }
}

function animateSpotlight() {
  spotlightState.rafId = 0;

  spotlightState.currentX += (spotlightState.targetX - spotlightState.currentX) * 0.12;
  spotlightState.currentY += (spotlightState.targetY - spotlightState.currentY) * 0.12;
  spotlightState.currentOpacity += (spotlightState.targetOpacity - spotlightState.currentOpacity) * 0.08;

  setSpotlightVariables();

  const xDelta = Math.abs(spotlightState.targetX - spotlightState.currentX);
  const yDelta = Math.abs(spotlightState.targetY - spotlightState.currentY);
  const opacityDelta = Math.abs(spotlightState.targetOpacity - spotlightState.currentOpacity);

  if (xDelta > 0.6 || yDelta > 0.6 || opacityDelta > 0.004) {
    scheduleSpotlightFrame();
  }
}

function setAmbientSpotlight(shouldAnimate = true) {
  spotlightState.ambientX = window.innerWidth * 0.5;
  spotlightState.ambientY = spotlightState.isCoarse ? window.innerHeight * 0.24 : window.innerHeight * 0.18;
  spotlightState.targetX = spotlightState.ambientX;
  spotlightState.targetY = spotlightState.ambientY;
  spotlightState.targetOpacity = spotlightState.isCoarse ? 0.24 : 0.2;
  spotlightState.pointerIsActive = false;

  if (shouldAnimate) {
    scheduleSpotlightFrame();
  } else {
    spotlightState.currentX = spotlightState.targetX;
    spotlightState.currentY = spotlightState.targetY;
    spotlightState.currentOpacity = spotlightState.targetOpacity;
    setSpotlightVariables();
  }
}

function moveSpotlightTo(clientX, clientY, opacity) {
  spotlightState.targetX = clientX;
  spotlightState.targetY = clientY;
  spotlightState.targetOpacity = opacity;
  spotlightState.pointerIsActive = true;
  scheduleSpotlightFrame();
}

function initializeSpotlight() {
  if (prefersReducedMotion) {
    document.documentElement.style.setProperty("--glow-opacity", "0.16");
    return;
  }

  setAmbientSpotlight(false);

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse") {
      moveSpotlightTo(event.clientX, event.clientY, 0.24);
      return;
    }

    if (event.isPrimary && spotlightState.isCoarse) {
      moveSpotlightTo(event.clientX, event.clientY, 0.22);
    }
  });

  window.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" && event.isPrimary) {
      moveSpotlightTo(event.clientX, event.clientY, 0.22);
    }
  });

  function resetToAmbient() {
    setAmbientSpotlight(true);
  }

  window.addEventListener("pointerup", resetToAmbient);
  window.addEventListener("pointercancel", resetToAmbient);
  document.documentElement.addEventListener("mouseleave", () => {
    if (!spotlightState.isCoarse) {
      resetToAmbient();
    }
  });

  window.addEventListener("resize", () => {
    spotlightState.isCoarse = window.matchMedia ? window.matchMedia("(pointer: coarse)").matches : false;
    setAmbientSpotlight(!spotlightState.pointerIsActive);
  });
}

function setProductStatus(message, tone = "info") {
  if (!productStatus) {
    return;
  }

  if (!message) {
    productStatus.hidden = true;
    productStatus.textContent = "";
    productStatus.classList.remove("is-error");
    return;
  }

  productStatus.hidden = false;
  productStatus.textContent = message;
  productStatus.classList.toggle("is-error", tone === "error");
}

function getProductImageUrls(product) {
  if (!product || !Array.isArray(product.images)) {
    return [];
  }

  return product.images.map((image) => image.image_url).filter(Boolean);
}

function renderModalDots() {
  if (!productModalDots) {
    return;
  }

  productModalDots.replaceChildren();

  if (modalState.imageUrls.length <= 1) {
    productModalDots.hidden = true;
    return;
  }

  modalState.imageUrls.forEach((_, index) => {
    const dot = createElement("span", index === modalState.currentIndex ? "dot active" : "dot");
    productModalDots.appendChild(dot);
  });

  productModalDots.hidden = false;
}

function renderModalImage() {
  if (!productModalImage || !productModalPlaceholder || !productModalPrevious || !productModalNext) {
    return;
  }

  const currentImageUrl = modalState.imageUrls[modalState.currentIndex];
  const hasImages = modalState.imageUrls.length > 0;
  const hasMultipleImages = modalState.imageUrls.length > 1;

  if (!hasImages || !currentImageUrl) {
    productModalImage.hidden = true;
    productModalImage.removeAttribute("src");
    productModalPlaceholder.hidden = false;
  } else {
    productModalImage.hidden = false;
    productModalImage.src = currentImageUrl;
    productModalImage.alt = modalState.product ? modalState.product.name : "";
    productModalPlaceholder.hidden = true;
  }

  productModalPrevious.hidden = !hasMultipleImages;
  productModalNext.hidden = !hasMultipleImages;

  renderModalDots();
}

function setModalImage(nextIndex) {
  if (!modalState.imageUrls.length) {
    return;
  }

  if (nextIndex < 0) {
    modalState.currentIndex = modalState.imageUrls.length - 1;
  } else if (nextIndex >= modalState.imageUrls.length) {
    modalState.currentIndex = 0;
  } else {
    modalState.currentIndex = nextIndex;
  }

  renderModalImage();
}

function closeProductModal() {
  if (!productModal || productModal.hidden) {
    return;
  }

  productModal.hidden = true;
  document.body.classList.remove("modalOpen");
  modalState.product = null;
  modalState.imageUrls = [];
  modalState.currentIndex = 0;
}

function openProductModal(product) {
  if (
    !productModal ||
    !productModalTitle ||
    !productModalPrice ||
    !productModalDescription ||
    !product
  ) {
    return;
  }

  modalState.product = product;
  modalState.imageUrls = getProductImageUrls(product);
  modalState.currentIndex = 0;

  productModalTitle.textContent = product.name;
  productModalPrice.textContent = formatPrice(product);
  productModalDescription.textContent = product.description || "Beschrijving volgt binnenkort.";

  renderModalImage();

  productModal.hidden = false;
  document.body.classList.add("modalOpen");

  if (productModalClose) {
    productModalClose.focus();
  }
}

function createCard(product) {
  const imageUrls = getProductImageUrls(product);
  let currentIndex = 0;
  let autoTimer = null;
  let isVisible = false;
  let isTransitioning = false;
  let visibleLayer = 0;
  let queuedIndex = null;

  const card = createElement("article", "card");
  card.dataset.productId = product.id;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Bekijk details van ${product.name}`);
  card.setAttribute("aria-haspopup", "dialog");

  const imageBox = createElement("div", "cardImage");
  const cardBody = createElement("div", "cardBody");
  const title = createElement("h3", "", product.name);
  const description = createElement(
    "p",
    "cardDescription",
    product.description || "Beschrijving volgt binnenkort.",
  );
  const footer = createElement("div", "cardFooter");
  const dots = createElement("div", "dots");
  const priceRow = createElement("div", "cardPriceRow");
  const detailsButton = createElement("button", "cardMore", "Lees meer");
  const price = createElement("div", "price", formatPrice(product));
  let slideLayers = [];

  detailsButton.type = "button";
  detailsButton.setAttribute("aria-label", `Lees meer over ${product.name}`);

  if (imageUrls.length > 0) {
    const activeLayer = createSlideImage(imageUrls[0], product.name, "cardSlide is-current");
    const standbyLayer = createSlideImage(imageUrls[0], product.name, "cardSlide");
    slideLayers = [activeLayer, standbyLayer];
    imageBox.append(activeLayer, standbyLayer);
  } else {
    const placeholder = createElement("div", "cardPlaceholder");
    placeholder.appendChild(createElement("span", "", "Afbeelding volgt binnenkort"));
    imageBox.appendChild(placeholder);
  }

  function renderDots() {
    dots.replaceChildren();

    imageUrls.forEach((_, index) => {
      const dot = createElement("span", index === currentIndex ? "dot active" : "dot");
      dots.appendChild(dot);
    });
  }

  async function transitionToImage(nextIndex) {
    if (imageUrls.length <= 1) {
      return;
    }

    const normalizedIndex = (nextIndex + imageUrls.length) % imageUrls.length;

    if (normalizedIndex === currentIndex) {
      return;
    }

    if (isTransitioning) {
      queuedIndex = normalizedIndex;
      return;
    }

    const outgoingLayer = slideLayers[visibleLayer];
    const incomingLayer = slideLayers[1 - visibleLayer];
    const nextUrl = imageUrls[normalizedIndex];

    if (!outgoingLayer || !incomingLayer || !nextUrl) {
      currentIndex = normalizedIndex;
      renderDots();
      return;
    }

    isTransitioning = true;
    queuedIndex = null;

    await preloadImage(nextUrl);

    incomingLayer.src = nextUrl;
    incomingLayer.alt = product.name;
    incomingLayer.className = "cardSlide";

    // Ensure the browser applies the reset state before starting the fade.
    incomingLayer.getBoundingClientRect();

    window.requestAnimationFrame(() => {
      incomingLayer.classList.add("is-current");
      outgoingLayer.classList.add("is-exit");
      outgoingLayer.classList.remove("is-current");
    });

    await waitForTransition(incomingLayer, CARD_SLIDE_TRANSITION_MS);

    outgoingLayer.className = "cardSlide";
    currentIndex = normalizedIndex;
    visibleLayer = 1 - visibleLayer;
    renderDots();
    isTransitioning = false;

    if (queuedIndex != null && queuedIndex !== currentIndex) {
      const pendingIndex = queuedIndex;
      queuedIndex = null;
      transitionToImage(pendingIndex);
    }
  }

  function stopAutoSlide() {
    if (autoTimer) {
      window.clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  function startAutoSlide() {
    if (imageUrls.length <= 1 || autoTimer || !isVisible) {
      return;
    }

    autoTimer = window.setInterval(() => {
      transitionToImage(currentIndex + 1);
    }, CARD_SLIDE_INTERVAL);
  }

  function restartAutoSlide() {
    stopAutoSlide();

    if (isVisible) {
      startAutoSlide();
    }
  }

  function handleArrowClick(direction) {
    transitionToImage(currentIndex + direction);
    restartAutoSlide();
  }

  if (imageUrls.length > 1) {
    const previousButton = createElement("button", "arrow prev", "‹");
    const nextButton = createElement("button", "arrow next", "›");

    previousButton.type = "button";
    previousButton.setAttribute("aria-label", `Vorige afbeelding van ${product.name}`);
    nextButton.type = "button";
    nextButton.setAttribute("aria-label", `Volgende afbeelding van ${product.name}`);

    imageBox.append(previousButton, nextButton);

    previousButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleArrowClick(-1);
    });

    nextButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleArrowClick(1);
    });

    renderDots();
    footer.appendChild(dots);
  }

  card.startAutoSlide = () => {
    isVisible = true;
    startAutoSlide();
  };

  card.stopAutoSlide = () => {
    isVisible = false;
    stopAutoSlide();
  };

  card.addEventListener("keydown", (event) => {
    if (event.target !== card) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProductModal(product);
    }
  });

  priceRow.append(detailsButton, price);
  footer.appendChild(priceRow);
  cardBody.append(title, description, footer);
  card.append(imageBox, cardBody);

  return card;
}

function renderProducts(products) {
  if (!productGrid) {
    return;
  }

  currentProducts = products.slice();

  if (cardObserver) {
    cardObserver.disconnect();
  }

  productGrid.querySelectorAll(".card").forEach((card) => {
    if (typeof card.stopAutoSlide === "function") {
      card.stopAutoSlide();
    }
  });

  productGrid.replaceChildren();

  if (!products.length) {
    setProductStatus("Er staan nog geen producten online.");
    return;
  }

  const fragment = document.createDocumentFragment();

  products.forEach((product) => {
    fragment.appendChild(createCard(product));
  });

  productGrid.appendChild(fragment);

  cardObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && typeof entry.target.startAutoSlide === "function") {
          entry.target.startAutoSlide();
        } else if (!entry.isIntersecting && typeof entry.target.stopAutoSlide === "function") {
          entry.target.stopAutoSlide();
        }
      });
    },
    { threshold: 0.25 },
  );

  productGrid.querySelectorAll(".card").forEach((card) => {
    cardObserver.observe(card);
  });
}

async function loadProducts() {
  if (!productGrid) {
    return;
  }

  setProductStatus("Collectie wordt geladen...");

  try {
    const products = await fetchProductsWithImages();
    renderProducts(products);

    if (products.length) {
      setProductStatus("");
    }
  } catch (error) {
    productGrid.replaceChildren();
    setProductStatus(error.message || "De collectie kon niet geladen worden.", "error");
  }
}

if (contactForm && contactFormStatus) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    contactFormStatus.textContent =
      "Dank je. Dit demoformulier verstuurt nog niets, maar de aanvraagflow is klaar om gekoppeld te worden.";
  });
}

if (closeDemoBanner && demoBanner) {
  closeDemoBanner.addEventListener("click", () => {
    demoBanner.classList.add("hidden");
  });
}

if (productModalClose && productModal) {
  productModalClose.addEventListener("click", closeProductModal);

  productModal.addEventListener("click", (event) => {
    if (event.target === productModal) {
      closeProductModal();
    }
  });
}

if (productGrid) {
  productGrid.addEventListener("click", (event) => {
    if (event.target.closest(".arrow")) {
      return;
    }

    const card = event.target.closest(".card[data-product-id]");

    if (!card) {
      return;
    }

    const selectedProduct = currentProducts.find((product) => product.id === card.dataset.productId);
    openProductModal(selectedProduct || null);
  });
}

if (productModalPrevious) {
  productModalPrevious.addEventListener("click", () => {
    setModalImage(modalState.currentIndex - 1);
  });
}

if (productModalNext) {
  productModalNext.addEventListener("click", () => {
    setModalImage(modalState.currentIndex + 1);
  });
}

window.addEventListener("keydown", (event) => {
  if (!productModal || productModal.hidden) {
    return;
  }

  if (event.key === "Escape") {
    closeProductModal();
  }

  if (event.key === "ArrowLeft") {
    setModalImage(modalState.currentIndex - 1);
  }

  if (event.key === "ArrowRight") {
    setModalImage(modalState.currentIndex + 1);
  }
});

loadProducts();
initializeSpotlight();
