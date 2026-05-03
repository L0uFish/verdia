import {
  createCheckoutSession,
  fetchProductsWithImages,
  fetchCheckoutStatus,
  formatPrice,
  getCurrentSession,
  onAuthStateChange,
  signInWithEmailPassword,
  signOutCurrentUser,
  signUpWithEmailPassword,
} from "./supabase.js?v=3.0";

const productGrid = document.querySelector("#productGrid");
const productStatus = document.querySelector("#productStatus");
const recentSoldStatus = document.querySelector("#recentSoldStatus");
const recentSoldGrid = document.querySelector("#recentSoldGrid");
const demoBanner = document.querySelector("#demoBanner");
const closeDemoBanner = document.querySelector("#closeDemoBanner");
const productModal = document.querySelector("#productModal");
const productModalClose = document.querySelector("#productModalClose");
const productModalTitle = document.querySelector("#productModalTitle");
const productModalPrice = document.querySelector("#productModalPrice");
const productModalDescription = document.querySelector("#productModalDescription");
const productModalAvailability = document.querySelector("#productModalAvailability");
const productModalAvailabilityNote = document.querySelector("#productModalAvailabilityNote");
const productModalGalleryMeta = document.querySelector("#productModalGalleryMeta");
const productModalPrimaryAction = document.querySelector("#productModalPrimaryAction");
const productModalSecondaryAction = document.querySelector("#productModalSecondaryAction");
const productModalActionFeedback = document.querySelector("#productModalActionFeedback");
const productModalImage = document.querySelector("#productModalImage");
const productModalPlaceholder = document.querySelector("#productModalPlaceholder");
const productModalDots = document.querySelector("#productModalDots");
const productModalPrevious = document.querySelector("#productModalPrev");
const productModalNext = document.querySelector("#productModalNext");
const contactForm = document.querySelector("#contactForm");
const contactFormStatus = document.querySelector("#contactFormStatus");
const accountButton = document.querySelector("#accountButton");
const accountModal = document.querySelector("#accountModal");
const accountModalClose = document.querySelector("#accountModalClose");
const accountModalTitle = document.querySelector("#accountModalTitle");
const accountModalIntro = document.querySelector("#accountModalIntro");
const accountModalStatus = document.querySelector("#accountModalStatus");
const accountLoggedOutView = document.querySelector("#accountLoggedOutView");
const accountLoggedInView = document.querySelector("#accountLoggedInView");
const accountAuthForm = document.querySelector("#accountAuthForm");
const accountEmailInput = document.querySelector("#accountEmailInput");
const accountPasswordInput = document.querySelector("#accountPasswordInput");
const accountSubmitButton = document.querySelector("#accountSubmitButton");
const accountModeHint = document.querySelector("#accountModeHint");
const accountModeLoginButton = document.querySelector("#accountModeLoginButton");
const accountModeRegisterButton = document.querySelector("#accountModeRegisterButton");
const accountEmailValue = document.querySelector("#accountEmailValue");
const accountLogoutButton = document.querySelector("#accountLogoutButton");
const cartButton = document.querySelector("#cartButton");
const cartCountBadge = document.querySelector("#cartCountBadge");
const cartDrawer = document.querySelector("#cartDrawer");
const cartDrawerClose = document.querySelector("#cartDrawerClose");
const cartStatus = document.querySelector("#cartStatus");
const cartEmptyState = document.querySelector("#cartEmptyState");
const cartContent = document.querySelector("#cartContent");
const cartItems = document.querySelector("#cartItems");
const cartSubtotal = document.querySelector("#cartSubtotal");
const cartCheckoutButton = document.querySelector("#cartCheckoutButton");
const checkoutModal = document.querySelector("#checkoutModal");
const checkoutCloseButton = document.querySelector("#checkoutCloseButton");
const checkoutEyebrow = document.querySelector("#checkoutEyebrow");
const checkoutTitle = document.querySelector("#checkoutTitle");
const checkoutIntro = document.querySelector("#checkoutIntro");
const checkoutStatus = document.querySelector("#checkoutStatus");
const checkoutFormStep = document.querySelector("#checkoutFormStep");
const checkoutPaymentStep = document.querySelector("#checkoutPaymentStep");
const checkoutResultStep = document.querySelector("#checkoutResultStep");
const checkoutForm = document.querySelector("#checkoutForm");
const checkoutNameInput = document.querySelector("#checkoutNameInput");
const checkoutEmailInput = document.querySelector("#checkoutEmailInput");
const checkoutPhoneInput = document.querySelector("#checkoutPhoneInput");
const checkoutNoteInput = document.querySelector("#checkoutNoteInput");
const checkoutContinueButton = document.querySelector("#checkoutContinueButton");
const checkoutBackToCartButton = document.querySelector("#checkoutBackToCartButton");
const checkoutBackToFormButton = document.querySelector("#checkoutBackToFormButton");
const checkoutPaymentName = document.querySelector("#checkoutPaymentName");
const checkoutPaymentEmail = document.querySelector("#checkoutPaymentEmail");
const checkoutPaymentPhone = document.querySelector("#checkoutPaymentPhone");
const checkoutPaymentNote = document.querySelector("#checkoutPaymentNote");
const checkoutPaymentMethods = document.querySelector("#checkoutPaymentMethods");
const checkoutPaymentProcessing = document.querySelector("#checkoutPaymentProcessing");
const checkoutPaymentMethodHint = document.querySelector("#checkoutPaymentMethodHint");
const checkoutPaymentPickupNote = document.querySelector("#checkoutPaymentPickupNote");
const checkoutPaymentSelectedMethod = document.querySelector("#checkoutPaymentSelectedMethod");
const checkoutProceedToMollieButton = document.querySelector("#checkoutProceedToMollieButton");
const checkoutSummaryCount = document.querySelector("#checkoutSummaryCount");
const checkoutSummaryItems = document.querySelector("#checkoutSummaryItems");
const checkoutSummarySubtotal = document.querySelector("#checkoutSummarySubtotal");
const checkoutResultBadge = document.querySelector("#checkoutResultBadge");
const checkoutResultHeading = document.querySelector("#checkoutResultHeading");
const checkoutResultMessage = document.querySelector("#checkoutResultMessage");
const checkoutResultOrderNumber = document.querySelector("#checkoutResultOrderNumber");
const checkoutResultCustomer = document.querySelector("#checkoutResultCustomer");
const checkoutResultPrimaryButton = document.querySelector("#checkoutResultPrimaryButton");
const checkoutResultSecondaryButton = document.querySelector("#checkoutResultSecondaryButton");
const storefrontLiveRegion = document.querySelector("#storefrontLiveRegion");

const CARD_SLIDE_INTERVAL = 3200;
const CARD_SLIDE_TRANSITION_MS = 820;
const CART_STORAGE_KEY = "verdia-cart-v1";
const PENDING_ORDER_STORAGE_KEY = "verdia-pending-order-v1";
const OVERLAY_CLOSE_DELAY_MS = 280;
const PAYMENT_METHOD_LABELS = {
  bancontact: "Bancontact",
  visa: "Visa",
  mastercard: "Mastercard",
  applepay: "Apple Pay",
};

let cardObserver = null;
let currentProducts = [];

const modalState = {
  product: null,
  imageUrls: [],
  currentIndex: 0,
};

const publicAuthState = {
  session: null,
  mode: "login",
  isSubmitting: false,
  lastFocusedElement: null,
};

