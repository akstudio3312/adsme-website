
/* ========================================
   AdsMe — Website JavaScript
   File: script.js
======================================== */

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // ----------------------------------------
  // Helper functions
  // ----------------------------------------

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

  // ----------------------------------------
  // Mobile sidebar
  // ----------------------------------------

  const sidebar = $(".sidebar");
  const menuBtn = $(".menu-btn");
  const closeBtn = $(".sidebar-close");
  const backdrop = $(".sidebar-backdrop");

  function openSidebar() {
    if (!sidebar || !backdrop) return;

    sidebar.classList.add("active");
    backdrop.classList.add("active");
    document.body.classList.add("menu-open");

    sidebar.setAttribute("aria-hidden", "false");

    if (menuBtn) {
      menuBtn.setAttribute("aria-expanded", "true");
    }

    if (closeBtn) closeBtn.focus();
  }

  function closeSidebar() {
    if (!sidebar || !backdrop) return;

    sidebar.classList.remove("active");
    backdrop.classList.remove("active");
    document.body.classList.remove("menu-open");

    sidebar.setAttribute("aria-hidden", "true");

    if (menuBtn) {
      menuBtn.setAttribute("aria-expanded", "false");
    }
  }

  if (menuBtn) {
    menuBtn.addEventListener("click", openSidebar);
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeSidebar);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeSidebar);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSidebar();
      closeVideoModal();
    }
  });

  // Close sidebar after selecting a navigation link.
  $$(".sidebar a[href^='#']").forEach((link) => {
    link.addEventListener("click", closeSidebar);
  });

  // ----------------------------------------
  // Smooth scrolling
  // ----------------------------------------

  $$("a[href^='#']").forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");

      if (!href || href === "#") {
        event.preventDefault();
        return;
      }

      const target = $(href);

      if (target) {
        event.preventDefault();

        target.scrollIntoView({
          behavior: window.matchMedia(
            "(prefers-reduced-motion: reduce)"
          ).matches
            ? "auto"
            : "smooth",
          block: "start",
        });
      }
    });
  });

  // ----------------------------------------
  // Search and category filters
  // ----------------------------------------

  const searchInput = $(
    "#searchInput, #search-input, .search-box input"
  );

  const categoryButtons = $$(".category-pill");
  const adCards = $$(".ad-card");

  let activeCategory = "all";

  function getCardCategory(card) {
    return (
      card.dataset.category ||
      $(".ad-category", card)?.textContent ||
      ""
    )
      .trim()
      .toLowerCase();
  }

  function getCardSearchText(card) {
    return [
      card.textContent,
      card.dataset.category || "",
      card.dataset.title || "",
      card.dataset.brand || "",
    ]
      .join(" ")
      .toLowerCase();
  }

  function filterAds() {
    const searchTerm = searchInput
      ? searchInput.value.trim().toLowerCase()
      : "";

    let visibleCount = 0;

    adCards.forEach((card) => {
      const category = getCardCategory(card);
      const searchText = getCardSearchText(card);

      const matchesCategory =
        activeCategory === "all" ||
        category.includes(activeCategory);

      const matchesSearch =
        searchTerm === "" ||
        searchText.includes(searchTerm);

      const visible = matchesCategory && matchesSearch;

      card.hidden = !visible;

      if (visible) visibleCount++;
    });

    let emptyState = $(".empty-state");

    if (adCards.length > 0 && visibleCount === 0) {
      if (!emptyState) {
        emptyState = document.createElement("div");
        emptyState.className = "empty-state";
        emptyState.innerHTML = `
          <h3>No ads found</h3>
          <p>Try another search or choose a different category.</p>
        `;

        const grid = $(".ads-grid");

        if (grid) grid.appendChild(emptyState);
      }

      emptyState.hidden = false;
    } else if (emptyState) {
      emptyState.hidden = true;
    }
  }

  if (searchInput) {
    searchInput.addEventListener("input", filterAds);
  }

  categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      categoryButtons.forEach((item) => {
        item.classList.remove("active");
        item.setAttribute("aria-pressed", "false");
      });

      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");

      activeCategory = (
        button.dataset.category ||
        button.textContent
      )
        .trim()
        .toLowerCase();

      if (
        activeCategory === "all categories" ||
        activeCategory === "all ads"
      ) {
        activeCategory = "all";
      }

      filterAds();
    });
  });

  // ----------------------------------------
  // Video playback modal
  // ----------------------------------------

  let videoModal = null;
  let modalVideo = null;

  function closeVideoModal() {
    if (!videoModal) return;

    if (modalVideo) {
      modalVideo.pause();
      modalVideo.removeAttribute("src");
      modalVideo.load();
    }

    videoModal.remove();
    videoModal = null;
    modalVideo = null;
    document.body.classList.remove("menu-open");
  }

  function openVideoModal(videoUrl, title) {
    if (!videoUrl) {
      alert(
        "This is a demo ad. A real video will play after the video URL is connected."
      );
      return;
    }

    closeVideoModal();

    videoModal = document.createElement("div");
    videoModal.className = "modal-backdrop";
    videoModal.setAttribute("role", "dialog");
    videoModal.setAttribute("aria-modal", "true");
    videoModal.setAttribute("aria-label", title || "Ad video");

    const modal = document.createElement("div");
    modal.className = "modal";

    const header = document.createElement("div");
    header.className = "modal-header";

    const heading = document.createElement("h3");
    heading.textContent = title || "AdsMe Video";

    const closeButton = document.createElement("button");
    closeButton.className = "modal-close";
    closeButton.type = "button";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Close video");

    modalVideo = document.createElement("video");
    modalVideo.controls = true;
    modalVideo.autoplay = true;
    modalVideo.playsInline = true;
    modalVideo.preload = "metadata";
    modalVideo.src = videoUrl;

    closeButton.addEventListener("click", closeVideoModal);

    header.append(heading, closeButton);
    modal.append(header, modalVideo);
    videoModal.appendChild(modal);
    document.body.appendChild(videoModal);

    document.body.classList.add("menu-open");

    videoModal.addEventListener("click", (event) => {
      if (event.target === videoModal) {
        closeVideoModal();
      }
    });

    modalVideo.play().catch(() => {
      // Some mobile browsers require a manual tap to play video.
    });

    closeButton.focus();
  }

  $$(".play-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".ad-card");

      const videoUrl =
        button.dataset.video ||
        card?.dataset.video ||
        $("video", card)?.currentSrc ||
        $("video", card)?.src ||
        "";

      const title =
        card?.dataset.title ||
        $(".ad-title", card)?.textContent ||
        "AdsMe Video";

      openVideoModal(videoUrl, title);
    });
  });

  // ----------------------------------------
  // Google sign-in preparation
  // ----------------------------------------
  // This does NOT authenticate users yet.
  // We will connect Supabase Auth next.

  const googleButtons = $$(".google-btn");

  googleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      alert(
        "Google Sign-In is not connected yet. " +
        "Next, we will configure Google OAuth with Supabase."
      );
    });
  });

  // ----------------------------------------
  // Mobile bottom navigation
  // ----------------------------------------

  const bottomLinks = $$(".bottom-nav a");

  bottomLinks.forEach((link) => {
    link.addEventListener("click", () => {
      bottomLinks.forEach((item) => {
        item.classList.remove("active");
      });

      link.classList.add("active");
    });
  });

  // ----------------------------------------
  // Active section navigation
  // ----------------------------------------

  const sections = $$("main section[id]");

  if ("IntersectionObserver" in window && sections.length) {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const sectionId = entry.target.id;

          $$(".sidebar-nav a, .bottom-nav a").forEach((link) => {
            const isActive =
              link.getAttribute("href") === `#${sectionId}`;

            link.classList.toggle("active", isActive);
          });
        });
      },
      {
        rootMargin: "-25% 0px -60% 0px",
        threshold: 0,
      }
    );

    sections.forEach((section) => {
      sectionObserver.observe(section);
    });
  }

  // ----------------------------------------
  // Current year in footer
  // ----------------------------------------

  const yearElement = $("#currentYear, #year");

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  // ----------------------------------------
  // External social links
  // ----------------------------------------

  $$("a[data-external='true']").forEach((link) => {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });

  // ----------------------------------------
  // Initial setup
  // ----------------------------------------

  if (sidebar) {
    sidebar.setAttribute("aria-hidden", "true");
  }

  if (menuBtn) {
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", "Open navigation menu");
  }

  categoryButtons.forEach((button) => {
    const category = (
      button.dataset.category ||
      button.textContent
    )
      .trim()
      .toLowerCase();

    const isAll =
      category === "all" ||
      category === "all ads" ||
      category === "all categories";

    button.setAttribute(
      "aria-pressed",
      String(button.classList.contains("active") || isAll)
    );
  });

  filterAds();

  console.log("AdsMe website JavaScript loaded successfully.");
});
