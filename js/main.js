(function () {
  "use strict";

  var WHATSAPP_NUMBER = "963952516412";
  var modalState = null;

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

  var siteHeader = document.querySelector(".site-header");
  var menuToggle = document.querySelector(".menu-toggle");
  var mobileNav = document.getElementById("mobile-nav");

  function closeMenu(returnFocus) {
    mobileNav.hidden = true;
    siteHeader.classList.remove("is-open");
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
      siteHeader.classList.add("is-open");
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

  var heroSection = document.getElementById("home");
  var floatBtn = document.querySelector(".whatsapp-float");
  var scrollTicking = false;

  function onScroll() {
    scrollTicking = false;
    var y = window.scrollY;
    siteHeader.classList.toggle("is-top", y <= 8);
    floatBtn.classList.toggle("is-shown", y > heroSection.offsetHeight * 0.6);
  }

  window.addEventListener("scroll", function () {
    if (!scrollTicking) {
      scrollTicking = true;
      window.requestAnimationFrame(onScroll);
    }
  }, { passive: true });
  onScroll();

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove("is-pending");
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    document.querySelectorAll(".reveal").forEach(function (item) {
      if (item.getBoundingClientRect().top < window.innerHeight) return;
      item.classList.add("is-pending");
      observer.observe(item);
    });
  }

  var productModal = document.getElementById("product-modal");
  var productModalImage = productModal.querySelector(".modal__image");
  var productModalTitle = productModal.querySelector(".modal__title");
  var productModalDesc = productModal.querySelector(".modal__desc");
  var productModalIngredients = productModal.querySelector(".js-ingredients");
  var productModalStorage = productModal.querySelector(".js-storage");
  var wholesaleProduct = document.getElementById("w-product");

  function openModal(trigger) {
    var card = trigger.closest(".product-card");
    var image = card.querySelector(".product-card__media img");

    productModalImage.srcset = image.getAttribute("srcset");
    productModalImage.src = image.getAttribute("src");
    productModalImage.sizes = "(min-width: 640px) 42rem, 100vw";
    productModalImage.alt = image.alt;
    productModalTitle.textContent = card.querySelector(".product-card__name").textContent;
    productModalDesc.textContent = card.querySelector(".product-card__desc").textContent;
    productModalIngredients.textContent = card.querySelector(".product-card__spec dd").textContent;
    productModalStorage.textContent = trigger.dataset.storage;

    modalState = { el: productModal, returnFocus: trigger };
    productModal.hidden = false;
    lockScroll(true);
    productModal.querySelector(".modal__close").focus();
  }

  function closeModal(returnFocus) {
    if (!modalState) return;
    var modal = modalState.el;
    var focusTarget = returnFocus === false ? null : modalState.returnFocus;
    modalState = null;
    modal.classList.add("is-closing");
    window.setTimeout(function () {
      modal.hidden = true;
      modal.classList.remove("is-closing");
      productModalImage.removeAttribute("srcset");
      lockScroll(false);
      if (focusTarget) focusTarget.focus();
    }, 160);
  }

  document.querySelectorAll(".product-details-btn").forEach(function (btn) {
    btn.addEventListener("click", function () { openModal(btn); });
  });

  productModal.addEventListener("click", function (event) {
    if (event.target.closest("[data-close]") || event.target === productModal) closeModal();
  });

  productModal.querySelector(".js-modal-order").addEventListener("click", function () {
    var name = productModalTitle.textContent;
    Array.prototype.forEach.call(wholesaleProduct.options, function (option) {
      if (option.value === name) wholesaleProduct.value = name;
    });
    closeModal(false);
  });

  productModal.addEventListener("keydown", function (event) {
    if (event.key === "Tab") trapTab(productModal, event);
  });

  var wholesaleForm = document.querySelector(".js-wholesale-form");
  var wholesaleStatus = wholesaleForm.querySelector(".form__status");

  wholesaleForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var data = new FormData(wholesaleForm);
    var text = [
      "طلب جملة من موقع شركة لارينوو والملوك",
      "الاسم: " + data.get("name"),
      "المدينة: " + data.get("city"),
      "المنتج: " + data.get("product"),
      "الكمية التقريبية: " + data.get("quantity"),
    ].join("\n");
    window.open("https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(text), "_blank", "noopener,noreferrer");
    wholesaleStatus.hidden = false;
  });
})();
