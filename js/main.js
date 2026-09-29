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
    if (menuToggle.getAttribute("aria-expanded") === "true") closeMenu(true);
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth >= 1024 && mobileNav.hidden === false) closeMenu(false);
  });

  /* ---------- Header shadow + floating WhatsApp (after the hero) ---------- */

  var siteHeader = document.querySelector(".site-header");
  var heroSection = document.getElementById("home");
  var floatBtn = document.querySelector(".whatsapp-float");
  var scrollTicking = false;

  function onScroll() {
    scrollTicking = false;
    var y = window.scrollY;
    siteHeader.classList.toggle("is-scrolled", y > 8);
    // The header already offers WhatsApp on the first screen; the floating button joins after the hero.
    floatBtn.classList.toggle("is-shown", y > heroSection.offsetHeight * 0.6);
  }

  window.addEventListener("scroll", function () {
    if (!scrollTicking) {
      scrollTicking = true;
      window.requestAnimationFrame(onScroll);
    }
  }, { passive: true });
  onScroll();

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
    // Products without a photo yet (no data-src) open the modal without an image.
    productModalImage.hidden = !data.src;
    if (data.src) {
      productModalImage.src = data.src;
      if (data.srcset) productModalImage.srcset = data.srcset;
      productModalImage.alt = data.alt;
      productModalImage.sizes = "(min-width: 640px) 42rem, 100vw";
    }
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
      "طلب جملة من موقع شركة لارينوو والملوك",
      "الاسم: " + data.get("name"),
      "المدينة: " + data.get("city"),
      "الهاتف: " + data.get("phone"),
      "المنتج: " + data.get("product"),
      "الكمية التقريبية: " + data.get("quantity"),
    ];
  });

  handleForm(document.querySelector(".js-contact-form"), function (data) {
    return [
      "رسالة من موقع شركة لارينوو والملوك",
      "الاسم: " + data.get("name"),
      "الهاتف: " + data.get("phone"),
      "" + data.get("message"),
    ];
  });
})();