const storefrontState = {
  collectionProducts: [],
  recentSoldProducts: [],
  cartItems: loadCartFromStorage(),
  cartLastFocusedElement: null,
  cartCloseTimer: 0,
  checkoutLastFocusedElement: null,
  checkoutCloseTimer: 0,
  checkout: createEmptyCheckoutState(),
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
  currentOpacity: 0.11,
  targetOpacity: 0.11,
  isCoarse: window.matchMedia ? window.matchMedia("(pointer: coarse)").matches : false,
  hasInteracted: false,
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

function createEmptyCheckoutState() {
  return {
    orderId: "",
    step: "form",
    form: {
      name: "",
      email: "",
      phone: "",
      note: "",
    },
    orderNumber: "",
    paymentMethod: "bancontact",
    itemsSnapshot: [],
    result: null,
    isProcessing: false,
  };
}

function loadCartFromStorage() {
  try {
    const rawValue = window.localStorage.getItem(CART_STORAGE_KEY);

    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .map((item) => {
        if (!item || typeof item !== "object" || !item.id) {
          return null;
        }

        return {
          id: String(item.id),
          name: item.name ? String(item.name) : "",
          price: item.price == null ? null : Number(item.price),
          price_label: item.price_label === "op_aanvraag" ? "op_aanvraag" : "vanaf",
          status: typeof item.status === "string" ? item.status : "available",
          image_url: item.image_url ? String(item.image_url) : "",
        };
      })
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function loadPendingOrderFromStorage() {
  try {
    const rawValue = window.localStorage.getItem(PENDING_ORDER_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);

    if (!parsedValue || typeof parsedValue !== "object" || !parsedValue.orderId) {
      return null;
    }

    return {
      cartItems: Array.isArray(parsedValue.cartItems)
        ? parsedValue.cartItems.filter((item) => item && typeof item === "object" && item.id)
        : [],
      createdAt: parsedValue.createdAt || "",
      customer: parsedValue.customer && typeof parsedValue.customer === "object"
        ? {
          email: parsedValue.customer.email ? String(parsedValue.customer.email) : "",
          name: parsedValue.customer.name ? String(parsedValue.customer.name) : "",
          note: parsedValue.customer.note ? String(parsedValue.customer.note) : "",
          phone: parsedValue.customer.phone ? String(parsedValue.customer.phone) : "",
        }
        : {
          email: "",
          name: "",
          note: "",
          phone: "",
        },
      orderId: String(parsedValue.orderId),
      paymentMethod: parsedValue.paymentMethod && PAYMENT_METHOD_LABELS[parsedValue.paymentMethod]
        ? parsedValue.paymentMethod
        : "bancontact",
    };
  } catch (error) {
    return null;
  }
}

function savePendingOrderToStorage(order) {
  try {
    window.localStorage.setItem(PENDING_ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch (error) {
    console.warn("Openstaande bestelling kon niet lokaal opgeslagen worden.", error);
  }
}

function clearPendingOrderFromStorage() {
  try {
    window.localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
  } catch (error) {
    console.warn("Openstaande bestelling kon niet lokaal verwijderd worden.", error);
  }
}

function saveCartToStorage() {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(storefrontState.cartItems));
  } catch (error) {
    console.warn("Cart kon niet in localStorage opgeslagen worden.", error);
  }
}

function announceLiveMessage(message) {
  if (!storefrontLiveRegion) {
    return;
  }

  storefrontLiveRegion.textContent = "";
  window.requestAnimationFrame(() => {
    storefrontLiveRegion.textContent = message;
  });
}

function getSignedInUserEmail() {
  return publicAuthState.session?.user?.email || "";
}

function prefillContactEmailFromSession() {
  if (!contactForm) {
    return;
  }

  const emailField = contactForm.elements.namedItem("email");
  const sessionEmail = getSignedInUserEmail();

  if (
    !sessionEmail
    || !emailField
    || typeof emailField.value !== "string"
    || emailField.value.trim()
  ) {
    return;
  }

  emailField.value = sessionEmail;
}

function getPrimaryImageUrl(product) {
  if (!product || !Array.isArray(product.images) || !product.images.length) {
    return "";
  }

  return product.images[0]?.image_url || "";
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
  document.documentElement.style.setProperty("--spotlight-x", `${spotlightState.currentX}px`);
  document.documentElement.style.setProperty("--spotlight-y", `${spotlightState.currentY}px`);
  document.documentElement.style.setProperty("--spotlight-opacity", spotlightState.currentOpacity.toFixed(3));
}

function clampSpotlightValue(value, max) {
  return Math.min(Math.max(value, 0), max);
}

function scheduleSpotlightFrame() {
  if (!spotlightState.rafId) {
    spotlightState.rafId = window.requestAnimationFrame(animateSpotlight);
  }
}

function animateSpotlight() {
  spotlightState.rafId = 0;

  spotlightState.currentX += (spotlightState.targetX - spotlightState.currentX) * 0.16;
  spotlightState.currentY += (spotlightState.targetY - spotlightState.currentY) * 0.16;
  spotlightState.currentOpacity += (spotlightState.targetOpacity - spotlightState.currentOpacity) * 0.12;

  setSpotlightVariables();

  const xDelta = Math.abs(spotlightState.targetX - spotlightState.currentX);
  const yDelta = Math.abs(spotlightState.targetY - spotlightState.currentY);
  const opacityDelta = Math.abs(spotlightState.targetOpacity - spotlightState.currentOpacity);

  if (xDelta > 0.35 || yDelta > 0.35 || opacityDelta > 0.002) {
    scheduleSpotlightFrame();
  }
}

function setInitialSpotlight(shouldAnimate = true) {
  spotlightState.targetX = window.innerWidth * 0.5;
  spotlightState.targetY = window.innerHeight * (spotlightState.isCoarse ? 0.24 : 0.2);
  spotlightState.targetOpacity = spotlightState.isCoarse ? 0.12 : 0.1;

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
  spotlightState.targetX = clampSpotlightValue(clientX, window.innerWidth);
  spotlightState.targetY = clampSpotlightValue(clientY, window.innerHeight);
  spotlightState.targetOpacity = opacity;
  spotlightState.hasInteracted = true;
  scheduleSpotlightFrame();
}

function easeSpotlightAtCurrentPosition(opacity) {
  spotlightState.targetOpacity = opacity;
  scheduleSpotlightFrame();
}

function clampSpotlightPosition() {
  spotlightState.targetX = clampSpotlightValue(spotlightState.targetX, window.innerWidth);
  spotlightState.targetY = clampSpotlightValue(spotlightState.targetY, window.innerHeight);
  spotlightState.currentX = clampSpotlightValue(spotlightState.currentX, window.innerWidth);
  spotlightState.currentY = clampSpotlightValue(spotlightState.currentY, window.innerHeight);
}

function initializeSpotlight() {
  if (prefersReducedMotion) {
    setInitialSpotlight(false);
    return;
  }

  setInitialSpotlight(false);

  function updateSpotlightFromPoint(clientX, clientY, pointerType = "mouse") {
    moveSpotlightTo(clientX, clientY, pointerType === "mouse" ? 0.16 : 0.18);
  }

  window.addEventListener("pointermove", (event) => {
    if (!event.isPrimary) {
      return;
    }

    updateSpotlightFromPoint(event.clientX, event.clientY, event.pointerType);
  });

  window.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary) {
      return;
    }

    updateSpotlightFromPoint(event.clientX, event.clientY, event.pointerType);
  });

  window.addEventListener("touchstart", (event) => {
    const touch = event.touches[0];

    if (touch) {
      updateSpotlightFromPoint(touch.clientX, touch.clientY, "touch");
    }
  }, { passive: true });

  window.addEventListener("touchmove", (event) => {
    const touch = event.touches[0];

    if (touch) {
      updateSpotlightFromPoint(touch.clientX, touch.clientY, "touch");
    }
  }, { passive: true });

  function releaseSpotlight() {
    easeSpotlightAtCurrentPosition(spotlightState.isCoarse ? 0.13 : 0.11);
  }

  window.addEventListener("pointerup", (event) => {
    if (event.isPrimary) {
      releaseSpotlight();
    }
  });
  window.addEventListener("pointercancel", releaseSpotlight);
  window.addEventListener("touchend", releaseSpotlight, { passive: true });
  window.addEventListener("touchcancel", releaseSpotlight, { passive: true });
  document.documentElement.addEventListener("mouseleave", () => {
    if (!spotlightState.isCoarse) {
      easeSpotlightAtCurrentPosition(0.1);
    }
  });

  window.addEventListener("resize", () => {
    spotlightState.isCoarse = window.matchMedia ? window.matchMedia("(pointer: coarse)").matches : false;
    clampSpotlightPosition();

    if (!spotlightState.hasInteracted) {
      setInitialSpotlight(false);
      return;
    }

    setSpotlightVariables();
  });
}

function setGridStatus(target, message, tone = "info") {
  if (!target) {
    return;
  }

  if (!message) {
    target.hidden = true;
    target.textContent = "";
    target.classList.remove("is-error");
    return;
  }

  target.hidden = false;
  target.textContent = message;
  target.classList.toggle("is-error", tone === "error");
}

function setProductStatus(message, tone = "info") {
  setGridStatus(productStatus, message, tone);
}

function setRecentSoldStatus(message, tone = "info") {
  setGridStatus(recentSoldStatus, message, tone);
}

function syncBodyModalState() {
  const hasOpenProductModal = productModal && !productModal.hidden;
  const hasOpenAccountModal = accountModal && !accountModal.hidden;
  const hasOpenCartDrawer = cartDrawer && !cartDrawer.hidden;
  const hasOpenCheckoutModal = checkoutModal && !checkoutModal.hidden;
  document.body.classList.toggle(
    "modalOpen",
    Boolean(hasOpenProductModal || hasOpenAccountModal || hasOpenCartDrawer || hasOpenCheckoutModal),
  );
}

function setAccountStatus(message, tone = "info") {
  if (!accountModalStatus) {
    return;
  }

  if (!message) {
    accountModalStatus.hidden = true;
    accountModalStatus.textContent = "";
    accountModalStatus.removeAttribute("data-tone");
    return;
  }

  accountModalStatus.hidden = false;
  accountModalStatus.textContent = message;
  accountModalStatus.dataset.tone = tone;
}

function setAccountMode(mode) {
  publicAuthState.mode = mode === "register" ? "register" : "login";

  if (!accountModeLoginButton || !accountModeRegisterButton || !accountSubmitButton || !accountModeHint) {
    return;
  }

  const isRegisterMode = publicAuthState.mode === "register";

  accountModeLoginButton.classList.toggle("is-active", !isRegisterMode);
  accountModeRegisterButton.classList.toggle("is-active", isRegisterMode);
  accountModeLoginButton.setAttribute("aria-pressed", String(!isRegisterMode));
  accountModeRegisterButton.setAttribute("aria-pressed", String(isRegisterMode));
  accountSubmitButton.textContent = publicAuthState.isSubmitting
    ? (isRegisterMode ? "Account aanmaken..." : "Inloggen...")
    : (isRegisterMode ? "Account aanmaken" : "Inloggen");
  accountPasswordInput.autocomplete = isRegisterMode ? "new-password" : "current-password";

  if (!publicAuthState.session?.user) {
    accountModalTitle.textContent = isRegisterMode ? "Account aanmaken" : "Inloggen";
    accountModalIntro.textContent = isRegisterMode
      ? "Maak vrijblijvend een account aan. Bestellingen verschijnen hier later."
      : "Log in of maak een account aan. Bestellingen verschijnen hier later.";
    accountModeHint.textContent = isRegisterMode
      ? "Afrekenen blijft later ook zonder account mogelijk."
      : "Gebruik je e-mailadres en wachtwoord. Afrekenen blijft later ook zonder account mogelijk.";
  }
}

