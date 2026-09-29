/* Larino — site interactions (vanilla JS, no dependencies). */
(function () {
  "use strict";

  var WHATSAPP_NUMBER = "963952516412";
  var HERO_INTERVAL_MS = 5200;
  var modalState = null; // { el, returnFocus }

  /* ---------- Shared helpers ---------- */

  function lockScroll(lock) {
    document.body.style.overflow = lock ? "hidden" : "";
  }

  function trapTab(container, event) {
    var focusables = container.querySelectorAll("a[href], button:not([disabled])");
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ---------- Mobile navigation ---------- */

  var menuToggle = document.querySelector(".menu-toggle");
  var mobileNav = document.getElementById("mobile-nav");

  function closeMenu(returnFocus) {
    mobileNav.hidden = true;
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "فتح القائمة");
    if (returnFocus) menuToggle.focus();
  }

  menuToggle.addEventListener("click", function () {
    var open = menuToggle.getAttribute("aria-expanded") === "true";
    if (open) {
      closeMenu(false);
    } else {
      mobileNav.hidden = false;
      menuToggle.setAttribute("aria-expanded", "true");
      menuToggle.setAttribute("aria-label", "إغلاق القائمة");
      mobileNav.querySelector("a").focus();
    }
  });

  mobileNav.addEventListener("click", function (event) {
    if (event.target.closest("a")) closeMenu(false);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    if (!productModal.hidden) { closeModal(); return; }
    if (!lightbox.hidden) { closeLightbox(); return; }
    if (menuToggle.getAttribute("aria-expanded") === "true") closeMenu(true);
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth >= 1024 && mobileNav.hidden === false) closeMenu(false);
  });

  /* ---------- Hero stage rotation ---------- */

  var heroSlides = Array.prototype.slice.call(document.querySelectorAll(".hero__slide"));
  var heroDots = Array.prototype.slice.call(document.querySelectorAll(".hero__stage-dot"));
  var heroIndex = heroSlides.findIndex(function (slide) {
    return slide.classList.contains("is-active");
  });
  if (heroIndex < 0) heroIndex = 0;
  var heroTimer = null;

  function showHeroStage(index) {
    heroIndex = (index + heroSlides.length) % heroSlides.length;
    heroSlides.forEach(function (slide, i) {
      var active = i === heroIndex;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", active ? "false" : "true");
      slide.setAttribute("alt", active ? slide.getAttribute("data-alt") : "");
    });
    heroDots.forEach(function (dot, i) {
      var active = i === heroIndex;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  heroDots.forEach(function (dot) {
    dot.addEventListener("click", function () {
      showHeroStage(heroDots.indexOf(dot));
      restartHeroTimer();
    });
  });

  function restartHeroTimer() {
    window.clearInterval(heroTimer);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    heroTimer = window.setInterval(function () {
      showHeroStage(heroIndex + 1);
    }, HERO_INTERVAL_MS);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) window.clearInterval(heroTimer);
    else restartHeroTimer();
  });

  restartHeroTimer();

  /* ---------- Scroll reveal ---------- */

  var revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealItems.forEach(function (item) { observer.observe(item); });
  } else {
    revealItems.forEach(function (item) { item.classList.add("is-visible"); });
  }

  /* ---------- Product details modal ---------- */

  var productModal = document.getElementById("product-modal");
  var productModalImage = productModal.querySelector(".modal__image");
  var productModalTitle = productModal.querySelector(".modal__title");
  var productModalDesc = productModal.querySelector(".modal__desc");
  var productModalIngredients = productModal.querySelector(".js-ingredients");
  var productModalStorage = productModal.querySelector(".js-storage");

  function openModal(trigger) {
    var data = trigger.dataset;
    productModalImage.src = data.src;
    if (data.srcset) productModalImage.srcset = data.srcset;
    productModalImage.alt = data.alt;
    productModalImage.sizes = "(min-width: 640px) 42rem, 100vw";
    productModalTitle.textContent = data.name;
    productModalDesc.textContent = data.description;
    productModalIngredients.textContent = data.ingredients;
    productModalStorage.textContent = data.storage;

    modalState = { el: productModal, returnFocus: trigger };
    productModal.hidden = false;
    lockScroll(true);
    productModal.querySelector(".modal__close").focus();
  }

  function closeModal() {
    if (!modalState) return;
    var modal = modalState.el;
    var returnFocus = modalState.returnFocus;
    modalState = null;
    modal.classList.add("is-closing");
    window.setTimeout(function () {
      modal.hidden = true;
      modal.classList.remove("is-closing");
      productModalImage.removeAttribute("src");
      productModalImage.removeAttribute("srcset");
      lockScroll(false);
      if (returnFocus) returnFocus.focus();
    }, 160);
  }

  document.querySelectorAll(".product-details-btn").forEach(function (btn) {
    btn.addEventListener("click", function () { openModal(btn); });
  });

  productModal.addEventListener("click", function (event) {
    if (event.target.closest("[data-close]") || event.target === productModal) closeModal();
  });

  productModal.querySelector(".js-modal-order").addEventListener("click", function () {
    closeModal();
  });

  productModal.addEventListener("keydown", function (event) {
    if (event.key === "Tab") trapTab(productModal, event);
  });

  /* ---------- Gallery lightbox ---------- */

  var lightbox = document.getElementById("gallery-lightbox");
  var galleryItems = Array.prototype.slice.call(document.querySelectorAll(".gallery__item"));
  var lbTitle = lightbox.querySelector(".lightbox__title");
  var lbCounter = lightbox.querySelector(".lightbox__counter");
  var lbDesc = lightbox.querySelector(".lightbox__desc");
  var lbImage = lightbox.querySelector(".lightbox__image");
  var lbStage = lightbox.querySelector(".lightbox__stage");
  var lbIndex = 0;
  var lbZoom = 1;
  var lbReturnFocus = null;
  var lbTouchStartX = null;

  function lightboxItem(i) { return galleryItems[(i + galleryItems.length) % galleryItems.length]; }

  function renderLightbox() {
    var item = lightboxItem(lbIndex).dataset;
    lbTitle.textContent = item.title;
    lbCounter.textContent = lbIndex + 1 + " من " + galleryItems.length;
    lbDesc.textContent = item.description;
    lbImage.src = item.src;
    if (item.srcset) lbImage.srcset = item.srcset;
    lbImage.alt = item.alt;
    lbImage.sizes = "96vw";
    lbZoom = 1;
    lbImage.style.transform = "scale(1)";
    lbStage.scrollTop = 0;
    lbStage.scrollLeft = 0;
  }

  function openLightbox(index, trigger) {
    lbIndex = index;
    lbReturnFocus = trigger;
    renderLightbox();
    lightbox.hidden = false;
    lockScroll(true);
    lightbox.querySelector("[data-close]").focus();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lbImage.removeAttribute("src");
    lbImage.removeAttribute("srcset");
    lockScroll(false);
    if (lbReturnFocus) lbReturnFocus.focus();
    lbReturnFocus = null;
  }

  function moveLightbox(direction) {
    lbIndex = (lbIndex + direction + galleryItems.length) % galleryItems.length;
    renderLightbox();
  }

  function setZoom(value) {
    lbZoom = Math.min(2.5, Math.max(1, value));
    lbImage.style.transform = "scale(" + lbZoom + ")";
  }

  galleryItems.forEach(function (item, index) {
    item.addEventListener("click", function () { openLightbox(index, item); });
  });

  lightbox.addEventListener("click", function (event) {
    if (event.target === lightbox) { closeLightbox(); return; }
    var control = event.target.closest("[data-close],[data-move],[data-zoom-in],[data-zoom-out],[data-zoom-reset]");
    if (!control) return;
    if (control.hasAttribute("data-close")) closeLightbox();
    if (control.hasAttribute("data-move")) moveLightbox(Number(control.getAttribute("data-move")));
    if (control.hasAttribute("data-zoom-in")) setZoom(lbZoom + 0.25);
    if (control.hasAttribute("data-zoom-out")) setZoom(lbZoom - 0.25);
    if (control.hasAttribute("data-zoom-reset")) setZoom(1);
  });

  document.addEventListener("keydown", function (event) {
    if (lightbox.hidden) return;
    if (event.key === "ArrowLeft") moveLightbox(1);
    if (event.key === "ArrowRight") moveLightbox(-1);
    if (event.key === "Tab") trapTab(lightbox, event);
  });

  lbStage.addEventListener("touchstart", function (event) {
    lbTouchStartX = event.touches[0] ? event.touches[0].clientX : null;
  }, { passive: true });

  lbStage.addEventListener("touchend", function (event) {
    var endX = event.changedTouches[0] ? event.changedTouches[0].clientX : null;
    if (lbTouchStartX === null || endX === null || lbZoom > 1) return;
    var distance = endX - lbTouchStartX;
    if (Math.abs(distance) > 55) moveLightbox(distance > 0 ? -1 : 1);
    lbTouchStartX = null;
  }, { passive: true });

  /* ---------- WhatsApp forms ---------- */

  function openWhatsApp(lines) {
    var text = encodeURIComponent(lines.filter(Boolean).join("\n"));
    window.open("https://wa.me/" + WHATSAPP_NUMBER + "?text=" + text, "_blank", "noopener,noreferrer");
  }

  function handleForm(form, buildLines) {
    var status = form.querySelector(".form__status");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      openWhatsApp(buildLines(new FormData(form)));
      if (status) status.hidden = false;
    });
  }

  handleForm(document.querySelector(".js-wholesale-form"), function (data) {
    return [
      "طلب جملة من موقع لارينوو",
      "الاسم: " + data.get("name"),
      "المدينة: " + data.get("city"),
      "الهاتف: " + data.get("phone"),
      "المنتج: " + data.get("product"),
      "الكمية التقريبية: " + data.get("quantity"),
    ];
  });

  handleForm(document.querySelector(".js-contact-form"), function (data) {
    return [
      "رسالة من موقع لارينوو",
      "الاسم: " + data.get("name"),
      "الهاتف: " + data.get("phone"),
      "" + data.get("message"),
    ];
  });
})();
