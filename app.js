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

function renderModalDots() {
  if (!productModalDots) {
    return;
  }

  productModalDots.replaceChildren();

  modalState.imageUrls.forEach((_, index) => {
    const dot = createElement("span", index === modalState.currentIndex ? "dot active" : "dot");
    productModalDots.appendChild(dot);
  });

  productModalDots.hidden = modalState.imageUrls.length <= 1;
}

function renderModalImage() {
  if (!productModalImage || !productModalPlaceholder || !productModalPrevious || !productModalNext) {
    return;
  }

  const currentImageUrl = modalState.imageUrls[modalState.currentIndex];
  const hasMultipleImages = modalState.imageUrls.length > 1;

  if (!currentImageUrl) {
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
  modalState.imageUrls = product.images.map((image) => image.image_url).filter(Boolean);
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
  const imageUrls = product.images.map((image) => image.image_url).filter(Boolean);
  let currentIndex = 0;
  let autoTimer = null;

  const card = createElement("article", "card");
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

  detailsButton.type = "button";
  detailsButton.dataset.productId = product.id;
  detailsButton.setAttribute("aria-label", `Lees meer over ${product.name}`);

  if (product.featured) {
    imageBox.appendChild(createElement("span", "featuredBadge", "Uitgelicht"));
  }

  if (imageUrls.length > 0) {
    imageBox.appendChild(createSlideImage(imageUrls[0], product.name, "activeImg"));
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
      event.stopPropagation();
      setImage(currentIndex === 0 ? imageUrls.length - 1 : currentIndex - 1, -1);
    });

    nextButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setImage(currentIndex === imageUrls.length - 1 ? 0 : currentIndex + 1, 1);
    });

    imageBox.addEventListener("click", () => {
      setImage(currentIndex === imageUrls.length - 1 ? 0 : currentIndex + 1, 1);
    });
  }

  function renderDots() {
    dots.replaceChildren();

    imageUrls.forEach((_, index) => {
      const dot = createElement("span", index === currentIndex ? "dot active" : "dot");
      dots.appendChild(dot);
    });
  }

  function setImage(nextIndex, direction) {
    if (imageUrls.length <= 1 || nextIndex === currentIndex) {
      return;
    }

    const oldImage = imageBox.querySelector(".activeImg");

    if (!oldImage) {
      return;
    }

    const newImage = createSlideImage(imageUrls[nextIndex], product.name, "incoming");
    newImage.style.opacity = "0";
    newImage.style.transform = `translateX(${direction * 100}%) scale(1.05)`;

    imageBox.querySelectorAll("img.incoming, img.leaving").forEach((image) => image.remove());
    imageBox.appendChild(newImage);

    oldImage.classList.remove("activeImg");
    oldImage.classList.add("leaving");

    newImage.offsetWidth;

    requestAnimationFrame(() => {
      newImage.style.opacity = "1";
      newImage.style.transform = "translateX(0) scale(1)";

      oldImage.style.opacity = "0";
      oldImage.style.transform = `translateX(${-direction * 100}%) scale(0.95)`;
    });

    newImage.addEventListener(
      "transitionend",
      (event) => {
        if (event.propertyName !== "transform") {
          return;
        }

        newImage.classList.remove("incoming");
        newImage.classList.add("activeImg");

        if (oldImage.parentNode) {
          oldImage.remove();
        }
      },
      { once: true },
    );

    currentIndex = nextIndex;
    renderDots();
    resetAutoSlide();
  }

  function resetAutoSlide() {
    if (autoTimer) {
      clearInterval(autoTimer);
    }

    autoTimer = window.setInterval(() => {
      setImage(currentIndex === imageUrls.length - 1 ? 0 : currentIndex + 1, 1);
    }, 4500);
  }

  card.startAutoSlide = () => {
    if (imageUrls.length > 1 && !autoTimer) {
      resetAutoSlide();
    }
  };

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
        if (!entry.isIntersecting) {
          return;
        }

        if (typeof entry.target.startAutoSlide === "function") {
          entry.target.startAutoSlide();
        }

        cardObserver.unobserve(entry.target);
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
    const button = event.target.closest(".cardMore[data-product-id]");

    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const selectedProduct = currentProducts.find((product) => product.id === button.dataset.productId);
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