function syncAccountControls() {
  const isBusy = publicAuthState.isSubmitting;
  const isLoggedIn = Boolean(publicAuthState.session?.user);

  if (accountButton) {
    accountButton.textContent = isLoggedIn ? "Mijn account" : "Inloggen";
    accountButton.setAttribute("aria-expanded", String(accountModal && !accountModal.hidden));
  }

  if (!accountAuthForm) {
    return;
  }

  accountEmailInput.disabled = isBusy || isLoggedIn;
  accountPasswordInput.disabled = isBusy || isLoggedIn;
  accountSubmitButton.disabled = isBusy || isLoggedIn;
  accountModeLoginButton.disabled = isBusy || isLoggedIn;
  accountModeRegisterButton.disabled = isBusy || isLoggedIn;
  accountLogoutButton.disabled = isBusy || !isLoggedIn;
  accountModalClose.disabled = false;

  setAccountMode(publicAuthState.mode);
}

function renderAccountView() {
  if (!accountLoggedOutView || !accountLoggedInView || !accountEmailValue) {
    return;
  }

  const session = publicAuthState.session;
  const isLoggedIn = Boolean(session?.user);

  accountLoggedOutView.hidden = isLoggedIn;
  accountLoggedInView.hidden = !isLoggedIn;

  if (isLoggedIn) {
    accountModalTitle.textContent = "Mijn account";
    accountModalIntro.textContent = "Bestellingen verschijnen hier later.";
    accountEmailValue.textContent = session.user.email || "";
  } else {
    accountEmailValue.textContent = "";
    setAccountMode(publicAuthState.mode);
  }

  syncAccountControls();
}

function focusAccountModalTarget() {
  if (!accountModal || accountModal.hidden) {
    return;
  }

  if (publicAuthState.session?.user) {
    accountLogoutButton.focus();
    return;
  }

  accountEmailInput.focus();
}

function openAccountModal() {
  if (!accountModal || !accountButton) {
    return;
  }

  if (!accountModal.hidden) {
    return;
  }

  publicAuthState.lastFocusedElement = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  renderAccountView();
  accountModal.hidden = false;
  accountButton.setAttribute("aria-expanded", "true");
  syncBodyModalState();
  window.requestAnimationFrame(focusAccountModalTarget);
}

function closeAccountModal({ restoreFocus = true } = {}) {
  if (!accountModal || accountModal.hidden) {
    return;
  }

  accountModal.hidden = true;
  if (accountButton) {
    accountButton.setAttribute("aria-expanded", "false");
  }
  syncBodyModalState();

  if (restoreFocus && publicAuthState.lastFocusedElement && typeof publicAuthState.lastFocusedElement.focus === "function") {
    publicAuthState.lastFocusedElement.focus();
  }

  publicAuthState.lastFocusedElement = null;
}

function applyPublicSession(session, statusMessage = "", statusTone = "info") {
  publicAuthState.session = session || null;

  if (!storefrontState.checkout.form.email && session?.user?.email) {
    storefrontState.checkout.form.email = session.user.email;
  }

  prefillContactEmailFromSession();
  renderAccountView();
  setAccountStatus(statusMessage, statusTone);

  if (checkoutModal && !checkoutModal.hidden) {
    renderCheckoutStep();
  }

  if (!accountModal.hidden) {
    window.requestAnimationFrame(focusAccountModalTarget);
  }
}

async function handleAccountAuthSubmit(event) {
  event.preventDefault();

  if (publicAuthState.isSubmitting) {
    return;
  }

  const email = accountEmailInput.value.trim();
  const password = accountPasswordInput.value;

  if (!email) {
    setAccountStatus("Vul je e-mailadres in.", "error");
    accountEmailInput.focus();
    return;
  }

  if (!password) {
    setAccountStatus("Vul je wachtwoord in.", "error");
    accountPasswordInput.focus();
    return;
  }

  publicAuthState.isSubmitting = true;
  setAccountStatus(
    publicAuthState.mode === "register" ? "Account wordt aangemaakt..." : "Inloggen...",
    "info",
  );
  syncAccountControls();

  try {
    if (publicAuthState.mode === "register") {
      const result = await signUpWithEmailPassword(email, password);

      if (result.session) {
        applyPublicSession(result.session, "Je account is aangemaakt en je bent aangemeld.", "success");
      } else {
        setAccountMode("login");
        accountPasswordInput.value = "";
        setAccountStatus(
          "Je account is aangemaakt. Controleer je e-mail om je account te bevestigen.",
          "success",
        );
      }
    } else {
      const session = await signInWithEmailPassword(email, password);
      applyPublicSession(session, "", "info");
      accountPasswordInput.value = "";
    }
  } catch (error) {
    setAccountStatus(error.message || "Aanmelden mislukte.", "error");
  } finally {
    publicAuthState.isSubmitting = false;
    syncAccountControls();
  }
}

async function handleAccountLogout() {
  if (publicAuthState.isSubmitting) {
    return;
  }

  publicAuthState.isSubmitting = true;
  setAccountStatus("Uitloggen...", "info");
  syncAccountControls();

  try {
    await signOutCurrentUser();
    applyPublicSession(null, "Je bent uitgelogd.", "info");
    accountPasswordInput.value = "";
  } catch (error) {
    setAccountStatus(error.message || "Uitloggen mislukte.", "error");
  } finally {
    publicAuthState.isSubmitting = false;
    syncAccountControls();
  }
}

async function initializePublicAuth() {
  renderAccountView();

  onAuthStateChange((session) => {
    applyPublicSession(session, "", "info");
  });

  try {
    const session = await getCurrentSession();
    applyPublicSession(session, "", "info");
  } catch (error) {
    console.error(error);
    applyPublicSession(null, "", "info");
  }
}

function formatCurrencyAmount(value) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function setElementStatus(target, message, tone = "info") {
  if (!target) {
    return;
  }

  if (!message) {
    target.hidden = true;
    target.textContent = "";
    target.removeAttribute("data-tone");
    return;
  }

  target.hidden = false;
  target.textContent = message;
  target.dataset.tone = tone;
}

function setProductModalActionFeedback(message, tone = "info") {
  setElementStatus(productModalActionFeedback, message, tone);
}

function setCartStatus(message, tone = "info") {
  setElementStatus(cartStatus, message, tone);
}

function setCheckoutStatus(message, tone = "info") {
  setElementStatus(checkoutStatus, message, tone);
}

function getProductImageUrls(product) {
  if (!product || !Array.isArray(product.images)) {
    return [];
  }

  return product.images.map((image) => image.image_url).filter(Boolean);
}

function isAvailableProduct(product) {
  return product?.status === "available";
}

function isReservedProduct(product) {
  return product?.status === "reserved";
}

function isSoldProduct(product) {
  return product?.status === "sold";
}

function isPriceOnRequest(product) {
  return product?.price_label === "op_aanvraag";
}

function isCollectionProduct(product) {
  return isAvailableProduct(product) || isReservedProduct(product);
}

function isProductPurchasable(product) {
  return isAvailableProduct(product) && !isPriceOnRequest(product);
}

function syncStorefrontProductBuckets(products = currentProducts) {
  storefrontState.collectionProducts = products.filter((product) => isCollectionProduct(product));
  storefrontState.recentSoldProducts = sortRecentSoldProducts(
    products.filter((product) => isSoldProduct(product)),
  ).slice(0, 5);
}

function syncStorefrontSectionStatus() {
  if (storefrontState.collectionProducts.length) {
    setProductStatus("");
  } else {
    setProductStatus("Er staan momenteel nog geen stukken in de collectie.");
  }

  if (storefrontState.recentSoldProducts.length) {
    setRecentSoldStatus("");
  } else {
    setRecentSoldStatus("Recent verkochte stukken verschijnen hier zodra ze gemarkeerd zijn als verkocht.");
  }
}

function getProductById(productId) {
  return currentProducts.find((product) => product.id === productId) || null;
}

function isProductInCart(productId) {
  return storefrontState.cartItems.some((item) => item.id === productId);
}

function createCartItemSnapshot(product) {
  return {
    id: product.id,
    name: product.name,
    price: product.price == null ? null : Number(product.price),
    price_label: product.price_label === "op_aanvraag" ? "op_aanvraag" : "vanaf",
    status: product.status,
    image_url: getPrimaryImageUrl(product),
  };
}

function getCartSubtotal(items = storefrontState.cartItems) {
  return items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
}

function removeCartItemsById(productIds) {
  const productIdSet = new Set(productIds.filter(Boolean));

  if (!productIdSet.size) {
    return;
  }

  storefrontState.cartItems = storefrontState.cartItems.filter((item) => !productIdSet.has(item.id));
  saveCartToStorage();
}

function sortRecentSoldProducts(products) {
  return products.slice().sort((left, right) => {
    const leftTime = left.sold_at ? new Date(left.sold_at).getTime() : 0;
    const rightTime = right.sold_at ? new Date(right.sold_at).getTime() : 0;

    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return (right.sort_order || 0) - (left.sort_order || 0);
  });
}

