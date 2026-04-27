import { fetchProductsWithImages, formatPrice } from "./supabase.js";

const productGrid = document.querySelector("#productGrid");
const productStatus = document.querySelector("#productStatus");
const demoBanner = document.querySelector("#demoBanner");
const closeDemoBanner = document.querySelector("#closeDemoBanner");

let cardObserver = null;

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
  const price = createElement("div", "price", formatPrice(product));
  const dots = createElement("div", "dots");

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

  function setImage(nextIndex, direction = 1) {
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

  cardBody.append(title, description, price);

  if (imageUrls.length > 1) {
    renderDots();
    cardBody.appendChild(dots);
  }

  card.append(imageBox, cardBody);

  return card;
}

function renderProducts(products) {
  if (!productGrid) {
    return;
  }

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

loadProducts();
