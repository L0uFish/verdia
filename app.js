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
const productModalFeatured = document.querySelector("#productModalFeatured");
const productModalImage = document.querySelector("#productModalImage");
const productModalPlaceholder = document.querySelector("#productModalPlaceholder");
const productModalDots = document.querySelector("#productModalDots");
const productModalPrevious = document.querySelector("#productModalPrev");
const productModalNext = document.querySelector("#productModalNext");

let cardObserver = null;
let currentProducts = [];
const CARD_SLIDE_INTERVAL = 1800;

const modalState = {
  product: null,
  imageUrls: [],
  currentIndex: 0,
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

function createSlideImage(source, alt, className) {
  const image = document.createElement("img");
  image.src = source;
  image.alt = alt;
  image.loading = "lazy";
  image.className = className;
  return image;
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
  const hasMultipleImages = modalState.imageUrls.length > 1;
  const hasImages = modalState.imageUrls.length > 0;

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
    !productModalFeatured ||
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
  productModalFeatured.hidden = !product.featured;

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

  const card = createElement("article", "card");
  card.dataset.productId = product.id;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Bekijk details van ${product.name}`);

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
  let activeImage = null;

  detailsButton.type = "button";
  detailsButton.setAttribute("aria-label", `Lees meer over ${product.name}`);

  if (product.featured) {
    imageBox.appendChild(createElement("span", "featuredBadge", "Uitgelicht"));
  }

  if (imageUrls.length > 0) {
    activeImage = createSlideImage(imageUrls[0], product.name, "activeImg");
    imageBox.appendChild(activeImage);
  } else {
    const placeholder = createElement("div", "cardPlaceholder");
    placeholder.appendChild(createElement("span", "", "Afbeelding volgt binnenkort"));
    imageBox.appendChild(placeholder);
  }

  if (imageUrls.length > 1) {
    const previousButton = createElement("button", "arrow prev", "‹");
    const nextButton = createElement("button", "arrow next", "›");

    previousButton.type = "button";
    previousButton.setAttribute("aria-label", "Vorige afbeelding");
    nextButton.type = "button";
    nextButton.setAttribute("aria-label", "Volgende afbeelding");

    imageBox.append(previousButton, nextButton);

    previousButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      changeImage(-1, true);
    });

    nextButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      changeImage(1, true);
    });
  }

  function renderDots() {
    dots.replaceChildren();

    imageUrls.forEach((_, index) => {
      const dot = createElement("span", index === currentIndex ? "dot active" : "dot");
      dots.appendChild(dot);
    });
  }

  function renderCurrentImage() {
    if (!activeImage || !imageUrls.length) {
      return;
    }

    activeImage.src = imageUrls[currentIndex];
    activeImage.alt = product.name;
    renderDots();
  }

  function stopAutoSlide() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  function startAutoSlide() {
    if (imageUrls.length <= 1 || autoTimer || !isVisible) {
      return;
    }

    autoTimer = window.setInterval(() => {
      changeImage(1, false);
    }, CARD_SLIDE_INTERVAL);
  }

  function restartAutoSlide() {
    stopAutoSlide();
    if (isVisible) {
      startAutoSlide();
    }
  }

  function changeImage(direction, shouldRestartTimer) {
    if (imageUrls.length <= 1) {
      return;
    }

    currentIndex = (currentIndex + direction + imageUrls.length) % imageUrls.length;
    renderCurrentImage();

    if (shouldRestartTimer) {
      restartAutoSlide();
    }
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

  if (imageUrls.length > 1) {
    renderDots();
    footer.appendChild(dots);
  }

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
    { threshold: 0.2 },
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