function getProductAvailabilityMeta(product, options = {}) {
  const inCart = options.inCart ?? isProductInCart(product.id);

  if (isSoldProduct(product)) {
    return {
      badgeLabel: "Verkocht",
      badgeTone: "sold",
      note: "Dit unieke stuk is verkocht en blijft nog even zichtbaar als recente realisatie.",
      primaryLabel: "",
      primaryAction: "none",
      primaryDisabled: true,
      showPrimaryAction: false,
    };
  }

  if (isReservedProduct(product)) {
    return {
      badgeLabel: "Gereserveerd",
      badgeTone: "reserved",
      note: "Dit stuk is tijdelijk vastgezet en kan momenteel niet opnieuw besteld worden.",
      primaryLabel: "Gereserveerd",
      primaryAction: "none",
      primaryDisabled: true,
      showPrimaryAction: true,
    };
  }

  if (isPriceOnRequest(product)) {
    return {
      badgeLabel: "Prijs op aanvraag",
      badgeTone: "request",
      note: "Voor dit stuk bespreken we prijs en afwerking persoonlijk. Online bestellen is hier niet beschikbaar.",
      primaryLabel: "Prijs aanvragen",
      primaryAction: "request",
      primaryDisabled: false,
      showPrimaryAction: true,
    };
  }

  if (inCart) {
    return {
      badgeLabel: "Beschikbaar",
      badgeTone: "available",
      note: "Dit stuk zit al in je mandje en wacht op je afhaalbestelling.",
      primaryLabel: "In mandje",
      primaryAction: "none",
      primaryDisabled: true,
      showPrimaryAction: true,
    };
  }

  return {
    badgeLabel: "Beschikbaar",
    badgeTone: "available",
    note: "Direct beschikbaar voor afhaling na betaling. Elk stuk is uniek en slechts eenmalig verkrijgbaar.",
    primaryLabel: "Toevoegen",
    primaryAction: "add",
    primaryDisabled: false,
    showPrimaryAction: true,
  };
}

function createAvailabilityBadge(label, tone) {
  const badge = createElement("span", `availabilityBadge is-${tone}`, label);
  return badge;
}

function createSkeletonCard() {
  const skeletonCard = createElement("article", "card cardSkeleton");
  const imageBox = createElement("div", "cardImage");
  imageBox.appendChild(createElement("div", "skeletonBlock skeletonImage"));

  const body = createElement("div", "cardBody");
  body.append(
    createElement("div", "skeletonBlock skeletonLine large"),
    createElement("div", "skeletonBlock skeletonLine"),
    createElement("div", "skeletonBlock skeletonLine medium"),
    createElement("div", "skeletonBlock skeletonLine short"),
  );

  skeletonCard.append(imageBox, body);
  return skeletonCard;
}

function renderSkeletonCards(target, count) {
  if (!target) {
    return;
  }

  const fragment = document.createDocumentFragment();

  for (let index = 0; index < count; index += 1) {
    fragment.appendChild(createSkeletonCard());
  }

  target.replaceChildren(fragment);
}

function stopAllCardObservers() {
  if (cardObserver) {
    cardObserver.disconnect();
    cardObserver = null;
  }

  document.querySelectorAll(".card").forEach((card) => {
    if (typeof card.stopAutoSlide === "function") {
      card.stopAutoSlide();
    }
  });
}

function attachCardObserver() {
  stopAllCardObservers();

  const cards = document.querySelectorAll(".card[data-slider-enabled='true']");

  if (!cards.length) {
    return;
  }

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

  cards.forEach((card) => {
    cardObserver.observe(card);
  });
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

  if (productModalGalleryMeta) {
    if (!hasImages) {
      productModalGalleryMeta.hidden = true;
      productModalGalleryMeta.textContent = "";
    } else {
      productModalGalleryMeta.hidden = false;
      productModalGalleryMeta.textContent = `${modalState.currentIndex + 1} / ${modalState.imageUrls.length}`;
    }
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

function requestPriceForProduct(product, options = {}) {
  if (!product || !contactForm) {
    return;
  }

  const messageField = contactForm.elements.namedItem("message");
  const requestTypeField = contactForm.elements.namedItem("requestType");
  const focusTarget = contactForm.elements.namedItem("name") || messageField;

  prefillContactEmailFromSession();

  if (messageField && typeof messageField.value === "string") {
    messageField.value = `Ik ontvang graag meer informatie en de prijs voor "${product.name}".`;
  }

  if (requestTypeField && typeof requestTypeField.value === "string" && !requestTypeField.value) {
    requestTypeField.value = "Persoonlijk";
  }

  if (contactFormStatus) {
    contactFormStatus.textContent =
      `Je aanvraag voor ${product.name} staat als demo klaar in het contactformulier.`;
  }

  if (options.closeProductFirst) {
    closeProductModal();
  }

  if (options.closeCartFirst) {
    closeCartDrawer({ restoreFocus: false });
  }

  document.querySelector("#contact")?.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "start",
  });

  window.setTimeout(() => {
    if (focusTarget && typeof focusTarget.focus === "function") {
      focusTarget.focus();
    }
  }, prefersReducedMotion ? 0 : 240);

  announceLiveMessage(`Aanvraag voor ${product.name} staat klaar in het contactformulier.`);
}

function closeProductModal() {
  if (!productModal || productModal.hidden) {
    return;
  }

  productModal.hidden = true;
  modalState.product = null;
  modalState.imageUrls = [];
  modalState.currentIndex = 0;
  setProductModalActionFeedback("", "info");
  syncBodyModalState();
}

function renderProductModalDetails(product) {
  if (
    !product ||
    !productModalTitle ||
    !productModalPrice ||
    !productModalDescription ||
    !productModalAvailability ||
    !productModalAvailabilityNote ||
    !productModalPrimaryAction ||
    !productModalSecondaryAction
  ) {
    return;
  }

  const meta = getProductAvailabilityMeta(product);
  productModalTitle.textContent = product.name;
  productModalPrice.textContent = formatPrice(product);
  productModalDescription.textContent = product.description || "Beschrijving volgt binnenkort.";
  productModalAvailability.textContent = meta.badgeLabel;
  productModalAvailability.className = `availabilityBadge is-${meta.badgeTone}`;
  productModalAvailabilityNote.textContent = meta.note;

  productModalPrimaryAction.hidden = !meta.showPrimaryAction;
  productModalPrimaryAction.disabled = meta.primaryDisabled;
  productModalPrimaryAction.dataset.action = meta.primaryAction;
  productModalPrimaryAction.textContent = meta.primaryLabel;
  productModalPrimaryAction.className = meta.primaryAction === "add" && !meta.primaryDisabled
    ? "btn primary"
    : "btn ghost";

  productModalSecondaryAction.textContent = isSoldProduct(product)
    ? "Vraag gelijkaardig stuk"
    : (isPriceOnRequest(product) ? "Prijs aanvragen" : "Contact");
}

function openProductModal(product) {
  if (!productModal || !product) {
    return;
  }

  modalState.product = product;
  modalState.imageUrls = getProductImageUrls(product);
  modalState.currentIndex = 0;

  renderProductModalDetails(product);
  renderModalImage();
  setProductModalActionFeedback("", "info");

  productModal.hidden = false;
  syncBodyModalState();

  if (productModalClose) {
    productModalClose.focus();
  }
}

function createCard(product, options = {}) {
  const imageUrls = getProductImageUrls(product);
  const surface = options.surface || "collection";
  const meta = getProductAvailabilityMeta(product, {
    inCart: isProductInCart(product.id),
  });
  let currentIndex = 0;
  let autoTimer = null;
  let isVisible = false;
  let isTransitioning = false;
  let visibleLayer = 0;
  let queuedIndex = null;

  const card = createElement("article", "card");
  const imageBox = createElement("div", "cardImage");
  const badgeWrap = createElement("div", "cardBadgeWrap");
  const cardBody = createElement("div", "cardBody");
  const metaRow = createElement("div", "cardMetaRow");
  const title = createElement("h3", "", product.name);
  const description = createElement(
    "p",
    "cardDescription",
    product.description || "Beschrijving volgt binnenkort.",
  );
  const footer = createElement("div", "cardFooter");
  const dots = createElement("div", "dots");
  const priceRow = createElement("div", "cardPriceRow");
  const priceMeta = createElement("div", "cardPriceMeta");
  const priceLabel = createElement("span", "cardPriceLabel", "Prijs");
  const price = createElement("div", "price", formatPrice(product));
  const actionRow = createElement("div", "cardActionRow");
  const detailsButton = createElement("button", "cardMore", "Bekijk");
  let slideLayers = [];

  card.dataset.productId = product.id;

  if (surface === "sold") {
    card.classList.add("is-sold-surface");
  }

  detailsButton.type = "button";
  detailsButton.setAttribute("aria-label", `Bekijk details van ${product.name}`);

  badgeWrap.appendChild(createAvailabilityBadge(meta.badgeLabel, meta.badgeTone));

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

  imageBox.appendChild(badgeWrap);

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
    card.dataset.sliderEnabled = "true";
  }

  card.startAutoSlide = () => {
    isVisible = true;
    startAutoSlide();
  };

  card.stopAutoSlide = () => {
    isVisible = false;
    stopAutoSlide();
  };

  detailsButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openProductModal(product);
  });

  actionRow.appendChild(detailsButton);

  if (meta.showPrimaryAction) {
    const primaryButton = createElement(
      "button",
      `cardActionButton ${meta.primaryAction === "add" && !meta.primaryDisabled ? "is-primary" : ""} ${meta.primaryAction === "request" ? "is-request" : ""}`.trim(),
      meta.primaryLabel,
    );
    primaryButton.type = "button";
    primaryButton.disabled = meta.primaryDisabled;

    primaryButton.addEventListener("click", (event) => {
      event.stopPropagation();

      if (meta.primaryAction === "add") {
        addProductToCart(product, { openDrawer: true });
        return;
      }

      if (meta.primaryAction === "request") {
        requestPriceForProduct(product);
      }
    });

    actionRow.appendChild(primaryButton);
  } else {
    actionRow.classList.add("is-single");
  }

  priceMeta.append(priceLabel, price);
  priceRow.appendChild(priceMeta);
  footer.append(priceRow, actionRow);
  metaRow.appendChild(title);
  cardBody.append(metaRow, description, footer);
  card.append(imageBox, cardBody);

  card.addEventListener("click", (event) => {
    if (event.target.closest("button")) {
      return;
    }

    openProductModal(product);
  });

  return card;
}

