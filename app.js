const bouquets = [
  { id: 10, name: "Noir Élégance", price: "vanaf €89" },
  { id: 2, name: "Golden Blush", price: "vanaf €79" },
  { id: 6, name: "Maison Verdia", price: "vanaf €119" },
  { id: 7, name: "Champagne Bloom", price: "vanaf €99" },
  { id: 9, name: "Royal Garden", price: "vanaf €129" },
  { id: 5, name: "Soft Opulence", price: "vanaf €95" },
  { id: 4, name: "Classic Silk", price: "vanaf €85" },
  { id: 14, name: "Grand Statement", price: "prijs op aanvraag" },
  { id: 15, name: "Atelier Luxe", price: "prijs op aanvraag" },
  { id: 1, name: "Petit Verdia", price: "vanaf €59" },
  { id: 11, name: "Pure Romance", price: "vanaf €75" },
  { id: 13, name: "Timeless Gift", price: "vanaf €69" }
];

const imageMap = {
  1: 1, 2: 7, 3: 2, 4: 4, 5: 4, 6: 8, 7: 8, 8: 2,
  9: 9, 10: 4, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1
};

const grid = document.querySelector("#productGrid");

function imagePath(id, index) {
  return `images/Verdia ${id}_${index}.jpg`;
}

function createCard(item) {
  const count = imageMap[item.id] || 1;
  let current = 1;
  let autoTimer = null;

  const card = document.createElement("article");
  card.className = "card";

  card.innerHTML = `
    <div class="cardImage">
      <img class="activeImg" src="${imagePath(item.id, current)}" alt="${item.name}">
      ${count > 1 ? `
        <button class="arrow prev">‹</button>
        <button class="arrow next">›</button>
      ` : ""}
    </div>
    <div class="cardBody">
      <h3>${item.name}</h3>
      <div class="price">${item.price}</div>
      <div class="dots"></div>
    </div>
  `;

  const imageBox = card.querySelector(".cardImage");
  const dots = card.querySelector(".dots");

  function renderDots() {
    dots.innerHTML = "";
    for (let i = 1; i <= count; i++) {
      const dot = document.createElement("span");
      dot.className = `dot ${i === current ? "active" : ""}`;
      dots.appendChild(dot);
    }
  }

  function setImage(next, direction = 1) {
    if (next === current || count <= 1) return;

    const oldImg = imageBox.querySelector(".activeImg");
    if (!oldImg) return; // Safety check

    const newImg = document.createElement("img");
    newImg.src = imagePath(item.id, next);
    newImg.alt = item.name;
    
    // 1. Prepare new image off-screen
    newImg.className = "incoming";
    newImg.style.opacity = "0";
    newImg.style.transform = `translateX(${direction * 100}%) scale(1.05)`;

    // Remove any stale incoming/leaving images before adding the new slide.
    imageBox.querySelectorAll("img.incoming, img.leaving").forEach(el => el.remove());
    imageBox.appendChild(newImg);

    // 2. Prepare old image
    oldImg.classList.remove("activeImg");
    oldImg.classList.add("leaving");

    // Force reflow before animating
    newImg.offsetWidth;

    // 3. The Animation
    requestAnimationFrame(() => {
        newImg.style.opacity = "1";
        newImg.style.transform = "translateX(0) scale(1)";

        oldImg.style.opacity = "0";
        oldImg.style.transform = `translateX(${-direction * 100}%) scale(0.95)`;
    });

    function cleanup() {
      newImg.classList.remove("incoming");
      newImg.classList.add("activeImg");
      if (oldImg.parentNode) oldImg.remove();
    }

    newImg.addEventListener("transitionend", function onTransitionEnd(event) {
      if (event.propertyName === "transform") {
        newImg.removeEventListener("transitionend", onTransitionEnd);
        cleanup();
      }
    });

    current = next;
    renderDots();
    resetAutoSlide();
}

  function resetAutoSlide() {
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = setInterval(() => {
      setImage(current === count ? 1 : current + 1, 1);
    }, 4000 + Math.random() * 1000);
  }

  // Event Listeners
  const nextBtn = card.querySelector(".next");
  const prevBtn = card.querySelector(".prev");

  if (nextBtn) {
    nextBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent conflicts
      setImage(current === count ? 1 : current + 1, 1);
    });
    prevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setImage(current === 1 ? count : current - 1, -1);
    });
    
    // Clicking the image area also advances the slide
    imageBox.addEventListener("click", () => {
        setImage(current === count ? 1 : current + 1, 1);
    });
  }

  card.startAutoSlide = () => {
    if (count > 1 && !autoTimer) resetAutoSlide();
  };

  renderDots();
  return card;
}

// Initialize Grid
bouquets.forEach(item => grid.appendChild(createCard(item)));

// Intersection Observer to start animation only when visible
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.startAutoSlide?.();
    }
  });
}, { threshold: 0.2 });

document.querySelectorAll(".card").forEach(card => observer.observe(card));

const demoBanner = document.querySelector("#demoBanner");
const closeDemoBanner = document.querySelector("#closeDemoBanner");

if (closeDemoBanner && demoBanner) {
  closeDemoBanner.addEventListener("click", () => {
    demoBanner.classList.add("hidden");
  });
}