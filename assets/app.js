(() => {
  "use strict";

  const LIVE_DATA_URL = "data/default-site-export.json";
  const DEFAULT_SITE = window.SHOWMII_DEFAULT_SITE || window.CAILUCKY_DEFAULT_SITE || {};
  const SITE_KEY = "showmii_static_shop_site_v3";
  const CART_KEY = "showmii_static_shop_contact_cart_v3";
  const ADMIN_KEY = "showmii_static_shop_admin_session_v3";
  const BACKUP_KEY = "showmii_static_shop_first_backup_v3";

  const money = {
    TWD: { label: "台幣 TWD", symbol: "NT$", rate: 1 },
    CNY: { label: "人民幣 CNY", symbol: "¥", rate: 0.225 },
    USD: { label: "美金 USD", symbol: "$", rate: 0.031 }
  };

  const state = {
    category: "all",
    sort: "manual",
    query: "",
    drawerQuery: "",
    menuOpen: false,
    categoryExpanded: false,
    adminOpen: false,
    adminTab: "quick",
    selectedProductId: "",
    contactProductId: ""
  };

  const PRODUCT_STATUS_CODES = ["none", "new", "popular", "bestSeller", "preorder", "limited", "sale", "soldout", "custom"];

  function productStatusCode(value) {
    return PRODUCT_STATUS_CODES.includes(value) ? value : "none";
  }

  function inferProductStatus(product = {}) {
    const tagText = Array.isArray(product.tags) ? product.tags.join(" ") : String(product.tags || "");
    const text = [product.status, product.badge, tagText]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const hasAny = (needles) => needles.some((item) => text.includes(String(item).toLowerCase()));
    if (hasAny(["soldout", "sold-out", "\u552e\u5b8c", "\u5b8c\u552e"])) return "soldout";
    if (hasAny(["preorder", "pre-order", "\u9810\u8cfc", "\u9884\u8d2d"])) return "preorder";
    if (hasAny(["best", "bestseller", "best-seller", "\u71b1\u8ce3", "\u70ed\u5356", "\u4eba\u6c23", "\u4eba\u6c14"])) return "bestSeller";
    if (hasAny(["popular", "hot", "\u71b1\u9580", "\u70ed\u95e8"])) return "popular";
    if (hasAny(["limited", "\u9650\u91cf"])) return "limited";
    if (hasAny(["sale", "discount", "\u6298\u6263", "\u7279\u50f9", "\u7279\u4ef7"])) return "sale";
    if (hasAny(["new", "\u65b0\u54c1", "\u6700\u65b0"])) return "new";
    return product.badge ? "custom" : "none";
  }

  let site = normalizeSite(DEFAULT_SITE);
  let cart = loadCart();

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeUrl(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (/^(https?:|mailto:|tel:|line:|data:image\/|assets\/|\.\/|\/)/i.test(text)) return text;
    return "";
  }

  function moneyCode(value) {
    return money[value] ? value : "TWD";
  }

  function currencyFromBase(value, code = site?.layout?.currency || "TWD") {
    const config = money[moneyCode(code)];
    return Number(value || 0) * config.rate;
  }

  function baseFromCurrency(value, code = "TWD") {
    const config = money[moneyCode(code)];
    return Number(value || 0) / config.rate;
  }

  function roundMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function normalizeSite(data) {
    const next = { ...clone(DEFAULT_SITE), ...(data || {}) };
    next.admin = { ...clone(DEFAULT_SITE.admin || { username: "showmii", passcode: "showmii-admin" }), ...(data?.admin || {}) };
    if (!next.admin.username) next.admin.username = "showmii";
    if (!next.admin.passcode) next.admin.passcode = "showmii-admin";
    next.brand = { ...clone(DEFAULT_SITE.brand), ...(data?.brand || {}) };
    next.theme = { ...clone(DEFAULT_SITE.theme), ...(data?.theme || {}) };
    next.theme.backdropMode = data?.theme?.backdropMode || next.theme.backdropMode || "soft";
    next.theme.backdropColor = data?.theme?.backdropColor || next.theme.backdropColor || next.theme.background || "#fff8fb";
    next.theme.backdropImageUrl = data?.theme?.backdropImageUrl || next.theme.backdropImageUrl || "";
    next.theme.backdropImageOpacity = data?.theme?.backdropImageOpacity || next.theme.backdropImageOpacity || "70";
    next.layout = { ...clone(DEFAULT_SITE.layout), ...(data?.layout || {}) };
    next.hero = { ...clone(DEFAULT_SITE.hero), ...(data?.hero || {}) };
    next.footer = { ...clone(DEFAULT_SITE.footer), ...(data?.footer || {}) };
    next.contact = { ...clone(DEFAULT_SITE.contact || { intro: "", channels: [] }), ...(data?.contact || {}) };
    next.contact.channels = Array.isArray(data?.contact?.channels)
      ? data.contact.channels
      : clone(DEFAULT_SITE.contact?.channels || []);
    next.purchase = { ...clone(DEFAULT_SITE.purchase || { title: "購買與聯絡方式", intro: "", method: "", note: "" }), ...(data?.purchase || {}) };
    next.i18n = { ...clone(DEFAULT_SITE.i18n || {}), ...(data?.i18n || {}) };
    next.languages = Array.isArray(data?.languages)
      ? data.languages
      : clone(DEFAULT_SITE.languages || [
          { code: "zh-Hant", label: "繁體中文" },
          { code: "zh-Hans", label: "简体中文" },
          { code: "en", label: "English" }
        ]);
    if (!next.layout.language) next.layout.language = "zh-Hant";
    next.nav = Array.isArray(data?.nav) ? data.nav : clone(DEFAULT_SITE.nav);
    next.serviceBadges = Array.isArray(data?.serviceBadges)
      ? data.serviceBadges
      : clone(DEFAULT_SITE.serviceBadges);
    next.categories = Array.isArray(data?.categories)
      ? data.categories
      : clone(DEFAULT_SITE.categories);
    next.products = Array.isArray(data?.products) ? data.products : clone(DEFAULT_SITE.products);
    next.categories = next.categories.map((category, index) => ({
      id: slug(category.id || category.name || `category-${index + 1}`),
      name: category.name || "未命名分類",
      description: category.description || "",
      order: Number.isFinite(Number(category.order)) ? Number(category.order) : index
    }));
    next.products = next.products.map((product, index) => ({
      id: slug(product.id || product.name || `product-${index + 1}`),
      name: product.name || "未命名商品",
      category: product.category || "all",
      tags: Array.isArray(product.tags) ? product.tags : stringList(product.tags),
      price: Number(product.price) || 0,
      compareAt: Number(product.compareAt) || 0,
      priceCurrency: moneyCode(product.priceCurrency || product.currency || "TWD"),
      status: productStatusCode(product.status || inferProductStatus(product)),
      expectedExpiryDate: product.expectedExpiryDate || product.expiryDate || "",
      badge: product.badge || "",
      description: product.description || "",
      details: Array.isArray(product.details) ? product.details : stringList(product.details),
      stock: Number.isFinite(Number(product.stock)) ? Number(product.stock) : 0,
      order: Number.isFinite(Number(product.order)) ? Number(product.order) : index + 1,
      sprite: {
        col: clampInt(product.sprite?.col, 0, 3),
        row: clampInt(product.sprite?.row, 0, 2)
      },
      imageUrl: product.imageUrl || "",
      images: Array.isArray(product.images) ? product.images : stringList(product.images),
      videoUrl: product.videoUrl || ""
    }));
    return next;
  }

  async function fetchLiveSite() {
    try {
      const response = await fetch(`${LIVE_DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return normalizeSite(await response.json());
    } catch {
      return null;
    }
  }

  async function loadSite() {
    const liveSite = await fetchLiveSite();
    return liveSite || normalizeSite(DEFAULT_SITE);
  }

  function loadCart() {
    try {
      const stored = localStorage.getItem(CART_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  function persistSite(message = "") {
    localStorage.setItem(SITE_KEY, JSON.stringify(site));
    renderAll();
    if (message) toast(message);
  }

  function persistCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCart();
    renderCartCount();
  }

  function ensureBackup() {
    if (!localStorage.getItem(BACKUP_KEY)) {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(site));
    }
  }

  function slug(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || `item-${Date.now()}`;
  }

  function stringList(value) {
    if (Array.isArray(value)) return value;
    return String(value || "")
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function clampInt(value, min, max) {
    const number = Number.parseInt(value, 10);
    if (Number.isNaN(number)) return min;
    return Math.max(min, Math.min(max, number));
  }

  function setText(bind, value) {
    $$(`[data-bind="${bind}"]`).forEach((node) => {
      node.textContent = value ?? "";
    });
  }


  function currentLanguage() {
    return site.layout.language || "zh-Hant";
  }

  function languagePack(code = currentLanguage()) {
    return site.i18n?.[code] || site.i18n?.en || {};
  }

  function contentPack(code = currentLanguage()) {
    return languagePack(code);
  }

  function deepGet(source, path) {
    return String(path)
      .split(".")
      .reduce((value, key) => (value && value[key] !== undefined ? value[key] : undefined), source);
  }

  function tx(path, fallback = "") {
    const value = deepGet(contentPack(), path);
    return value === undefined || value === null || value === "" ? fallback : value;
  }

  function ui(key) {
    const value = languagePack().ui?.[key] ?? site.i18n?.en?.ui?.[key];
    return value || key;
  }

  function localizedNav(item, index) {
    return { ...item, ...(contentPack().nav?.[index] || {}) };
  }

  function localizedCategory(category) {
    return { ...category, ...(contentPack().categories?.[category.id] || {}) };
  }

  function localizedProduct(product) {
    return { ...product, ...(contentPack().products?.[product.id] || {}) };
  }

  function localizedBadge(badge, index) {
    return { ...badge, ...(contentPack().serviceBadges?.[index] || {}) };
  }

  function localizedFooterLink(link, index) {
    return { ...link, ...(contentPack().footer?.links?.[index] || {}) };
  }

  function renderI18nLabels() {
    document.documentElement.lang = currentLanguage();
    $$(`[data-i18n]`).forEach((node) => {
      node.textContent = ui(node.dataset.i18n);
    });
    $$(`[data-i18n-placeholder]`).forEach((node) => {
      node.placeholder = ui(node.dataset.i18nPlaceholder);
    });
    $$(`[data-i18n-aria-label]`).forEach((node) => {
      node.setAttribute("aria-label", ui(node.dataset.i18nAriaLabel));
    });
    $$(`[data-i18n-alt]`).forEach((node) => {
      node.setAttribute("alt", ui(node.dataset.i18nAlt));
    });
    $$(`[data-action="inline-search"], [data-action="drawer-search"]`).forEach((node) => {
      node.placeholder = ui("searchProducts");
    });
    
    const sortLabel = $(".sort-field span");
    if (sortLabel) sortLabel.textContent = ui("sort");
    const optionLabels = {
      manual: ui("featured"),
      newest: ui("newest"),
      "price-asc": ui("priceAsc"),
      "price-desc": ui("priceDesc"),
      name: ui("alphabetical")
    };
    $$(`[data-action="sort"] option`).forEach((option) => {
      option.textContent = optionLabels[option.value] || option.textContent;
    });
  }
  function applyTheme() {
    const root = document.documentElement;
    Object.entries(site.theme).forEach(([key, value]) => {
      root.style.setProperty(`--${kebab(key)}`, value);
    });
    root.style.setProperty("--desktop-columns", site.layout.desktopColumns || 4);
    root.style.setProperty("--tablet-columns", site.layout.tabletColumns || 3);
    root.style.setProperty("--mobile-columns", site.layout.mobileColumns || 2);
    const backdropModes = new Set(["soft", "plain", "grid", "image"]);
    const backdropImage = safeUrl(site.theme.backdropImageUrl || "");
    const backdropMode = backdropModes.has(site.theme.backdropMode) ? site.theme.backdropMode : "soft";
    root.dataset.backdropMode = backdropMode === "image" && !backdropImage ? "soft" : backdropMode;
    root.style.setProperty("--backdrop-color", site.theme.backdropColor || site.theme.background || "#fff8fb");
    root.style.setProperty("--backdrop-image", backdropImage ? `url("${backdropImage.replaceAll('"', "%22")}")` : "none");
    root.style.setProperty("--backdrop-image-opacity", Math.max(0, Math.min(1, Number(site.theme.backdropImageOpacity || 70) / 100)));
  }

  function kebab(value) {
    return String(value).replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
  }

  function renderAll() {
    applyTheme();
    renderStaticText();
    renderNav();
    renderCategories();
    renderProducts();
    renderBadges();
    renderFooter();
    renderPurchaseInfo();
    renderCartCount();
    renderSearchResults();
    syncBackTopVisibility();
    if (state.adminOpen) renderAdmin();
  }

  function renderStaticText() {
    setText("announcement", tx("announcement", site.announcement));
    setText("brand-mark", site.brand.mark);
    setText("brand-name", tx("brand.shortName", site.brand.shortName || site.brand.name));
    setText("brand-tagline", tx("brand.tagline", site.brand.tagline));
    setText("hero-eyebrow", tx("hero.eyebrow", site.hero.eyebrow));
    setText("hero-title", tx("hero.title", site.hero.title));
    setText("hero-subtitle", tx("hero.subtitle", site.hero.subtitle));
    setText("hero-cta", tx("hero.cta", site.hero.cta));
    setText("collection-title", tx("layout.collectionTitle", site.layout.collectionTitle));
    setText("collection-description", tx("layout.collectionDescription", site.layout.collectionDescription));
    setText("footer-title", tx("footer.title", site.footer.title));
    setText("footer-copy", tx("footer.copy", site.footer.copy));
    setText("purchase-title", tx("purchase.title", site.purchase?.title || "購買與聯絡方式"));
    setText("purchase-intro", tx("purchase.intro", site.purchase?.intro || ""));

    const language = $('[data-action="language"]');
    if (language) language.value = currentLanguage();
    const currency = $('[data-action="currency"]');
    if (currency) currency.value = site.layout.currency || "TWD";
    renderI18nLabels();
  }

  function renderNav() {
    const nav = $('[data-region="nav"]');
    if (!nav) return;
    nav.classList.toggle("is-open", state.menuOpen);
    nav.innerHTML = "";
    site.nav.forEach((item, index) => {
      const view = localizedNav(item, index);
      const link = document.createElement("a");
      link.href = item.target || "#products";
      link.textContent = view.label || ui("linkFallback");
      link.dataset.action = "nav";
      if (item.category) link.dataset.category = item.category;
      if (item.category === state.category) link.classList.add("is-active");
      nav.append(link);
    });

    const menuButton = $('[data-action="toggle-menu"]');
    if (menuButton) menuButton.setAttribute("aria-expanded", String(state.menuOpen));
  }

  function categoryDisplayLimit() {
    return window.matchMedia("(max-width: 760px)").matches ? 4 : 8;
  }

  function renderCategories() {
    const region = $('[data-region="categories"]');
    if (!region) return;
    region.innerHTML = "";
    const categories = getCategories();
    const limit = categoryDisplayLimit();
    const shouldCollapse = categories.length > limit;
    let visibleCategories = categories;
    if (shouldCollapse && !state.categoryExpanded) {
      visibleCategories = categories.slice(0, limit);
      const selected = categories.find((category) => category.id === state.category);
      if (selected && !visibleCategories.some((category) => category.id === selected.id)) {
        visibleCategories = [...visibleCategories.slice(0, Math.max(0, limit - 1)), selected];
      }
    }

    visibleCategories.forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-button";
      button.dataset.action = "set-category";
      button.dataset.category = category.id;
      button.classList.toggle("is-active", state.category === category.id);
      const count = productMatchesCategory(category.id).length;
      const view = localizedCategory(category);
      const hint = view.description || ui("categoryTileHint");
      const initial = String(view.name || "S").trim().slice(0, 1).toUpperCase();
      button.innerHTML = `<span class="filter-icon">${escapeHtml(initial)}</span><span class="filter-copy"><span>${escapeHtml(view.name)}</span><small>${escapeHtml(hint)}</small></span><strong>${count}</strong>`;
      region.append(button);
    });

    if (shouldCollapse) {
      const remaining = Math.max(0, categories.length - visibleCategories.length);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-button filter-more";
      button.dataset.action = "toggle-categories";
      const label = state.categoryExpanded ? ui("collapseCategories") : ui("showMoreCategories");
      const count = state.categoryExpanded ? categories.length : `+${remaining}`;
      button.innerHTML = `<span class="filter-icon">${state.categoryExpanded ? "-" : "+"}</span><span class="filter-copy"><span>${escapeHtml(label)}</span><small>${escapeHtml(ui("categoryMoreHint"))}</small></span><strong>${escapeHtml(count)}</strong>`;
      region.append(button);
    }
  }

  function renderProducts() {
    const region = $('[data-region="products"]');
    const resultLine = $('[data-bind="result-line"]');
    const inlineSearch = $('[data-action="inline-search"]');
    const sort = $('[data-action="sort"]');
    if (inlineSearch) inlineSearch.value = state.query;
    if (sort) sort.value = state.sort;
    if (!region) return;

    const products = getVisibleProducts();
    region.innerHTML = "";
    if (resultLine) {
      const category = getCategories().find((item) => item.id === state.category);
      const categoryView = category ? localizedCategory(category) : null;
      resultLine.textContent = `${products.length} ${ui("resultUnit")} ${
        categoryView?.name || tx("layout.collectionTitle", ui("allProducts"))
      }`;
    }

    if (!products.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = ui("noResults");
      region.append(empty);
      return;
    }

    products.forEach((product) => {
      const view = localizedProduct(product);
      const card = document.createElement("article");
      card.className = "product-card";
      const image = document.createElement("button");
      image.type = "button";
      image.className = "product-image";
      image.dataset.action = "quick-view";
      image.dataset.product = product.id;
      setProductImage(image, product);
      const mediaTotal = getProductImages(product).length + (product.videoUrl ? 1 : 0);
      if (mediaTotal > 1) {
        const mediaCount = document.createElement("span");
        mediaCount.className = "product-media-count";
        mediaCount.textContent = `${mediaTotal} ${ui("moreImages")}`;
        image.append(mediaCount);
      }
      const badgeText = productBadgeText(product, view);
      if (badgeText) {
        const badge = document.createElement("span");
        badge.className = "product-badge";
        badge.textContent = badgeText;
        image.append(badge);
      }

      const info = document.createElement("div");
      info.className = "product-info";
      const title = document.createElement("h3");
      title.textContent = view.name;
      const price = document.createElement("div");
      price.className = "price-row";
      price.innerHTML = `<strong>${formatPrice(product.price)}</strong>${
        product.compareAt ? `<del>${formatPrice(product.compareAt)}</del>` : ""
      }`;
      const quantity = document.createElement("div");
      quantity.innerHTML = productQuantityMarkup(product, true);
      const actions = document.createElement("div");
      actions.className = "card-actions";
      actions.innerHTML = `
        <button type="button" data-action="quick-view" data-product="${escapeHtml(product.id)}">${escapeHtml(ui("details"))}</button>
        <button type="button" data-action="add-cart" data-product="${escapeHtml(product.id)}">${escapeHtml(ui("addToCart"))}</button>
      `;

      info.append(title, price);
      const expiryText = productExpiryLine(product);
      if (expiryText) {
        const expiry = document.createElement("p");
        expiry.className = "product-expiry";
        expiry.textContent = expiryText;
        info.append(expiry);
      }
      info.append(quantity, actions);
      card.append(image, info);
      region.append(card);
    });
  }

  function renderBadges() {
    const region = $('[data-region="badges"]');
    if (!region) return;
    region.innerHTML = "";
    site.serviceBadges.forEach((badge, index) => {
      const view = localizedBadge(badge, index);
      const item = document.createElement("article");
      item.className = "service-badge";
      item.innerHTML = `<h3>${escapeHtml(view.title)}</h3><p>${escapeHtml(view.copy)}</p>`;
      region.append(item);
    });
  }

  function renderFooter() {
    const region = $('[data-region="footer-links"]');
    if (!region) return;
    region.innerHTML = "";
    site.footer.links.forEach((link, index) => {
      const view = localizedFooterLink(link, index);
      const anchor = document.createElement("a");
      anchor.href = safeUrl(link.target) || "#products";
      anchor.textContent = view.label || ui("linkFallback");
      region.append(anchor);
    });
  }

  function renderPurchaseInfo() {
    const panel = $('[data-region="purchase-panel"]');
    if (!panel) return;
    const method = tx("purchase.method", site.purchase?.method || "");
    const note = tx("purchase.note", site.purchase?.note || "");
    const channels = site.contact?.channels || [];
    panel.innerHTML = `
      <article class="purchase-card is-featured">
        <h3>${escapeHtml(ui("purchaseTabMethod"))}</h3>
        <p>${escapeHtml(method)}</p>
        ${note ? `<small>${escapeHtml(note)}</small>` : ""}
        <button class="primary-button" type="button" data-action="open-contact">${escapeHtml(ui("contactToBuy"))}</button>
      </article>
      <article class="purchase-card">
        <h3>${escapeHtml(ui("purchaseTabContact"))}</h3>
        <div class="purchase-links">
          ${channels.map((channel) => {
            const href = safeUrl(channel.url) || "#";
            const attrs = href !== "#" ? 'target="_blank" rel="noopener noreferrer"' : "";
            return `<a href="${escapeHtml(href)}" ${attrs}><strong>${escapeHtml(channel.label || ui("contactLinkFallback"))}</strong><span>${escapeHtml(channel.note || href)}</span></a>`;
          }).join("") || `<span class="empty-inline">${escapeHtml(ui("noContact"))}</span>`}
        </div>
      </article>
    `;
  }

  function getCategories() {
    return [...site.categories].sort((a, b) => Number(a.order) - Number(b.order));
  }

  function getProducts() {
    return [...site.products].sort((a, b) => Number(a.order) - Number(b.order));
  }

  function productMatchesCategory(categoryId) {
    if (categoryId === "all") return getProducts();
    return getProducts().filter((product) => {
      const tags = Array.isArray(product.tags) ? product.tags : [];
      const status = productStatusCode(product.status || inferProductStatus(product));
      const directMatch = product.category === categoryId || tags.includes(categoryId);
      if (categoryId === "popular") return directMatch || status === "popular" || status === "bestSeller";
      if (categoryId === "new") return directMatch || status === "new";
      return directMatch;
    });
  }

  function getVisibleProducts() {
    const query = state.query.trim().toLowerCase();
    let products = productMatchesCategory(state.category);
    if (query) {
      products = products.filter((product) => {
        const view = localizedProduct(product);
        const category = site.categories.find((item) => item.id === product.category);
        const categoryView = category ? localizedCategory(category) : null;
        const haystack = [
          view.name,
          product.category,
          categoryView?.name,
          view.description,
          view.badge,
          ...product.tags,
          ...(view.details || [])
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
    }
    return sortProducts(products, state.sort);
  }

  function sortProducts(products, sort) {
    const list = [...products];
    if (sort === "price-asc") return list.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") return list.sort((a, b) => b.price - a.price);
    if (sort === "name") return list.sort((a, b) => localizedProduct(a).name.localeCompare(localizedProduct(b).name));
    if (sort === "newest") return list.sort((a, b) => b.order - a.order);
    return list.sort((a, b) => a.order - b.order);
  }

  function findProduct(id) {
    return site.products.find((product) => product.id === id);
  }

  function getProductImages(product) {
    const urls = [product.imageUrl, ...(Array.isArray(product.images) ? product.images : stringList(product.images))]
      .map((url) => safeUrl(url))
      .filter(Boolean);
    return [...new Set(urls)];
  }

  function setProductImage(node, product, imageUrl = "") {
    const url = safeUrl(imageUrl) || getProductImages(product)[0] || "";
    node.classList.remove("is-sprite", "is-custom");
    node.style.backgroundImage = "";
    node.style.backgroundPosition = "";
    if (url) {
      node.classList.add("is-custom");
      node.style.backgroundImage = `url("${url.replaceAll('"', "%22")}")`;
      return;
    }
    node.classList.add("is-sprite");
    const col = clampInt(product.sprite?.col, 0, 3);
    const row = clampInt(product.sprite?.row, 0, 2);
    node.style.backgroundPosition = `${(col / 3) * 100}% ${(row / 2) * 100}%`;
  }

  function videoEmbedUrl(value) {
    const url = safeUrl(value);
    if (!url) return "";
    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.hostname.includes("youtube.com")) {
        const id = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop();
        return id ? `https://www.youtube.com/embed/${id}` : "";
      }
      if (parsed.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
      if (parsed.hostname.includes("vimeo.com")) return `https://player.vimeo.com/video/${parsed.pathname.split("/").filter(Boolean).pop()}`;
    } catch {}
    return "";
  }

  function formatPriceInCurrency(value, code = site.layout.currency || "TWD") {
    const currencyCode = moneyCode(code);
    const config = money[currencyCode];
    const converted = currencyFromBase(value, currencyCode);
    const fraction = currencyCode === "TWD" ? 0 : 2;
    return `${config.symbol}${converted.toLocaleString(undefined, {
      minimumFractionDigits: fraction,
      maximumFractionDigits: fraction
    })}`;
  }

  function formatPrice(value) {
    return formatPriceInCurrency(value, site.layout.currency || "TWD");
  }

  function productInputCurrency(product) {
    return moneyCode(product?.priceCurrency || site.layout.currency || "TWD");
  }

  function productQuantityMarkup(product, compact = false) {
    const max = product.stock > 0 ? Math.min(Number(product.stock) || 99, 99) : 99;
    return `
      <div class="quantity-picker ${compact ? "is-compact" : ""}" data-qty-scope="${escapeHtml(product.id)}">
        <span>${escapeHtml(ui("quantity"))}</span>
        <div class="quantity-stepper">
          <button type="button" data-action="qty-dec" data-product="${escapeHtml(product.id)}" aria-label="${escapeHtml(ui("decreaseQuantity"))}">-</button>
          <input type="number" inputmode="numeric" min="1" max="${max}" value="1" data-qty-product="${escapeHtml(product.id)}" aria-label="${escapeHtml(ui("quantity"))}" />
          <button type="button" data-action="qty-inc" data-product="${escapeHtml(product.id)}" aria-label="${escapeHtml(ui("increaseQuantity"))}">+</button>
        </div>
      </div>
    `;
  }

  function quantityInput(productId, root = document) {
    return $$(`[data-qty-product]`, root).find((node) => node.dataset.qtyProduct === productId);
  }

  function selectedQuantity(productId, trigger = null) {
    const root = trigger?.closest?.(".product-card, .quick-content, dialog") || document;
    const input = quantityInput(productId, root) || quantityInput(productId);
    const max = Number(input?.max || 99) || 99;
    const value = clampInt(input?.value || 1, 1, max);
    if (input) input.value = value;
    return value;
  }

  function adjustProductQuantity(productId, delta, trigger = null) {
    const root = trigger?.closest?.(".product-card, .quick-content, dialog") || document;
    const input = quantityInput(productId, root) || quantityInput(productId);
    if (!input) return;
    const max = Number(input.max || 99) || 99;
    input.value = clampInt(Number(input.value || 1) + delta, 1, max);
  }

  function productCurrencyAmount(product, field) {
    return roundMoney(currencyFromBase(product?.[field] || 0, productInputCurrency(product)));
  }

  function statusLabel(code) {
    return ui(`status_${productStatusCode(code)}`);
  }

  function productBadgeText(product, view = localizedProduct(product)) {
    const status = productStatusCode(product.status || inferProductStatus(product));
    if (status === "none") return "";
    if (status === "custom") return view?.badge || product.badge || "";
    return statusLabel(status);
  }

  function syncProductStatusTags(product) {
    const status = productStatusCode(product.status || inferProductStatus(product));
    const reserved = new Set(["new", "popular", "preorder", "limited", "sale", "soldout"]);
    const tags = Array.isArray(product.tags) ? product.tags : stringList(product.tags);
    product.tags = tags.map(slug).filter((tag) => tag && !reserved.has(tag));
    if (status === "new") product.tags.push("new");
    if (status === "popular" || status === "bestSeller") product.tags.push("popular");
    if (status === "preorder") product.tags.push("preorder");
    if (status === "limited") product.tags.push("limited");
    if (status === "sale") product.tags.push("sale");
    if (status === "soldout") product.tags.push("soldout");
    product.tags = [...new Set(product.tags)];
  }

  function formatDisplayDate(value) {
    if (!value) return "";
    const text = String(value).split("T")[0];
    const parts = text.split("-");
    if (parts.length === 3 && parts.every(Boolean)) return `${parts[0]}/${parts[1]}/${parts[2]}`;
    return text;
  }

  function productExpiryLine(product) {
    const date = formatDisplayDate(product.expectedExpiryDate || product.expiryDate);
    return date ? `${ui("expectedExpiryDate")}: ${date}` : "";
  }

  function addToCart(id, qty = 1) {
    const product = findProduct(id);
    if (!product) return;
    const amount = clampInt(qty, 1, 99);
    const existing = cart.find((item) => item.id === id);
    if (existing) existing.qty += amount;
    else cart.push({ id, qty: amount });
    persistCart();
    toast(`${localizedProduct(product).name} x ${amount} ${ui("cartAdded")}`);
  }

  function changeCart(id, delta) {
    const item = cart.find((entry) => entry.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) cart = cart.filter((entry) => entry.id !== id);
    persistCart();
  }

  function renderCartCount() {
    const count = cart.reduce((total, item) => total + Number(item.qty || 0), 0);
    setText("cart-count", count);
  }

  function cartSummaryText() {
    if (!cart.length) return "";
    const lines = cart
      .map((entry, index) => {
        const product = findProduct(entry.id);
        if (!product) return "";
        const view = localizedProduct(product);
        return `${index + 1}. ${view.name} x ${entry.qty} - ${formatPrice(product.price * entry.qty)}`;
      })
      .filter(Boolean);
    const total = cart.reduce((sum, entry) => {
      const product = findProduct(entry.id);
      return product ? sum + product.price * entry.qty : sum;
    }, 0);
    return [`${ui("copyInquiryIntro")}`, ...lines, `${ui("copyInquiryTotal")} ${formatPrice(total)}`].join("\n");
  }

  async function copyCartSummary() {
    const text = cartSummaryText();
    if (!text) {
      toast(ui("cartCopyEmpty"));
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    toast(ui("cartCopied"));
  }

  function renderCart() {
    const region = $('[data-region="cart-items"]');
    const total = $('[data-bind="cart-total"]');
    if (!region) return;
    region.innerHTML = "";
    let sum = 0;

    if (!cart.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = ui("cartEmpty");
      region.append(empty);
    } else {
      cart.forEach((entry) => {
        const product = findProduct(entry.id);
        if (!product) return;
        sum += product.price * entry.qty;
        const view = localizedProduct(product);
        const item = document.createElement("article");
        item.className = "cart-item";
        const thumb = document.createElement("div");
        thumb.className = "mini-thumb";
        setProductImage(thumb, product);
        const copy = document.createElement("div");
        copy.innerHTML = `
          <h3>${escapeHtml(view.name)}</h3>
          <p>${formatPrice(product.price)} × ${entry.qty}</p>
          <div class="cart-line-actions">
            <button class="quantity-button" type="button" data-action="cart-dec" data-product="${escapeHtml(
              product.id
            )}">−</button>
            <input class="cart-qty-input" type="number" inputmode="numeric" min="1" max="99" value="${entry.qty}" data-action="cart-qty" data-product="${escapeHtml(product.id)}" aria-label="${escapeHtml(ui("quantity"))}" />
            <button class="quantity-button" type="button" data-action="cart-inc" data-product="${escapeHtml(
              product.id
            )}">+</button>
            <button class="admin-small" type="button" data-action="cart-remove" data-product="${escapeHtml(
              product.id
            )}">${escapeHtml(ui("remove"))}</button>
          </div>
        `;
        item.append(thumb, copy);
        region.append(item);
      });
    }

    if (total) total.textContent = formatPrice(sum);
  }

  function renderSearchResults() {
    const region = $('[data-region="search-results"]');
    if (!region) return;
    const query = state.drawerQuery.trim().toLowerCase();
    region.innerHTML = "";
    if (!query) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = ui("noSearchStart");
      region.append(empty);
      return;
    }

    const products = getProducts().filter((product) => {
      const view = localizedProduct(product);
      return [view.name, view.description, product.category, ...product.tags]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

    if (!products.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = ui("noResults");
      region.append(empty);
      return;
    }

    products.slice(0, 8).forEach((product) => {
      const view = localizedProduct(product);
      const item = document.createElement("article");
      item.className = "mini-product";
      const thumb = document.createElement("div");
      thumb.className = "mini-thumb";
      setProductImage(thumb, product);
      const copy = document.createElement("div");
      copy.innerHTML = `
        <h3>${escapeHtml(view.name)}</h3>
        <p>${formatPrice(product.price)}</p>
        <button class="admin-small" type="button" data-action="quick-view" data-product="${escapeHtml(
          product.id
        )}">${escapeHtml(ui("view"))}</button>
      `;
      item.append(thumb, copy);
      region.append(item);
    });
  }

  function contactChannelsToText() {
    return (site.contact?.channels || [])
      .map((item) => `${item.label || ""} | ${item.url || ""} | ${item.note || ""}`)
      .join("\n");
  }

  function parseContactChannels(text) {
    return String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [label, url, note] = line.split("|").map((part) => part.trim());
        return { id: slug(label || `contact-${index + 1}`), label: label || `${ui("contactLinkFallback")} ${index + 1}`, url: url || "#", note: note || "" };
      });
  }

  function openContact(productId = "") {
    if (productId) state.contactProductId = productId;
    renderContactOptions();
    openDialog("contactDrawer");
  }

  function renderContactOptions() {
    const product = state.contactProductId ? findProduct(state.contactProductId) : null;
    const productView = product ? localizedProduct(product) : null;
    const productLine = $('[data-region="contact-product"]');
    if (productLine) {
      productLine.textContent = productView ? `${ui("selectedProductPrefix")} ${productView.name}` : "";
    }
    const introLine = $('[data-region="contact-intro"]');
    if (introLine) introLine.textContent = tx("contact.intro", site.contact?.intro || ui("contactIntro"));
    const methodLine = $('[data-region="purchase-method"]');
    if (methodLine) {
      methodLine.textContent = tx("purchase.method", site.purchase?.method || "");
      methodLine.hidden = !methodLine.textContent.trim();
    }
    const region = $('[data-region="contact-options"]');
    if (!region) return;
    region.innerHTML = "";
    const channels = site.contact?.channels || [];
    if (!channels.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = ui("noContact");
      region.append(empty);
      return;
    }
    channels.forEach((channel) => {
      const href = safeUrl(channel.url) || "#";
      const link = document.createElement("a");
      link.className = "contact-option";
      link.href = href;
      if (href !== "#") {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      link.innerHTML = `<strong>${escapeHtml(channel.label || ui("contactLinkFallback"))}</strong><span>${escapeHtml(channel.note || href)}</span>`;
      region.append(link);
    });
  }

  function openQuickView(id) {
    const product = findProduct(id);
    const view = product ? localizedProduct(product) : null;
    const dialog = $("#quickView");
    if (!product || !dialog || !view) return;
    dialog.innerHTML = "";
    const images = getProductImages(product);
    const embedUrl = videoEmbedUrl(product.videoUrl);

    const wrap = document.createElement("div");
    wrap.className = "quick-content detail-page";
    const media = document.createElement("div");
    media.className = "quick-gallery";
    const main = document.createElement("div");
    main.className = "quick-media";
    setProductImage(main, product, images[0]);
    media.append(main);

    if (images.length > 1) {
      const thumbs = document.createElement("div");
      thumbs.className = "quick-thumbs";
      images.forEach((url, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `quick-thumb ${index === 0 ? "is-active" : ""}`;
        button.dataset.action = "select-detail-image";
        button.dataset.product = product.id;
        button.dataset.image = url;
        setProductImage(button, product, url);
        thumbs.append(button);
      });
      media.append(thumbs);
    }

    if (product.videoUrl) {
      const video = document.createElement("div");
      video.className = "quick-video";
      video.innerHTML = embedUrl
        ? `<iframe src="${escapeHtml(embedUrl)}" title="${escapeHtml(view.name)} ${escapeHtml(ui("videoLink"))}" loading="lazy" allowfullscreen></iframe>`
        : `<a class="secondary-button" href="${escapeHtml(safeUrl(product.videoUrl))}" target="_blank" rel="noopener noreferrer">${escapeHtml(ui("openVideo"))}</a>`;
      media.append(video);
    }

    const copy = document.createElement("div");
    copy.className = "quick-copy";
    copy.innerHTML = `
      <form method="dialog" class="drawer-head">
        <h2>${escapeHtml(view.name)}</h2>
        <button class="icon-button" type="submit" aria-label="${escapeHtml(ui("closeProductDetail"))}">×</button>
      </form>
      <div class="price-row">
        <strong>${formatPrice(product.price)}</strong>
        ${product.compareAt ? `<del>${formatPrice(product.compareAt)}</del>` : ""}
      </div>
      <p>${escapeHtml(view.description)}</p>
      <ul class="detail-list">
        ${(view.details || []).map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}
      </ul>
      ${productExpiryLine(product) ? `<p class="detail-expiry">${escapeHtml(productExpiryLine(product))}</p>` : ""}
      <p>${product.stock > 0 ? `${product.stock} ${ui("stockLine")}` : ui("outOfStock")}</p>
      <section class="quick-buy-note">
        <h3>${escapeHtml(tx("purchase.title", site.purchase?.title || ui("purchaseTabMethod")))}</h3>
        <p>${escapeHtml(tx("purchase.method", site.purchase?.method || ""))}</p>
      </section>
      ${productQuantityMarkup(product)}
      <div class="quick-actions">
        <button class="primary-button" type="button" data-action="add-cart" data-product="${escapeHtml(product.id)}">${escapeHtml(ui("addToCart"))}</button>
        <button class="secondary-button" type="button" data-action="open-cart">${escapeHtml(ui("openInquiryList"))}</button>
      </div>
    `;
    wrap.append(media, copy);
    dialog.append(wrap);
    dialog.showModal();
  }

  function openDialog(id) {
    const dialog = document.getElementById(id);
    if (!dialog) return;
    if (id === "cartDrawer") renderCart();
    if (id === "searchDrawer") renderSearchResults();
    if (id === "contactDrawer") renderContactOptions();
    dialog.showModal();
  }

  function openAdminGate() {
    if (localStorage.getItem(ADMIN_KEY) === "true") {
      openAdmin();
      return;
    }
    const dialog = $("#adminGate");
    if (dialog) dialog.showModal();
  }

  function openAdmin() {
    state.adminOpen = true;
    if (!state.selectedProductId && site.products[0]) {
      state.selectedProductId = site.products[0].id;
    }
    renderAdmin();
    toast("已進入 showmii 管理頁。");
  }

  function closeAdmin() {
    state.adminOpen = false;
    const panel = $('[data-region="admin-panel"]');
    if (panel) {
      panel.hidden = true;
      panel.innerHTML = "";
    }
  }

  function renderAdmin() {
    const panel = $('[data-region="admin-panel"]');
    if (!panel) return;
    panel.hidden = false;
    const tabs = [
      ["quick", "快速設定"],
      ["products", "商品"],
      ["categories", "分類"],
      ["contact", "購買/聯絡"],
      ["layout", "版面/頁尾"],
      ["style", "美術"],
      ["json", "備份/匯入"]
    ];
    panel.innerHTML = `
      <div class="admin-shell">
        <header class="admin-header">
          <div>
            <h2>showmii 管理頁</h2>
            <p>可編輯前台文案、商品、分類、購買方式、聯絡平台、版面與色彩。</p>
          </div>
          <div class="admin-actions">
            <button class="admin-small" type="button" data-action="admin-logout">鎖定</button>
            <button class="icon-button" type="button" data-action="admin-close" aria-label="關閉管理頁">×</button>
          </div>
        </header>
        <div class="admin-tabs">
          ${tabs
            .map(
              ([id, label]) =>
                `<button class="admin-tab ${state.adminTab === id ? "is-active" : ""}" type="button" data-action="admin-tab" data-tab="${id}">${label}</button>`
            )
            .join("")}
        </div>
        <div class="admin-body">${renderAdminTab()}</div>
      </div>
    `;
  }

  function renderAdminTab() {
    if (state.adminTab === "products") return renderProductsAdmin();
    if (state.adminTab === "categories") return renderCategoriesAdmin();
    if (state.adminTab === "contact") return renderContactAdmin();
    if (state.adminTab === "layout") return renderLayoutAdmin();
    if (state.adminTab === "style") return renderSettingsAdmin();
    if (state.adminTab === "json") return renderJsonAdmin();
    return renderQuickAdmin();
  }

  function renderQuickAdmin() {
    return `
      <form class="admin-form">
        <section class="admin-section">
          <h3>1. 基本資料與帳號</h3>
          <div class="admin-grid">
            ${input("店名", "brand.name", site.brand.name)}
            ${input("顯示店名", "brand.shortName", site.brand.shortName)}
            ${input("Logo 字母", "brand.mark", site.brand.mark)}
            ${input("品牌短句", "brand.tagline", site.brand.tagline)}
            ${input("管理員帳號", "admin.username", site.admin.username || "showmii")}
            ${input("管理員密碼", "admin.passcode", site.admin.passcode, "password")}
          </div>
          <label>
            <span>預設語言</span>
            <select data-admin-path="layout.language">
              ${(site.languages || [])
                .map(
                  (language) =>
                    `<option value="${escapeHtml(language.code)}" ${currentLanguage() === language.code ? "selected" : ""}>${escapeHtml(
                      language.label
                    )}</option>`
                )
                .join("")}
            </select>
          </label>
          ${input("公告文字", "announcement", site.announcement)}
          ${input("商品區標題", "layout.collectionTitle", site.layout.collectionTitle)}
          ${textarea("商品區說明", "layout.collectionDescription", site.layout.collectionDescription)}
        </section>
        <section class="admin-section">
          <h3>2. 首頁文字</h3>
          ${input("小標", "hero.eyebrow", site.hero.eyebrow)}
          ${input("大標題", "hero.title", site.hero.title)}
          ${textarea("說明文字", "hero.subtitle", site.hero.subtitle)}
          ${input("按鈕文字", "hero.cta", site.hero.cta)}
        </section>
        <section class="admin-section">
          <h3>3. 購買方式與聯絡平台</h3>
          ${input("購買區標題", "purchase.title", site.purchase?.title || "購買與聯絡方式")}
          ${textarea("購買區說明", "purchase.intro", site.purchase?.intro || "")}
          ${textarea("購買方式說明", "purchase.method", site.purchase?.method || "")}
          ${textarea("補充備註", "purchase.note", site.purchase?.note || "")}
          ${textarea("聯絡視窗說明", "contact.intro", site.contact?.intro || "")}
          <p class="admin-note">每一行一個平台：名稱 | 網址 | 備註。例：LINE | https://line.me/R/ti/p/@你的ID | 加 LINE 詢問</p>
          ${textarea("外部聯絡網站", "list.contactChannels", contactChannelsToText())}
        </section>
        <section class="admin-section">
          <h3>4. 頁尾與色彩</h3>
          ${input("頁尾標題", "footer.title", site.footer.title)}
          ${textarea("頁尾說明", "footer.copy", site.footer.copy)}
          <div class="admin-grid">
            ${input("主色", "theme.primary", site.theme.primary, "color")}
            ${input("輔色", "theme.accent", site.theme.accent, "color")}
            ${input("亮點色", "theme.highlight", site.theme.highlight, "color")}
            ${input("背景色", "theme.background", site.theme.background, "color")}
          </div>
        </section>
        <section class="admin-section">
          <h3>5. 常用操作</h3>
          <div class="admin-toolbar">
            <button class="primary-button" type="button" data-action="admin-tab" data-tab="products">編輯商品</button>
            <button class="secondary-button" type="button" data-action="admin-tab" data-tab="categories">編輯分類</button>
            <button class="secondary-button" type="button" data-action="admin-tab" data-tab="layout">版面/頁尾</button>
            <button class="secondary-button" type="button" data-action="admin-tab" data-tab="json">備份/匯入</button>
          </div>
        </section>
      </form>
    `;
  }

  function backdropModeSelect() {
    const modes = [
      ["soft", "\u67d4\u9727\u80cc\u677f"],
      ["plain", "\u7d14\u8272\u80cc\u677f"],
      ["grid", "\u683c\u7d0b\u80cc\u677f"],
      ["image", "\u5716\u7247\u80cc\u677f"]
    ];
    return `
      <label>
        <span>\u80cc\u677f\u6a23\u5f0f</span>
        <select data-admin-path="theme.backdropMode">
          ${modes.map(([id, label]) => `<option value="${id}" ${site.theme.backdropMode === id ? "selected" : ""}>${label}</option>`).join("")}
        </select>
      </label>
    `;
  }

  function renderSettingsAdmin() {
    const themeLabels = { background: "\u80cc\u666f\u8272", surface: "\u5361\u7247\u8272", text: "\u6587\u5b57\u8272", muted: "\u8f14\u52a9\u6587\u5b57", primary: "\u4e3b\u8272", accent: "\u8f14\u8272", highlight: "\u4eae\u9ede\u8272", border: "\u7dda\u689d\u8272", backdropColor: "\u80cc\u677f\u5e95\u8272" };
    const colorFields = Object.entries(site.theme)
      .filter(([, value]) => /^#[0-9a-f]{3,8}$/i.test(String(value)))
      .map(([key, value]) => `
          <label>
            <span>${escapeHtml(themeLabels[key] || labelize(key))}</span>
            <input type="color" value="${escapeHtml(value)}" data-admin-path="theme.${key}" />
          </label>`)
      .join("");

    return `
      <form class="admin-form">
        <section class="admin-section">
          <h3>品牌與管理員</h3>
          <div class="admin-grid">
            ${input("店名", "brand.name", site.brand.name)}
            ${input("顯示店名", "brand.shortName", site.brand.shortName)}
            ${input("Logo 字母", "brand.mark", site.brand.mark)}
            ${input("品牌短句", "brand.tagline", site.brand.tagline)}
            ${input("管理員帳號", "admin.username", site.admin.username || "showmii")}
            ${input("管理員密碼", "admin.passcode", site.admin.passcode, "password")}
          </div>
          ${input("公告文字", "announcement", site.announcement)}
        </section>
        <section class="admin-section">
          <h3>首頁主視覺</h3>
          ${input("小標", "hero.eyebrow", site.hero.eyebrow)}
          ${input("大標題", "hero.title", site.hero.title)}
          ${textarea("說明文字", "hero.subtitle", site.hero.subtitle)}
          ${input("按鈕文字", "hero.cta", site.hero.cta)}
        </section>
        <section class="admin-section">
          <h3>商品區</h3>
          ${input("商品區標題", "layout.collectionTitle", site.layout.collectionTitle)}
          ${textarea("商品區說明", "layout.collectionDescription", site.layout.collectionDescription)}
        </section>
        <section class="admin-section">
          <h3>\u7db2\u7ad9\u80cc\u677f</h3>
          <div class="admin-grid">
            ${backdropModeSelect()}
            ${input("\u80cc\u677f\u5e95\u8272", "theme.backdropColor", site.theme.backdropColor || site.theme.background || "#fff8fb", "color")}
            ${input("\u80cc\u677f\u5716\u7247\u7db2\u5740", "theme.backdropImageUrl", site.theme.backdropImageUrl || "")}
            ${input("\u5716\u7247\u986f\u793a\u5f37\u5ea6\uff080-100\uff09", "theme.backdropImageOpacity", site.theme.backdropImageOpacity || 70, "number", 0, 100)}
          </div>
          <p class="admin-note">\u9078\u300c\u5716\u7247\u80cc\u677f\u300d\u6642\uff0c\u586b\u5165 https \u5716\u7247\u7db2\u5740\u5373\u53ef\u66ff\u63db\u7db2\u7ad9\u80cc\u677f\u3002\u5206\u985e\u904e\u591a\u6642\u524d\u53f0\u6703\u81ea\u52d5\u6536\u5408\u3002</p>
        </section>
        <section class="admin-section">
          <h3>\u7db2\u7ad9\u8272\u5f69</h3>
          <div class="admin-grid">${colorFields}</div>
        </section>
      </form>
    `;
  }

  function renderLayoutAdmin() {
    return `
      <form class="admin-form">
        <section class="admin-section">
          <h3>商品區與幣別</h3>
          <div class="admin-grid">
            ${input("桌機欄數", "layout.desktopColumns", site.layout.desktopColumns, "number", 1, 6)}
            ${input("平板欄數", "layout.tabletColumns", site.layout.tabletColumns, "number", 1, 4)}
            ${input("手機欄數", "layout.mobileColumns", site.layout.mobileColumns, "number", 1, 2)}
            ${input("活動文字", "layout.ribbonText", site.layout.ribbonText)}
          </div>
          <div class="admin-grid">
            <label><span>預設幣別</span><select data-admin-path="layout.currency">${Object.entries(money).map(([code, config]) => `<option value="${code}" ${site.layout.currency === code ? "selected" : ""}>${escapeHtml(config.label)}</option>`).join("")}</select></label>
            <label><span>預設語言</span><select data-admin-path="layout.language">${(site.languages || []).map((language) => `<option value="${escapeHtml(language.code)}" ${currentLanguage() === language.code ? "selected" : ""}>${escapeHtml(language.label)}</option>`).join("")}</select></label>
          </div>
          ${input("商品區標題", "layout.collectionTitle", site.layout.collectionTitle)}
          ${textarea("商品區說明", "layout.collectionDescription", site.layout.collectionDescription)}
        </section>
        <section class="admin-section">
          <h3>導覽與服務亮點</h3>
          ${textarea("導覽列：標籤 | 連結 | 分類 ID（可留空）", "list.nav", navToText())}
          ${textarea("服務亮點：標題 | 內容", "list.badges", badgesToText())}
        </section>
        <section class="admin-section">
          <h3>頁尾</h3>
          ${input("頁尾標題", "footer.title", site.footer.title)}
          ${textarea("頁尾說明", "footer.copy", site.footer.copy)}
          ${textarea("頁尾連結：標籤 | 連結", "list.footerLinks", footerLinksToText())}
        </section>
      </form>
    `;
  }

  function renderContactAdmin() {
    return `
      <form class="admin-form">
        <section class="admin-section">
          <h3>購買方式與聯絡平台</h3>
          <p class="admin-note">購買方式會顯示在前台「購買與聯絡方式」區塊，也會同步顯示在「聯繫購買」視窗中。</p>
          ${input("購買區標題", "purchase.title", site.purchase?.title || "購買與聯絡方式")}
          ${textarea("購買區說明", "purchase.intro", site.purchase?.intro || "")}
          ${textarea("購買方式說明", "purchase.method", site.purchase?.method || "")}
          ${textarea("補充備註", "purchase.note", site.purchase?.note || "")}
          ${textarea("聯絡視窗說明", "contact.intro", site.contact?.intro || "")}
          ${textarea("外部聯絡網站", "list.contactChannels", contactChannelsToText())}
        </section>
      </form>
    `;
  }
  function renderCategoriesAdmin() {
    return `
      <div class="admin-form">
        <div class="admin-toolbar">
          <button class="primary-button" type="button" data-action="admin-add-category">新增分類</button>
        </div>
        <div class="admin-list">
          ${getCategories()
            .map((category) => {
              const index = site.categories.findIndex((item) => item.id === category.id);
              return `
                <article class="admin-item">
                  <div class="admin-inline">
                    ${categoryInput("分類名稱", index, "name", category.name)}
                    ${categoryInput("ID", index, "id", category.id)}
                    ${categoryInput("排序", index, "order", category.order, "number")}
                  </div>
                  ${categoryTextarea("分類說明", index, "description", category.description)}
                  <div class="admin-row-actions">
                    <button class="admin-small" type="button" data-action="category-up" data-index="${index}">上移</button>
                    <button class="admin-small" type="button" data-action="category-down" data-index="${index}">下移</button>
                    <button class="admin-danger" type="button" data-action="category-delete" data-index="${index}">刪除</button>
                  </div>
                </article>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  function renderProductsAdmin() {
    if (!site.products.length) {
      return `
        <div class="admin-form">
          <button class="primary-button" type="button" data-action="admin-add-product">新增商品</button>
        </div>
      `;
    }

    const selected = findProduct(state.selectedProductId) || site.products[0];
    state.selectedProductId = selected.id;
    const index = site.products.findIndex((product) => product.id === selected.id);
    const selectedView = localizedProduct(selected);
    return `
      <div class="admin-form">
        <section class="admin-section">
          <h3>商品選擇</h3>
          <div class="admin-grid">
            <label>
              <span>選擇商品</span>
              <select data-action="admin-select-product">
                ${getProducts()
                  .map((product) => {
                    const productView = localizedProduct(product);
                    return `<option value="${escapeHtml(product.id)}" ${
                      product.id === selected.id ? "selected" : ""
                    }>${escapeHtml(productView.name)}</option>`;
                  })
                  .join("")}
              </select>
            </label>
            <label>
              <span>分類</span>
              <select data-product-index="${index}" data-product-field="category">
                ${getCategories()
                  .filter((category) => category.id !== "all")
                  .map((category) => {
                    const categoryView = localizedCategory(category);
                    return `<option value="${escapeHtml(category.id)}" ${
                      selected.category === category.id ? "selected" : ""
                    }>${escapeHtml(categoryView.name)}</option>`;
                  })
                  .join("")}
              </select>
            </label>
          </div>
          <div class="admin-row-actions">
            <button class="primary-button" type="button" data-action="admin-add-product">新增商品</button>
            <button class="secondary-button" type="button" data-action="product-duplicate" data-index="${index}">複製</button>
            <button class="admin-small" type="button" data-action="product-up" data-index="${index}">上移</button>
            <button class="admin-small" type="button" data-action="product-down" data-index="${index}">下移</button>
            <button class="admin-danger" type="button" data-action="product-delete" data-index="${index}">刪除</button>
          </div>
        </section>
        <section class="admin-section">
          <h3>商品內容</h3>
          <div class="admin-grid">
            ${productInput("\u5546\u54c1\u540d\u7a31", index, "name", selectedView.name)}
            ${productInput("ID", index, "id", selected.id)}
            ${productStatusSelect("\u5546\u54c1\u72c0\u614b\u6a19\u7c64", index, selected)}
            ${productInput("\u9810\u8a08\u5230\u671f\u65e5", index, "expectedExpiryDate", selected.expectedExpiryDate || "", "date")}
            ${productCurrencySelect("價格輸入幣別", index, selected)}
            ${productInput("售價（依上方幣別輸入）", index, "price", productCurrencyAmount(selected, "price"), "number", 0, "0.01")}
            ${productInput("原價（依上方幣別輸入）", index, "compareAt", productCurrencyAmount(selected, "compareAt"), "number", 0, "0.01")}
            ${productInput("\u81ea\u8a02\u6a19\u7c64\u6587\u5b57", index, "badge", selectedView.badge || selected.badge)}
            ${productInput("庫存", index, "stock", selected.stock, "number", 0)}
            ${productInput("排序", index, "order", selected.order, "number", 0)}
            ${productInput("主圖網址", index, "imageUrl", selected.imageUrl)}
            ${productInput("影片連結", index, "videoUrl", selected.videoUrl)}
            ${spriteInput("內建圖片欄 0-3", index, "col", selected.sprite?.col || 0)}
            ${spriteInput("內建圖片列 0-2", index, "row", selected.sprite?.row || 0)}
          </div>
          ${productCurrencyPreview(selected)}

          ${productTextarea("標籤 ID，用逗號分隔", index, "tags", selected.tags.join(", "))}
          ${productTextarea("\u5546\u54c1\u8aaa\u660e", index, "description", selectedView.description)}
          ${productTextarea("\u5546\u54c1\u7d30\u7bc0\uff0c\u4e00\u884c\u4e00\u500b", index, "details", (selectedView.details || selected.details).join("\\n"))}
          ${productTextarea("更多圖片網址，一行一張", index, "images", (selected.images || []).join("\\n"))}
        </section>
      </div>
    `;
  }

  function renderJsonAdmin() {
    return `
      <div class="admin-form">
        <section class="admin-section">
          <h3>整站備份資料</h3>
          <textarea class="json-editor" data-region="json-editor">${escapeHtml(
            JSON.stringify(site, null, 2)
          )}</textarea>
          <div class="admin-toolbar">
            <button class="secondary-button" type="button" data-action="json-refresh">重新整理</button>
            <button class="secondary-button" type="button" data-action="json-apply">套用 JSON</button>
            <button class="primary-button" type="button" data-action="json-export">匯出網站資料 JSON</button>
            <button class="secondary-button" type="button" data-action="json-export-js">匯出備援 default-data.js</button>
            <label class="secondary-button">
              匯入 JSON
              <input class="sr-only" type="file" accept="application/json,.json" data-action="json-import" />
            </label>
          </div>
        </section>
        <section class="admin-section">
          <h3>還原</h3>
          <div class="admin-toolbar">
            <button class="secondary-button" type="button" data-action="download-backup">下載初始備份</button>
            <button class="admin-danger" type="button" data-action="reset-defaults">恢復預設</button>
          </div>
        </section>
      </div>
    `;
  }

  function input(label, path, value, type = "text", min = "", max = "") {
    return `
      <label>
        <span>${escapeHtml(label)}</span>
        <input type="${type}" value="${escapeHtml(value)}" data-admin-path="${escapeHtml(path)}" ${
          min !== "" ? `min="${min}"` : ""
        } ${max !== "" ? `max="${max}"` : ""} />
      </label>
    `;
  }

  function textarea(label, path, value) {
    return `
      <label>
        <span>${escapeHtml(label)}</span>
        <textarea data-admin-path="${escapeHtml(path)}">${escapeHtml(value)}</textarea>
      </label>
    `;
  }

  function categoryInput(label, index, field, value, type = "text") {
    return `
      <label>
        <span>${escapeHtml(label)}</span>
        <input type="${type}" value="${escapeHtml(value)}" data-category-index="${index}" data-category-field="${field}" />
      </label>
    `;
  }

  function categoryTextarea(label, index, field, value) {
    return `
      <label>
        <span>${escapeHtml(label)}</span>
        <textarea data-category-index="${index}" data-category-field="${field}">${escapeHtml(value)}</textarea>
      </label>
    `;
  }

  function productInput(label, index, field, value, type = "text", min = "", step = "") {
    return `
      <label>
        <span>${escapeHtml(label)}</span>
        <input type="${type}" value="${escapeHtml(value)}" data-product-index="${index}" data-product-field="${field}" ${
          min !== "" ? `min="${min}"` : ""
        } ${step !== "" ? `step="${step}"` : ""} />
      </label>
    `;
  }

  function productStatusSelect(label, index, product) {
    const selected = productStatusCode(product.status || inferProductStatus(product));
    return `
      <label>
        <span>${escapeHtml(label)}</span>
        <select data-product-index="${index}" data-product-field="status">
          ${PRODUCT_STATUS_CODES.map(
            (code) => `<option value="${code}" ${selected === code ? "selected" : ""}>${escapeHtml(statusLabel(code))}</option>`
          ).join("")}
        </select>
      </label>
    `;
  }

  function productCurrencySelect(label, index, product) {
    const selected = productInputCurrency(product);
    return `
      <label>
        <span>${escapeHtml(label)}</span>
        <select data-product-index="${index}" data-product-field="priceCurrency">
          ${Object.entries(money)
            .map(
              ([code, config]) =>
                `<option value="${code}" ${selected === code ? "selected" : ""}>${escapeHtml(config.label)}</option>`
            )
            .join("")}
        </select>
      </label>
    `;
  }

  function productCurrencyPreview(product) {
    const rows = Object.entries(money)
      .map(([code, config]) => `<span><b>${escapeHtml(config.label)}</b>${formatPriceInCurrency(product.price, code)}</span>`)
      .join("");
    return `
      <div class="price-conversion-panel">
        <strong>價格換算預覽</strong>
        <div>${rows}</div>
        <small>內部會以台幣基準價保存，前台會依消費者選的幣別自動換算。</small>
      </div>
    `;
  }

  function spriteInput(label, index, field, value) {
    return `
      <label>
        <span>${escapeHtml(label)}</span>
        <input type="number" min="0" max="${field === "col" ? "3" : "2"}" value="${escapeHtml(
          value
        )}" data-product-index="${index}" data-sprite-field="${field}" />
      </label>
    `;
  }

  function productTextarea(label, index, field, value) {
    return `
      <label>
        <span>${escapeHtml(label)}</span>
        <textarea data-product-index="${index}" data-product-field="${field}">${escapeHtml(value)}</textarea>
      </label>
    `;
  }

  function labelize(value) {
    return String(value).replace(/[A-Z]/g, (match) => ` ${match}`).replace(/^./, (c) => c.toUpperCase());
  }

  function navToText() {
    return site.nav
      .map((item) => [item.label, item.target, item.category || ""].join(" | ").replace(/\s+\|\s+$/, ""))
      .join("\n");
  }

  function badgesToText() {
    return site.serviceBadges.map((item) => `${item.title} | ${item.copy}`).join("\n");
  }

  function footerLinksToText() {
    return site.footer.links.map((item) => `${item.label} | ${item.target}`).join("\n");
  }

  function parseNav(text) {
    const rows = String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return rows.map((line) => {
      const [label, target, category] = line.split("|").map((part) => part.trim());
      return { label: label || "連結", target: target || "#products", category: category || "" };
    });
  }

  function parseBadges(text) {
    return String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [title, copy] = line.split("|").map((part) => part.trim());
        return { title: title || "Badge", copy: copy || "" };
      });
  }

  function parseFooterLinks(text) {
    return String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [label, target] = line.split("|").map((part) => part.trim());
        return { label: label || "連結", target: target || "#products" };
      });
  }

  function syncLanguagePath(path, value) {
    const pack = (site.i18n ||= {})[currentLanguage()] ||= {};
    const parts = path.split(".");
    let target = pack;
    while (parts.length > 1) {
      const part = parts.shift();
      if (!target[part] || typeof target[part] !== "object") target[part] = {};
      target = target[part];
    }
    target[parts[0]] = value;
  }

  function setPath(path, value) {
    const i18nPaths = new Set([
      "announcement",
      "brand.shortName",
      "brand.tagline",
      "hero.eyebrow",
      "hero.title",
      "hero.subtitle",
      "hero.cta",
      "layout.collectionTitle",
      "layout.collectionDescription",
      "footer.title",
      "footer.copy",
      "contact.intro",
      "purchase.title",
      "purchase.intro",
      "purchase.method",
      "purchase.note"
    ]);

    if (path === "announcement") {
      site.announcement = value;
      syncLanguagePath(path, value);
      return;
    }
    if (path === "list.nav") {
      site.nav = parseNav(value);
      syncLanguagePath("nav", site.nav.map((item) => ({ label: item.label })));
      return;
    }
    if (path === "list.badges") {
      site.serviceBadges = parseBadges(value);
      syncLanguagePath("serviceBadges", site.serviceBadges);
      return;
    }
    if (path === "list.footerLinks") {
      site.footer.links = parseFooterLinks(value);
      syncLanguagePath("footer.links", site.footer.links);
      return;
    }
    if (path === "list.contactChannels") {
      site.contact.channels = parseContactChannels(value);
      return;
    }

    const parts = path.split(".");
    let target = site;
    while (parts.length > 1) {
      const part = parts.shift();
      if (!target[part] || typeof target[part] !== "object") target[part] = {};
      target = target[part];
    }
    const key = parts[0];
    if (["desktopColumns", "tabletColumns", "mobileColumns"].includes(key)) {
      target[key] = clampInt(value, 1, key === "mobileColumns" ? 2 : 6);
      return;
    }
    target[key] = value;
    if (i18nPaths.has(path)) syncLanguagePath(path, value);
  }

  function updateCategory(index, field, value) {
    const category = site.categories[index];
    if (!category) return;
    if (field === "id") {
      const oldId = category.id;
      category.id = slug(value);
      site.products.forEach((product) => {
        if (product.category === oldId) product.category = category.id;
        product.tags = product.tags.map((tag) => (tag === oldId ? category.id : tag));
      });
      if (state.category === oldId) state.category = category.id;
      return;
    }
    if (field === "order") category.order = Number(value) || 0;
    else category[field] = value;
  }

  function ensureLocalizedProduct(product) {
    const code = currentLanguage();
    site.i18n = site.i18n || {};
    site.i18n[code] = site.i18n[code] || {};
    site.i18n[code].products = site.i18n[code].products || {};
    site.i18n[code].products[product.id] = site.i18n[code].products[product.id] || {};
    return site.i18n[code].products[product.id];
  }

  function syncLocalizedProductField(product, field, value) {
    if (!["name", "badge", "description", "details"].includes(field)) return;
    const target = ensureLocalizedProduct(product);
    target[field] = Array.isArray(value) ? [...value] : value;
  }

  function moveLocalizedProductKey(oldId, newId) {
    Object.values(site.i18n || {}).forEach((pack) => {
      if (!pack.products || !pack.products[oldId]) return;
      pack.products[newId] = { ...(pack.products[oldId] || {}), ...(pack.products[newId] || {}) };
      delete pack.products[oldId];
    });
  }

  function updateProduct(index, field, value) {
    const product = site.products[index];
    if (!product) return;
    if (field === "id") {
      const oldId = product.id;
      const nextId = slug(value);
      product.id = nextId;
      moveLocalizedProductKey(oldId, nextId);
      state.selectedProductId = product.id;
      cart.forEach((item) => {
        if (item.id === oldId) item.id = product.id;
      });
      return;
    }
    if (field === "status") {
      product.status = productStatusCode(value);
      syncProductStatusTags(product);
      return;
    }
    if (field === "priceCurrency") {
      product.priceCurrency = moneyCode(value);
      return;
    }
    if (["price", "compareAt"].includes(field)) {
      product[field] = roundMoney(baseFromCurrency(value, productInputCurrency(product)));
      return;
    }
    if (["stock", "order"].includes(field)) {
      product[field] = Number(value) || 0;
      return;
    }
    if (field === "tags") {
      product.tags = stringList(value).map(slug);
      return;
    }
    if (field === "details") {
      product.details = stringList(value);
      syncLocalizedProductField(product, field, product.details);
      return;
    }
    if (field === "images") {
      product.images = stringList(value);
      return;
    }
    product[field] = value;
    syncLocalizedProductField(product, field, value);
  }

  function updateSprite(index, field, value) {
    const product = site.products[index];
    if (!product) return;
    product.sprite = product.sprite || { col: 0, row: 0 };
    product.sprite[field] = clampInt(value, 0, field === "col" ? 3 : 2);
  }

  function addCategory() {
    const order = site.categories.length;
    site.categories.push({
      id: `category-${order + 1}`,
      name: `分類 ${order + 1}`,
      description: "",
      order
    });
    persistSite("分類已新增。");
  }

  function addProduct() {
    const order = site.products.length + 1;
    const category = getCategories().find((item) => item.id !== "all")?.id || "all";
    const currency = moneyCode(site.layout.currency || "TWD");
    const product = {
      id: `new-product-${Date.now()}`,
      name: "新商品",
      category,
      tags: ["new"],
      price: roundMoney(baseFromCurrency(29, currency)),
      compareAt: 0,
      priceCurrency: currency,
      status: "new",
      expectedExpiryDate: "",
      badge: "\u65b0\u54c1",
      description: "可編輯商品說明。",
      details: ["可編輯商品細節"],
      stock: 10,
      order,
      sprite: { col: 0, row: 0 },
      imageUrl: "",
      images: [],
      videoUrl: ""
    };
    site.products.push(product);
    state.selectedProductId = product.id;
    persistSite("商品已新增。");
  }

  function moveItem(list, index, delta) {
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= list.length) return false;
    const [item] = list.splice(index, 1);
    list.splice(targetIndex, 0, item);
    list.forEach((entry, idx) => {
      entry.order = idx + 1;
    });
    return true;
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }


  function downloadText(filename, text, type = "text/plain") {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
  function toast(message) {
    const region = $('[data-region="toast"]');
    if (!region) return;
    const item = document.createElement("div");
    item.className = "toast-message";
    item.textContent = message;
    region.append(item);
    window.setTimeout(() => item.remove(), 2600);
  }

  function syncBackTopVisibility() {
    const button = $(".back-to-top");
    if (button) button.classList.toggle("is-visible", window.scrollY > 520);
  }

  function maybeOpenAdminFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (["#admin", "#manage", "#management"].includes(window.location.hash) || params.get("admin") === "1") {
      openAdminGate();
    }
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    const productId = target.dataset.product;

    if (action === "back-top") window.scrollTo({ top: 0, behavior: "smooth" });
    if (action === "open-search") openDialog("searchDrawer");
    if (action === "open-cart") openDialog("cartDrawer");
    if (action === "open-contact") openContact();
    if (action === "close-dialog") target.closest("dialog")?.close();
    if (action === "account") openAdminGate();
    if (action === "toggle-menu") {
      state.menuOpen = !state.menuOpen;
      renderNav();
    }
    if (action === "nav") {
      if (target.dataset.category) {
        state.category = target.dataset.category;
        state.query = "";
        state.menuOpen = false;
        renderAll();
      }
    }
    if (action === "toggle-categories") {
      state.categoryExpanded = !state.categoryExpanded;
      renderCategories();
    }
    if (action === "set-category") {
      state.category = target.dataset.category;
      state.query = "";
      renderAll();
    }
    if (action === "quick-view") openQuickView(productId);
    if (action === "select-detail-image") {
      const product = findProduct(productId);
      const main = $(".quick-media", target.closest("dialog"));
      if (product && main) {
        setProductImage(main, product, target.dataset.image);
        $$(".quick-thumb", target.closest("dialog")).forEach((button) => button.classList.toggle("is-active", button === target));
      }
    }
    if (action === "contact-product") openContact(productId);
    if (action === "qty-inc") adjustProductQuantity(productId, 1, target);
    if (action === "qty-dec") adjustProductQuantity(productId, -1, target);
    if (action === "add-cart") addToCart(productId, selectedQuantity(productId, target));
    if (action === "cart-inc") changeCart(productId, 1);
    if (action === "cart-dec") changeCart(productId, -1);
    if (action === "cart-remove") {
      cart = cart.filter((item) => item.id !== productId);
      persistCart();
    }
    if (action === "copy-cart") copyCartSummary();
    if (action === "checkout-contact") openContact();
    if (action === "admin-close") closeAdmin();
    if (action === "admin-logout") {
      localStorage.removeItem(ADMIN_KEY);
      closeAdmin();
      toast("showmii 管理頁已鎖定。");
    }
    if (action === "admin-tab") {
      state.adminTab = target.dataset.tab || "quick";
      renderAdmin();
    }
    if (action === "admin-add-category") addCategory();
    if (action === "admin-add-product") addProduct();
    if (action === "category-delete") {
      const index = Number(target.dataset.index);
      const category = site.categories[index];
      if (category?.id === "all") {
        toast("全部商品分類不可刪除。");
        return;
      }
      site.categories.splice(index, 1);
      site.products.forEach((product) => {
        if (product.category === category?.id) product.category = "all";
      });
      if (state.category === category?.id) state.category = "all";
      persistSite("分類已刪除。");
    }
    if (action === "category-up" || action === "category-down") {
      const moved = moveItem(site.categories, Number(target.dataset.index), action === "category-up" ? -1 : 1);
      if (moved) persistSite("分類排序已更新。");
    }
    if (action === "product-delete") {
      const index = Number(target.dataset.index);
      const [removed] = site.products.splice(index, 1);
      cart = cart.filter((item) => item.id !== removed?.id);
      state.selectedProductId = site.products[Math.max(0, index - 1)]?.id || "";
      persistCart();
      persistSite("商品已刪除。");
    }
    if (action === "product-duplicate") {
      const source = site.products[Number(target.dataset.index)];
      if (!source) return;
      const copy = clone(source);
      copy.id = `${source.id}-copy-${Date.now()}`;
      copy.name = `${source.name} 複製`;
      copy.order = site.products.length + 1;
      site.products.push(copy);
      state.selectedProductId = copy.id;
      persistSite("商品已複製。");
    }
    if (action === "product-up" || action === "product-down") {
      const moved = moveItem(site.products, Number(target.dataset.index), action === "product-up" ? -1 : 1);
      if (moved) persistSite("商品排序已更新。");
    }
    if (action === "json-export") downloadJson("default-site-export.json", site);
    if (action === "json-export-js") downloadText("default-data.js", `window.SHOWMII_DEFAULT_SITE = ${JSON.stringify(site, null, 2)};\nwindow.CAILUCKY_DEFAULT_SITE = window.SHOWMII_DEFAULT_SITE;` + "\n", "text/javascript");
    if (action === "download-backup") {
      const backup = localStorage.getItem(BACKUP_KEY);
      downloadJson(`cailucky-first-backup-${dateStamp()}.json`, backup ? JSON.parse(backup) : DEFAULT_SITE);
    }
    if (action === "json-refresh") renderAdmin();
    if (action === "json-apply") {
      const text = $('[data-region="json-editor"]')?.value || "";
      try {
        site = normalizeSite(JSON.parse(text));
        state.selectedProductId = site.products[0]?.id || "";
        persistSite("JSON 已套用。");
      } catch (error) {
        toast(`JSON 格式錯誤：${error.message}`);
      }
    }
    if (action === "reset-defaults") {
      if (window.confirm("要恢復 showmii 預設內容嗎？")) {
        site = normalizeSite(DEFAULT_SITE);
        cart = [];
        localStorage.removeItem(SITE_KEY);
        localStorage.removeItem(CART_KEY);
        persistSite("已恢復預設內容。");
      }
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (target.matches('[data-action="inline-search"]')) {
      state.query = target.value;
      renderProducts();
    }
    if (target.matches('[data-action="drawer-search"]')) {
      state.drawerQuery = target.value;
      renderSearchResults();
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target.matches('[data-action="cart-qty"]')) {
      const productId = target.dataset.product;
      const item = cart.find((entry) => entry.id === productId);
      if (item) {
        item.qty = clampInt(target.value, 1, 99);
        target.value = item.qty;
        persistCart();
      }
    }
    if (target.matches("[data-qty-product]")) {
      selectedQuantity(target.dataset.qtyProduct, target);
    }
    if (target.matches('[data-action="sort"]')) {
      state.sort = target.value;
      renderProducts();
    }
    if (target.matches('[data-action="language"]')) {
      site.layout.language = target.value;
      persistSite(ui("languageSaved"));
    }
    if (target.matches('[data-action="currency"]')) {
      site.layout.currency = target.value;
      persistSite("幣別已更新。");
    }
    if (target.matches("[data-admin-path]")) {
      setPath(target.dataset.adminPath, target.value);
      persistSite("已儲存。");
    }
    if (target.matches("[data-category-index]")) {
      updateCategory(Number(target.dataset.categoryIndex), target.dataset.categoryField, target.value);
      persistSite("分類已儲存。");
    }
    if (target.matches("[data-product-index][data-product-field]")) {
      updateProduct(Number(target.dataset.productIndex), target.dataset.productField, target.value);
      persistSite(target.dataset.productField === "priceCurrency" ? "\u50f9\u683c\u5e63\u5225\u5df2\u66f4\u65b0\uff0c\u5df2\u81ea\u52d5\u63db\u7b97\u986f\u793a\u3002" : "\u5546\u54c1\u5df2\u5132\u5b58\u3002");
    }
    if (target.matches("[data-product-index][data-sprite-field]")) {
      updateSprite(Number(target.dataset.productIndex), target.dataset.spriteField, target.value);
      persistSite("商品圖片位置已儲存。");
    }
    if (target.matches('[data-action="admin-select-product"]')) {
      state.selectedProductId = target.value;
      renderAdmin();
    }
    if (target.matches('[data-action="json-import"]') && target.files?.[0]) {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        try {
          site = normalizeSite(JSON.parse(String(reader.result || "")));
          state.selectedProductId = site.products[0]?.id || "";
          persistSite("JSON 已匯入。");
        } catch (error) {
          toast(`匯入失敗：${error.message}`);
        }
      });
      reader.readAsText(target.files[0]);
    }
  });

  window.addEventListener("resize", () => {
    renderCategories();
    syncBackTopVisibility();
  });
  window.addEventListener("scroll", syncBackTopVisibility, { passive: true });

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!form.matches('[data-form="admin-login"]')) return;
    event.preventDefault();
    const data = new FormData(form);
    const usernameOk = String(data.get("username") || "").trim() === String(site.admin.username || "showmii").trim();
    const passcodeOk = String(data.get("passcode") || "") === String(site.admin.passcode || "showmii-admin");
    if (usernameOk && passcodeOk) {
      localStorage.setItem(ADMIN_KEY, "true");
      $("#adminGate")?.close();
      form.reset();
      openAdmin();
      return;
    }
    toast("帳號或密碼錯誤。");
  });

  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "m") {
      event.preventDefault();
      openAdminGate();
    }
    if (event.key === "Escape" && state.adminOpen) closeAdmin();
  });

  window.addEventListener("hashchange", maybeOpenAdminFromUrl);

  function dateStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  async function bootSite() {
    site = await loadSite();
    ensureBackup();
    renderAll();
    maybeOpenAdminFromUrl();
  }

  bootSite();
})();