function renderProductGrid(target, products, options = {}) {
  if (!target) {
    return;
  }

  target.replaceChildren();

  if (!products.length) {
    return;
  }

  const fragment = document.createDocumentFragment();

  products.forEach((product) => {
    fragment.appendChild(createCard(product, options));
  });

  target.appendChild(fragment);
}

function cartItemsAreEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => {
    const compare = right[index];
    return compare
      && item.id === compare.id
      && item.name === compare.name
      && item.price === compare.price
      && item.price_label === compare.price_label
      && item.status === compare.status
      && item.image_url === compare.image_url;
  });
}

function reconcileCartWithCatalog() {
  const nextItems = [];
  let removedCount = 0;

  storefrontState.cartItems.forEach((item) => {
    const latestProduct = getProductById(item.id);

    if (!latestProduct || !isProductPurchasable(latestProduct)) {
      removedCount += 1;
      return;
    }

    nextItems.push(createCartItemSnapshot(latestProduct));
  });

  if (!cartItemsAreEqual(storefrontState.cartItems, nextItems)) {
    storefrontState.cartItems = nextItems;
    saveCartToStorage();
  }

  return removedCount;
}

function getCheckoutItemsSnapshot() {
  if (storefrontState.checkout.itemsSnapshot.length) {
    return storefrontState.checkout.itemsSnapshot;
  }

  return storefrontState.cartItems;
}

function createCheckoutSummaryItem(item) {
  const wrapper = createElement("div", "checkoutSummaryItem");
  const imageBox = createElement("div", "checkoutSummaryItemImage");
  const meta = createElement("div", "checkoutSummaryItemMeta");
  const title = createElement("strong", "", item.name);
  const price = createElement("span", "", formatPrice(item));
  const imageUrl = item.image_url;

  if (imageUrl) {
    imageBox.appendChild(createSlideImage(imageUrl, item.name));
  } else {
    const placeholder = createElement("div", "cardPlaceholder");
    placeholder.appendChild(createElement("span", "", "Geen foto"));
    imageBox.appendChild(placeholder);
  }

  meta.append(title, price);
  wrapper.append(imageBox, meta);
  return wrapper;
}

function renderCheckoutSummary() {
  if (!checkoutSummaryItems || !checkoutSummaryCount || !checkoutSummarySubtotal) {
    return;
  }

  const items = getCheckoutItemsSnapshot();
  checkoutSummaryItems.replaceChildren();

  if (items.length) {
    const fragment = document.createDocumentFragment();

    items.forEach((item) => {
      fragment.appendChild(createCheckoutSummaryItem(item));
    });

    checkoutSummaryItems.appendChild(fragment);
  }

  checkoutSummaryCount.textContent = `${items.length} ${items.length === 1 ? "stuk" : "stukken"}`;
  checkoutSummarySubtotal.textContent = formatCurrencyAmount(getCartSubtotal(items));
}

function renderCart() {
  if (!cartItems || !cartEmptyState || !cartContent || !cartSubtotal) {
    return;
  }

  cartItems.replaceChildren();

  const hasItems = storefrontState.cartItems.length > 0;
  cartEmptyState.hidden = hasItems;
  cartContent.hidden = !hasItems;

  if (cartCountBadge) {
    cartCountBadge.hidden = !hasItems;
    cartCountBadge.textContent = String(storefrontState.cartItems.length);
  }

  if (cartCheckoutButton) {
    cartCheckoutButton.disabled = !hasItems;
  }

  if (!hasItems) {
    cartSubtotal.textContent = formatCurrencyAmount(0);
    renderCheckoutSummary();
    return;
  }

  const fragment = document.createDocumentFragment();

  storefrontState.cartItems.forEach((item) => {
    const row = createElement("div", "cartItem");
    const imageBox = createElement("div", "cartItemImage");
    const body = createElement("div", "cartItemBody");
    const summary = createElement("div", "cartItemSummary");
    const footer = createElement("div", "cartItemFooter");
    const title = createElement("h3", "", item.name);
    const removeButton = createElement("button", "cartItemRemove", "Verwijder");
    const price = createElement("strong", "cartItemPrice", formatPrice(item));
    const note = createElement("p", "cartItemNote", "Uniek stuk · Afhaling op afspraak");

    removeButton.type = "button";
    removeButton.addEventListener("click", () => {
      removeProductFromCart(item.id);
    });

    if (item.image_url) {
      imageBox.appendChild(createSlideImage(item.image_url, item.name));
    } else {
      const placeholder = createElement("div", "cardPlaceholder");
      placeholder.appendChild(createElement("span", "", "Geen foto"));
      imageBox.appendChild(placeholder);
    }

    summary.append(title, note);
    footer.append(price, removeButton);
    body.append(summary, footer);
    row.append(imageBox, body);
    fragment.appendChild(row);
  });

  cartItems.appendChild(fragment);
  cartSubtotal.textContent = formatCurrencyAmount(getCartSubtotal());
  renderCheckoutSummary();
}

function renderStorefrontSections() {
  renderProductGrid(productGrid, storefrontState.collectionProducts, { surface: "collection" });
  renderProductGrid(recentSoldGrid, storefrontState.recentSoldProducts, { surface: "sold" });
  attachCardObserver();
  renderCart();
}

function addProductToCart(product, options = {}) {
  if (!product) {
    return;
  }

  if (!isProductPurchasable(product)) {
    const message = isPriceOnRequest(product)
      ? "Voor dit product kan je online geen bestelling plaatsen. Vraag eenvoudig de prijs aan."
      : "Dit product is momenteel niet beschikbaar voor online reservering.";
    setCartStatus(message, "error");
    announceLiveMessage(message);
    return;
  }

  if (isProductInCart(product.id)) {
    setCartStatus(`${product.name} zit al in je mandje.`, "info");

    if (options.openDrawer) {
      closeProductModal();
      openCartDrawer();
    }

    announceLiveMessage(`${product.name} zit al in je mandje.`);
    return;
  }

  storefrontState.cartItems = [...storefrontState.cartItems, createCartItemSnapshot(product)];
  saveCartToStorage();
  renderStorefrontSections();
  setCartStatus(`${product.name} werd toegevoegd aan je mandje.`, "success");
  setProductModalActionFeedback(`${product.name} werd toegevoegd aan je mandje.`, "success");
  announceLiveMessage(`${product.name} werd toegevoegd aan je mandje.`);

  if (options.openDrawer) {
    closeProductModal();
    openCartDrawer();
  }
}

function removeProductFromCart(productId) {
  const existingItem = storefrontState.cartItems.find((item) => item.id === productId);

  storefrontState.cartItems = storefrontState.cartItems.filter((item) => item.id !== productId);
  saveCartToStorage();
  renderStorefrontSections();

  if (existingItem) {
    setCartStatus(`${existingItem.name} werd uit je mandje verwijderd.`, "info");
    announceLiveMessage(`${existingItem.name} werd verwijderd uit je mandje.`);
  }
}

function focusCheckoutTarget() {
  if (!checkoutModal || checkoutModal.hidden) {
    return;
  }

  if (storefrontState.checkout.step === "payment") {
    const selectedMethodButton = checkoutPaymentMethods?.querySelector(".paymentMethodButton.is-active");
    if (selectedMethodButton) {
      selectedMethodButton.focus();
      return;
    }
  }

  if (storefrontState.checkout.step === "result" && checkoutResultPrimaryButton) {
    checkoutResultPrimaryButton.focus();
    return;
  }

  if (checkoutNameInput) {
    if (!checkoutNameInput.value.trim()) {
      checkoutNameInput.focus();
      return;
    }
  }

  checkoutEmailInput?.focus();
}

function openCartDrawer() {
  if (!cartDrawer) {
    return;
  }

  window.clearTimeout(storefrontState.cartCloseTimer);
  storefrontState.cartLastFocusedElement = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  closeAccountModal({ restoreFocus: false });
  renderCart();

  cartDrawer.hidden = false;
  cartDrawer.dataset.open = "false";

  if (cartButton) {
    cartButton.setAttribute("aria-expanded", "true");
  }

  syncBodyModalState();

  window.requestAnimationFrame(() => {
    cartDrawer.dataset.open = "true";
    cartDrawerClose?.focus();
  });
}

function closeCartDrawer({ restoreFocus = true } = {}) {
  if (!cartDrawer || cartDrawer.hidden) {
    return;
  }

  cartDrawer.dataset.open = "false";

  if (cartButton) {
    cartButton.setAttribute("aria-expanded", "false");
  }

  window.clearTimeout(storefrontState.cartCloseTimer);
  storefrontState.cartCloseTimer = window.setTimeout(() => {
    cartDrawer.hidden = true;
    syncBodyModalState();

    if (restoreFocus && storefrontState.cartLastFocusedElement && typeof storefrontState.cartLastFocusedElement.focus === "function") {
      storefrontState.cartLastFocusedElement.focus();
    }

    storefrontState.cartLastFocusedElement = null;
  }, OVERLAY_CLOSE_DELAY_MS);
}

function renderPaymentMethods() {
  if (!checkoutPaymentMethods) {
    return;
  }

  checkoutPaymentMethods.replaceChildren();

  const fragment = document.createDocumentFragment();

  Object.entries(PAYMENT_METHOD_LABELS).forEach(([methodKey, label]) => {
    const button = createElement(
      "button",
      `paymentMethodButton ${storefrontState.checkout.paymentMethod === methodKey ? "is-active" : ""}`.trim(),
    );
    const brand = createElement("span", "paymentMethodBrand", label);
    const descriptionText = methodKey === "bancontact"
      ? "Belgische betaling via Mollie test checkout"
      : (methodKey === "applepay" ? "Walletbetaling via Mollie test checkout" : "Kaartbetaling via Mollie test checkout");
    const description = createElement("span", "", descriptionText);

    button.type = "button";
    button.disabled = storefrontState.checkout.isProcessing;
    button.dataset.method = methodKey;
    button.append(brand, description);
    button.addEventListener("click", () => {
      storefrontState.checkout.paymentMethod = methodKey;
      renderCheckoutStep();
    });
    fragment.appendChild(button);
  });

  checkoutPaymentMethods.appendChild(fragment);
}

function renderPaymentPickupNote() {
  if (!checkoutPaymentPickupNote || !checkoutPaymentSelectedMethod) {
    return;
  }

  const methodLabel = PAYMENT_METHOD_LABELS[storefrontState.checkout.paymentMethod];

  if (storefrontState.checkout.step !== "payment" || !methodLabel) {
    checkoutPaymentPickupNote.hidden = true;
    checkoutPaymentSelectedMethod.textContent = "";
    return;
  }

  checkoutPaymentPickupNote.hidden = false;
  checkoutPaymentSelectedMethod.textContent = `Geselecteerde methode: ${methodLabel}`;
}

function setCheckoutHeaderCopy(eyebrow, title, intro) {
  if (checkoutEyebrow) {
    checkoutEyebrow.textContent = eyebrow;
  }

  if (checkoutTitle) {
    checkoutTitle.textContent = title;
  }

  if (checkoutIntro) {
    checkoutIntro.textContent = intro;
  }
}

function renderCheckoutCustomerSummary() {
  if (
    !checkoutPaymentName
    || !checkoutPaymentEmail
    || !checkoutPaymentPhone
    || !checkoutPaymentNote
  ) {
    return;
  }

  const { name, email, phone, note } = storefrontState.checkout.form;
  const noteValue = typeof note === "string" ? note.trim() : "";
  const normalizedNote = noteValue || "Geen voorkeur opgegeven.";

  checkoutPaymentName.textContent = name || "-";
  checkoutPaymentEmail.textContent = email || "-";
  checkoutPaymentPhone.textContent = phone || "-";
  checkoutPaymentNote.textContent = normalizedNote;
  checkoutPaymentNote.dataset.empty = noteValue ? "false" : "true";
}

function renderCheckoutResult() {
  if (
    !checkoutResultBadge ||
    !checkoutResultHeading ||
    !checkoutResultMessage ||
    !checkoutResultOrderNumber ||
    !checkoutResultCustomer ||
    !checkoutResultPrimaryButton ||
    !checkoutResultSecondaryButton
  ) {
    return;
  }

  const outcome = storefrontState.checkout.result;
  const customerSummary = [
    storefrontState.checkout.form.name,
    storefrontState.checkout.form.email,
  ].filter(Boolean).join(" · ");

  let badgeClass = "is-warning";
  let badgeLabel = "In behandeling";
  let heading = "Bestelling bijgewerkt";
  let message = "";
  let primaryLabel = "Status vernieuwen";
  let primaryAction = "refresh-status";
  let secondaryLabel = "";
  let secondaryAction = "";

  if (outcome === "success") {
    badgeClass = "is-success";
    badgeLabel = "Betaald";
    heading = "Bedankt voor je bestelling";
    message = "Je betaling is bevestigd in testmodus. Na betaling nemen we contact op om het afhaalmoment af te spreken.";
    primaryLabel = "Terug naar collectie";
    primaryAction = "close-collection";
  } else if (outcome === "failed") {
    badgeClass = "is-error";
    badgeLabel = "Niet geslaagd";
    heading = "Betaling niet bevestigd";
    message = "De betaling werd niet bevestigd. Als het stuk nog beschikbaar is, kan je opnieuw afrekenen vanuit je mandje.";
    primaryLabel = "Terug naar mandje";
    primaryAction = "back-to-cart";
    secondaryLabel = "Terug naar collectie";
    secondaryAction = "close-collection";
  } else if (outcome === "cancelled") {
    badgeClass = "is-warning";
    badgeLabel = "Geannuleerd";
    heading = "Betaling geannuleerd";
    message = "Je betaling werd afgebroken. Als het stuk nog beschikbaar is, kan je later opnieuw proberen vanuit je mandje.";
    primaryLabel = "Terug naar mandje";
    primaryAction = "back-to-cart";
    secondaryLabel = "Terug naar collectie";
    secondaryAction = "close-collection";
  } else if (outcome === "expired") {
    badgeClass = "is-warning";
    badgeLabel = "Verlopen";
    heading = "Betaalsessie verlopen";
    message = "De reservering of betaalsessie is verlopen. Als het stuk nog beschikbaar is, kan je opnieuw afrekenen.";
    primaryLabel = "Terug naar mandje";
    primaryAction = "back-to-cart";
    secondaryLabel = "Terug naar collectie";
    secondaryAction = "close-collection";
  } else if (outcome === "pending") {
    badgeClass = "is-warning";
    badgeLabel = "In behandeling";
    heading = "Betaling wordt nog gecontroleerd";
    message = "Mollie heeft nog geen definitieve betaalstatus teruggegeven. Vernieuw de status binnen enkele ogenblikken.";
  }

  checkoutResultBadge.className = `checkoutResultBadge ${badgeClass}`;
  checkoutResultBadge.textContent = badgeLabel;
  checkoutResultHeading.textContent = heading;
  checkoutResultMessage.textContent = message;
  checkoutResultOrderNumber.textContent = storefrontState.checkout.orderNumber || "-";
  checkoutResultCustomer.textContent = customerSummary || "-";
  checkoutResultPrimaryButton.textContent = primaryLabel;
  checkoutResultPrimaryButton.dataset.action = primaryAction;
  checkoutResultSecondaryButton.hidden = !secondaryLabel;
  checkoutResultSecondaryButton.textContent = secondaryLabel;
  checkoutResultSecondaryButton.dataset.action = secondaryAction;
}

function renderCheckoutStep() {
  if (
    !checkoutFormStep ||
    !checkoutPaymentStep ||
    !checkoutResultStep ||
    !checkoutEyebrow ||
    !checkoutTitle ||
    !checkoutIntro
  ) {
    return;
  }

  const { step, isProcessing } = storefrontState.checkout;
  const items = getCheckoutItemsSnapshot();

  checkoutFormStep.hidden = step !== "form";
  checkoutPaymentStep.hidden = step !== "payment";
  checkoutResultStep.hidden = step !== "result";

  if (checkoutNameInput) {
    checkoutNameInput.value = storefrontState.checkout.form.name;
  }

  if (checkoutEmailInput) {
    checkoutEmailInput.value = storefrontState.checkout.form.email;
  }

  if (checkoutPhoneInput) {
    checkoutPhoneInput.value = storefrontState.checkout.form.phone;
  }

  if (checkoutNoteInput) {
    checkoutNoteInput.value = storefrontState.checkout.form.note;
  }

  if (checkoutContinueButton) {
    checkoutContinueButton.disabled = !items.length;
  }

  if (checkoutBackToCartButton) {
    checkoutBackToCartButton.disabled = isProcessing;
  }

  if (checkoutBackToFormButton) {
    checkoutBackToFormButton.disabled = isProcessing;
  }

  if (checkoutCloseButton) {
    checkoutCloseButton.disabled = isProcessing;
  }

  if (checkoutProceedToMollieButton) {
    checkoutProceedToMollieButton.disabled = isProcessing || !items.length;
    checkoutProceedToMollieButton.textContent = isProcessing
      ? "Betaalpagina voorbereiden..."
      : "Verder naar Mollie";
  }

  if (checkoutPaymentProcessing) {
    checkoutPaymentProcessing.hidden = !isProcessing;
  }

  if (checkoutPaymentMethodHint) {
    const methodLabel = PAYMENT_METHOD_LABELS[storefrontState.checkout.paymentMethod] || "betaalmethode";
    checkoutPaymentMethodHint.textContent = isProcessing
      ? `Je ${methodLabel}-betaling wordt klaargezet bij Mollie.`
      : `Je kiest voor ${methodLabel}. Je wordt zo doorgestuurd naar de beveiligde Mollie test checkout.`;
  }

  renderCheckoutCustomerSummary();
  renderPaymentPickupNote();
  renderCheckoutSummary();

  if (step === "form") {
    setCheckoutHeaderCopy(
      "Bestelling",
      "Afrekenen",
      "Vul je gegevens in voor je afhaalbestelling. De betaling verloopt daarna via Mollie test mode.",
    );
  } else if (step === "payment") {
    setCheckoutHeaderCopy(
      "Betaling",
      "Betalen via Mollie",
      "Kies je betaalmethode. Daarna sturen we je door naar de beveiligde Mollie test checkout.",
    );
    renderPaymentMethods();
  } else {
    setCheckoutHeaderCopy(
      "Betaling",
      "Betalingsresultaat",
      "We hebben de actuele betaalstatus van je bestelling opgehaald.",
    );
    renderCheckoutResult();
  }
}

function prepareCheckoutFromCart() {
  const previousForm = storefrontState.checkout.form || createEmptyCheckoutState().form;
  const sessionEmail = getSignedInUserEmail();

  storefrontState.checkout = {
    ...createEmptyCheckoutState(),
    form: {
      name: previousForm.name || "",
      email: previousForm.email || sessionEmail,
      phone: previousForm.phone || "",
      note: previousForm.note || "",
    },
    paymentMethod: storefrontState.checkout.paymentMethod || "bancontact",
    itemsSnapshot: storefrontState.cartItems.map((item) => ({ ...item })),
  };
}

function showCheckoutModal() {
  if (!checkoutModal) {
    return;
  }

  if (!checkoutModal.hidden) {
    renderCheckoutStep();
    window.requestAnimationFrame(focusCheckoutTarget);
    return;
  }

  window.clearTimeout(storefrontState.checkoutCloseTimer);
  storefrontState.checkoutLastFocusedElement = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  closeCartDrawer({ restoreFocus: false });
  checkoutModal.hidden = false;
  checkoutModal.dataset.open = "false";
  syncBodyModalState();

  window.requestAnimationFrame(() => {
    checkoutModal.dataset.open = "true";
    focusCheckoutTarget();
  });
}

function openCheckoutModal() {
  if (!checkoutModal) {
    return;
  }

  if (!storefrontState.cartItems.length) {
    setCartStatus("Je mandje is nog leeg.", "error");
    openCartDrawer();
    return;
  }

  prepareCheckoutFromCart();
  setCheckoutStatus("", "info");
  renderCheckoutStep();
  showCheckoutModal();
}

function closeCheckoutModal({ restoreFocus = true, resetState = true } = {}) {
  if (!checkoutModal || checkoutModal.hidden || storefrontState.checkout.isProcessing) {
    return;
  }

  checkoutModal.dataset.open = "false";
  window.clearTimeout(storefrontState.checkoutCloseTimer);
  storefrontState.checkoutCloseTimer = window.setTimeout(() => {
    checkoutModal.hidden = true;
    syncBodyModalState();

    if (resetState) {
      storefrontState.checkout = createEmptyCheckoutState();
      setCheckoutStatus("", "info");
      renderCheckoutStep();
    }

    if (
      restoreFocus
      && storefrontState.checkoutLastFocusedElement
      && typeof storefrontState.checkoutLastFocusedElement.focus === "function"
    ) {
      storefrontState.checkoutLastFocusedElement.focus();
    }

    storefrontState.checkoutLastFocusedElement = null;
  }, OVERLAY_CLOSE_DELAY_MS);
}

function validateCheckoutForm() {
  const name = checkoutNameInput?.value.trim() || "";
  const email = checkoutEmailInput?.value.trim() || "";
  const phone = checkoutPhoneInput?.value.trim() || "";
  const note = checkoutNoteInput?.value.trim() || "";

  if (!name) {
    return { valid: false, message: "Vul je naam in.", focusTarget: checkoutNameInput };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, message: "Vul een geldig e-mailadres in.", focusTarget: checkoutEmailInput };
  }

  if (!/^[0-9+()\s/-]{7,}$/.test(phone)) {
    return { valid: false, message: "Vul een geldig telefoonnummer in.", focusTarget: checkoutPhoneInput };
  }

  return {
    valid: true,
    values: {
      name,
      email,
      phone,
      note,
    },
  };
}

function captureCheckoutFormState() {
  storefrontState.checkout.form = {
    name: checkoutNameInput?.value.trim() || "",
    email: checkoutEmailInput?.value.trim() || "",
    phone: checkoutPhoneInput?.value.trim() || "",
    note: checkoutNoteInput?.value.trim() || "",
  };
}

function handleCheckoutSubmit(event) {
  event.preventDefault();

  const validation = validateCheckoutForm();

  if (!validation.valid) {
    setCheckoutStatus(validation.message, "error");
    validation.focusTarget?.focus();
    return;
  }

  storefrontState.checkout.form = validation.values;
  storefrontState.checkout.step = "payment";
  setCheckoutStatus("", "info");
  renderCheckoutStep();
  window.requestAnimationFrame(focusCheckoutTarget);
}

function createPendingOrderSnapshot(orderId, orderNumber = "") {
  return {
    cartItems: getCheckoutItemsSnapshot().map((item) => ({ ...item })),
    createdAt: new Date().toISOString(),
    customer: {
      email: storefrontState.checkout.form.email,
      name: storefrontState.checkout.form.name,
      note: storefrontState.checkout.form.note,
      phone: storefrontState.checkout.form.phone,
    },
    orderId,
    orderNumber,
    paymentMethod: storefrontState.checkout.paymentMethod,
  };
}

function getCheckoutResultFromStatus(orderStatus, paymentStatus) {
  if (paymentStatus === "paid" || orderStatus === "paid" || orderStatus === "fulfilled") {
    return "success";
  }

  if (paymentStatus === "failed") {
    return "failed";
  }

  if (paymentStatus === "cancelled" || orderStatus === "cancelled") {
    return "cancelled";
  }

  if (paymentStatus === "expired" || orderStatus === "expired") {
    return "expired";
  }

  return "pending";
}

function applyCheckoutResultState(statusPayload, pendingOrder) {
  const result = getCheckoutResultFromStatus(statusPayload.orderStatus, statusPayload.paymentStatus);

  storefrontState.checkout = {
    ...createEmptyCheckoutState(),
    form: {
      name: pendingOrder?.customer?.name || "",
      email: pendingOrder?.customer?.email || "",
      phone: pendingOrder?.customer?.phone || "",
      note: pendingOrder?.customer?.note || "",
    },
    isProcessing: false,
    itemsSnapshot: pendingOrder?.cartItems?.length
      ? pendingOrder.cartItems.map((item) => ({ ...item }))
      : [],
    orderId: statusPayload.orderId || pendingOrder?.orderId || "",
    orderNumber: statusPayload.orderNumber || pendingOrder?.orderNumber || "",
    paymentMethod: pendingOrder?.paymentMethod || storefrontState.checkout.paymentMethod || "bancontact",
    result,
    step: "result",
  };

  return result;
}

async function syncPendingOrderResult(pendingOrder, options = {}) {
  const {
    announce = true,
    keepModalOpen = true,
  } = options;

  if (!pendingOrder?.orderId) {
    throw new Error("Er is geen openstaande bestelling om te controleren.");
  }

  storefrontState.checkout.isProcessing = true;
  renderCheckoutStep();

  const statusPayload = await fetchCheckoutStatus(pendingOrder.orderId);
  const orderedProductIds = Array.isArray(statusPayload.items)
    ? statusPayload.items.map((item) => item.productId).filter(Boolean)
    : pendingOrder.cartItems.map((item) => item.id).filter(Boolean);
  const result = applyCheckoutResultState(statusPayload, pendingOrder);

  await loadProducts();

  if (result === "success") {
    removeCartItemsById(orderedProductIds);
    clearPendingOrderFromStorage();
    setCartStatus("Je betaling is bevestigd. Je selectie werd uit je mandje gehaald.", "success");

    if (announce) {
      announceLiveMessage("Je betaling is bevestigd en de collectie werd vernieuwd.");
    }
  } else if (result === "failed") {
    clearPendingOrderFromStorage();
    setCartStatus("De betaling werd niet bevestigd. Je selectie blijft in je mandje zolang ze beschikbaar is.", "error");
  } else if (result === "cancelled") {
    clearPendingOrderFromStorage();
    setCartStatus("De betaling werd geannuleerd. Je selectie blijft in je mandje zolang ze beschikbaar is.", "info");
  } else if (result === "expired") {
    clearPendingOrderFromStorage();
    setCartStatus("De reservatie is verlopen. Controleer je mandje en probeer opnieuw als de stukken nog beschikbaar zijn.", "error");
  } else {
    savePendingOrderToStorage({
      ...pendingOrder,
      orderNumber: statusPayload.orderNumber || pendingOrder.orderNumber || "",
    });
    setCartStatus("De betaling wordt nog gecontroleerd. Vernieuw de status binnen enkele ogenblikken.", "info");
  }

  setCheckoutStatus("", "info");
  renderCart();
  renderCheckoutStep();

  if (keepModalOpen) {
    showCheckoutModal();
  }

  return result;
}

async function startCheckoutRedirect() {
  if (storefrontState.checkout.isProcessing) {
    return;
  }

  const items = getCheckoutItemsSnapshot();

  if (!items.length) {
    setCheckoutStatus("Je mandje is leeg.", "error");
    return;
  }

  storefrontState.checkout.isProcessing = true;
  setCheckoutStatus("", "info");
  renderCheckoutStep();

  try {
    const response = await createCheckoutSession({
      action: "create",
      cartItems: items.map((item) => ({ id: item.id })),
      customer: {
        email: storefrontState.checkout.form.email,
        name: storefrontState.checkout.form.name,
        note: storefrontState.checkout.form.note,
        phone: storefrontState.checkout.form.phone,
      },
      paymentMethod: storefrontState.checkout.paymentMethod,
      pickupNote: storefrontState.checkout.form.note,
    });

    if (!response?.checkoutUrl || !response?.orderId) {
      throw new Error("De betaalpagina kon niet voorbereid worden.");
    }

    storefrontState.checkout.orderId = response.orderId;
    storefrontState.checkout.orderNumber = response.orderNumber || "";

    savePendingOrderToStorage(
      createPendingOrderSnapshot(response.orderId, response.orderNumber || ""),
    );

    window.location.assign(response.checkoutUrl);
  } catch (error) {
    storefrontState.checkout.isProcessing = false;
    await loadProducts();
    setCheckoutStatus(error.message || "De betaalpagina kon niet voorbereid worden.", "error");
    renderCheckoutStep();
  }
}

async function handleCheckoutResultAction(action) {
  if (action === "refresh-status") {
    const pendingOrder = loadPendingOrderFromStorage();

    try {
      await syncPendingOrderResult(pendingOrder, { announce: false, keepModalOpen: true });
    } catch (error) {
      storefrontState.checkout.isProcessing = false;
      setCheckoutStatus(error.message || "De betaalstatus kon niet vernieuwd worden.", "error");
      renderCheckoutStep();
    }
    return;
  }

  if (action === "back-to-cart") {
    storefrontState.checkout.result = null;
    storefrontState.checkout.step = "form";
    setCheckoutStatus("", "info");
    renderCheckoutStep();
    closeCheckoutModal({ restoreFocus: false, resetState: false });
    window.setTimeout(openCartDrawer, OVERLAY_CLOSE_DELAY_MS);
    return;
  }

  closeCheckoutModal({ restoreFocus: false });
  window.setTimeout(() => {
    document.querySelector("#collectie")?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, OVERLAY_CLOSE_DELAY_MS);
}

function handleCheckoutResultPrimaryAction() {
  handleCheckoutResultAction(checkoutResultPrimaryButton?.dataset.action || "");
}

function handleCheckoutResultSecondaryAction() {
  handleCheckoutResultAction(checkoutResultSecondaryButton?.dataset.action || "");
}

function clearPaymentReturnQuery() {
  const url = new URL(window.location.href);

  if (!url.searchParams.has("payment")) {
    return;
  }

  url.searchParams.delete("payment");
  window.history.replaceState({}, "", url);
}

async function handlePaymentReturnFromMollie() {
  const url = new URL(window.location.href);
  const paymentFlag = url.searchParams.get("payment");
  const pendingOrder = loadPendingOrderFromStorage();

  if (!paymentFlag || !pendingOrder?.orderId) {
    if (paymentFlag) {
      clearPaymentReturnQuery();
    }
    return;
  }

  try {
    await syncPendingOrderResult(pendingOrder, {
      announce: true,
      keepModalOpen: true,
    });
  } catch (error) {
    console.error(error);
    setCartStatus(error.message || "De betaalstatus kon niet gecontroleerd worden.", "error");
  } finally {
    clearPaymentReturnQuery();
  }
}

async function loadProducts() {
  if (!productGrid) {
    return;
  }

  renderSkeletonCards(productGrid, 6);
  renderSkeletonCards(recentSoldGrid, 3);
  setProductStatus("Collectie wordt geladen...");
  setRecentSoldStatus("Recente verkopen worden geladen...");

  try {
    const products = await fetchProductsWithImages();
    currentProducts = products.slice();
    syncStorefrontProductBuckets(currentProducts);

    const removedItems = reconcileCartWithCatalog();
    renderStorefrontSections();
    syncStorefrontSectionStatus();

    if (removedItems === 1) {
      setCartStatus("Een stuk werd uit je mandje gehaald omdat het niet meer bestelbaar is.", "error");
    } else if (removedItems > 1) {
      setCartStatus(`${removedItems} stukken werden uit je mandje gehaald omdat ze niet meer bestelbaar zijn.`, "error");
    }
  } catch (error) {
    currentProducts = [];
    storefrontState.collectionProducts = [];
    storefrontState.recentSoldProducts = [];
    stopAllCardObservers();
    productGrid.replaceChildren();
    recentSoldGrid?.replaceChildren();
    renderCart();
    setProductStatus(error.message || "De collectie kon niet geladen worden.", "error");
    setRecentSoldStatus("Recent verkocht kon niet geladen worden.", "error");
  }
}

if (contactForm && contactFormStatus) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    contactFormStatus.textContent =
      "Dank je. Dit demoformulier verstuurt nog niets, maar de aanvraagflow is klaar om gekoppeld te worden.";
  });
}

if (accountButton) {
  accountButton.addEventListener("click", () => {
    const shouldDelayAccountModal = Boolean(cartDrawer && !cartDrawer.hidden);
    closeCartDrawer({ restoreFocus: false });
    window.setTimeout(openAccountModal, shouldDelayAccountModal ? OVERLAY_CLOSE_DELAY_MS : 0);
  });
}

if (accountModalClose && accountModal) {
  accountModalClose.addEventListener("click", () => {
    closeAccountModal();
  });

  accountModal.addEventListener("click", (event) => {
    if (event.target === accountModal) {
      closeAccountModal();
    }
  });
}

if (accountAuthForm) {
  accountAuthForm.addEventListener("submit", handleAccountAuthSubmit);
}

if (accountModeLoginButton) {
  accountModeLoginButton.addEventListener("click", () => {
    setAccountMode("login");
    setAccountStatus("", "info");
    syncAccountControls();
  });
}

if (accountModeRegisterButton) {
  accountModeRegisterButton.addEventListener("click", () => {
    setAccountMode("register");
    setAccountStatus("", "info");
    syncAccountControls();
  });
}

if (accountLogoutButton) {
  accountLogoutButton.addEventListener("click", handleAccountLogout);
}

if (cartButton) {
  cartButton.addEventListener("click", () => {
    closeAccountModal({ restoreFocus: false });
    openCartDrawer();
  });
}

if (cartDrawerClose) {
  cartDrawerClose.addEventListener("click", () => {
    closeCartDrawer();
  });
}

if (cartDrawer) {
  cartDrawer.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.hasAttribute("data-cart-close")) {
      closeCartDrawer();
    }
  });
}

if (cartCheckoutButton) {
  cartCheckoutButton.addEventListener("click", openCheckoutModal);
}

if (checkoutCloseButton) {
  checkoutCloseButton.addEventListener("click", () => {
    closeCheckoutModal();
  });
}

if (checkoutModal) {
  checkoutModal.addEventListener("click", (event) => {
    if (
      event.target instanceof HTMLElement
      && event.target.hasAttribute("data-checkout-close")
      && !storefrontState.checkout.isProcessing
    ) {
      closeCheckoutModal();
    }
  });
}

if (checkoutForm) {
  checkoutForm.addEventListener("submit", handleCheckoutSubmit);
}

if (checkoutBackToCartButton) {
  checkoutBackToCartButton.addEventListener("click", () => {
    captureCheckoutFormState();
    closeCheckoutModal({ restoreFocus: false, resetState: false });
    window.setTimeout(openCartDrawer, OVERLAY_CLOSE_DELAY_MS);
  });
}

if (checkoutBackToFormButton) {
  checkoutBackToFormButton.addEventListener("click", () => {
    if (storefrontState.checkout.isProcessing) {
      return;
    }

    storefrontState.checkout.step = "form";
    renderCheckoutStep();
    window.requestAnimationFrame(focusCheckoutTarget);
  });
}

if (checkoutProceedToMollieButton) {
  checkoutProceedToMollieButton.addEventListener("click", startCheckoutRedirect);
}

if (checkoutResultPrimaryButton) {
  checkoutResultPrimaryButton.addEventListener("click", handleCheckoutResultPrimaryAction);
}

if (checkoutResultSecondaryButton) {
  checkoutResultSecondaryButton.addEventListener("click", handleCheckoutResultSecondaryAction);
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

if (productModalPrimaryAction) {
  productModalPrimaryAction.addEventListener("click", () => {
    const product = modalState.product;
    const action = productModalPrimaryAction.dataset.action;

    if (!product) {
      return;
    }

    if (action === "add") {
      addProductToCart(product, { openDrawer: true });
      return;
    }

    if (action === "request") {
      requestPriceForProduct(product, { closeProductFirst: true });
    }
  });
}

if (productModalSecondaryAction) {
  productModalSecondaryAction.addEventListener("click", () => {
    if (!modalState.product) {
      return;
    }

    requestPriceForProduct(modalState.product, { closeProductFirst: true });
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
  if (checkoutModal && !checkoutModal.hidden && event.key === "Escape") {
    if (!storefrontState.checkout.isProcessing) {
      closeCheckoutModal();
    }
    return;
  }

  if (cartDrawer && !cartDrawer.hidden && event.key === "Escape") {
    closeCartDrawer();
    return;
  }

  if (accountModal && !accountModal.hidden && event.key === "Escape") {
    closeAccountModal();
    return;
  }

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

async function initializeStorefront() {
  renderCart();
  renderCheckoutStep();
  initializeSpotlight();
  await initializePublicAuth();
  await loadProducts();
  await handlePaymentReturnFromMollie();
}

initializeStorefront().catch((error) => {
  console.error(error);
  setProductStatus("De collectie kon niet geladen worden.", "error");
  setRecentSoldStatus("Recent verkocht kon niet geladen worden.", "error");
});
