/* eslint-disable no-console */
/* Pure static site (GitHub Pages). Progressive enhancement only. */

const DEFAULT_LANG = (() => {
  const navLang = String(navigator.language || "").toLowerCase();
  return navLang.startsWith("pt") ? "pt" : "en";
})();

const state = {
  content: null,
  lang: localStorage.getItem("lang") || DEFAULT_LANG,
  theme: null,
  fx: null,
  currentProjectId: null,
  toolboxSelected: [],
  cmdk: {
    items: [],
    filtered: [],
    activeIndex: 0,
    open: false,
  },
};

function $(sel, root = document) {
  return root.querySelector(sel);
}

function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function prefersReducedMotion() {
  return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

function withViewTransition(fn) {
  const can =
    !prefersReducedMotion() &&
    typeof document !== "undefined" &&
    typeof document.startViewTransition === "function";
  if (!can) return fn();
  // eslint-disable-next-line no-undef
  return document.startViewTransition(() => fn());
}

function getByPath(obj, path) {
  const parts = String(path || "").split(".");
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return null;
    cur = cur[p];
  }
  return cur ?? null;
}

function setMeta(langData) {
  if (!langData?.meta) return;
  if (langData.meta.title) document.title = langData.meta.title;

  const desc = document.querySelector('meta[name="description"]');
  if (desc && langData.meta.description) desc.setAttribute("content", langData.meta.description);

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle && langData.meta.title) ogTitle.setAttribute("content", langData.meta.title);

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc && langData.meta.ogDescription) ogDesc.setAttribute("content", langData.meta.ogDescription);
}

function applyI18n(langData) {
  document.documentElement.lang = state.lang;
  $all("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const val = getByPath(langData, key);
    if (typeof val === "string") el.textContent = val;
  });

  // Placeholder i18n for inputs (keeps UX polished).
  $all("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    const val = getByPath(langData, key);
    if (typeof val === "string") el.setAttribute("placeholder", val);
  });
}

function renderList(parent, items, renderItem) {
  parent.innerHTML = "";
  const frag = document.createDocumentFragment();
  items.forEach((item) => frag.appendChild(renderItem(item)));
  parent.appendChild(frag);
}

function getPreferredTheme() {
  const raw = String(localStorage.getItem("theme") || "").toLowerCase();
  if (raw === "light" || raw === "dark") return raw;
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function applyTheme(theme) {
  state.theme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem("theme", state.theme);

  // Keep canvas FX palette in sync.
  if (state.fx) state.fx.setTheme(state.theme);
}

function updateThemeToggle(langData) {
  const btn = $("#theme-toggle");
  if (!btn) return;

  const toDark = langData?.theme?.toDark || "Dark";
  const toLight = langData?.theme?.toLight || "Light";
  const aria = langData?.theme?.aria || "Toggle theme";

  btn.textContent = state.theme === "dark" ? toLight : toDark;
  btn.setAttribute("aria-label", aria);
  btn.setAttribute("aria-pressed", state.theme === "dark" ? "true" : "false");
}

function applyProfileLinks(langData) {
  const p = langData.profile || {};
  const email = typeof p.email === "string" ? p.email.trim() : "";
  const whatsapp = typeof p.whatsapp === "string" ? p.whatsapp.trim() : "";
  const github = typeof p.github === "string" ? p.github.trim() : "";
  const linkedin = typeof p.linkedin === "string" ? p.linkedin.trim() : "";

  const mailto = email ? `mailto:${email}` : "";

  const ctaEmail = $("#cta-email");
  if (ctaEmail && mailto) ctaEmail.setAttribute("href", mailto);

  const contactEmail = $("#contact-email");
  if (contactEmail && mailto) {
    contactEmail.setAttribute("href", mailto);
    contactEmail.textContent = email;
  }

  const contactPhone = $("#contact-phone");
  if (contactPhone && whatsapp) contactPhone.setAttribute("href", whatsapp);

  const contactGithub = $("#contact-github");
  if (contactGithub && github) contactGithub.setAttribute("href", github);

  const ctaLinkedin = $("#cta-linkedin");
  const contactLinkedin = $("#contact-linkedin");
  if (linkedin) {
    if (ctaLinkedin) ctaLinkedin.setAttribute("href", linkedin);
    if (contactLinkedin) contactLinkedin.setAttribute("href", linkedin);
  }
}

function renderAbout(langData) {
  const root = $("#about-content");
  if (!root) return;
  root.innerHTML = "";
  const frag = document.createDocumentFragment();
  (langData.about || []).forEach((p) => {
    const el = document.createElement("p");
    el.textContent = p;
    frag.appendChild(el);
  });
  root.appendChild(frag);
}

function renderFocus(langData) {
  const chips = $("#focus-chips");
  if (chips) {
    renderList(chips, langData.hero?.focus || [], (txt) => {
      const li = document.createElement("li");
      li.className = "chip";
      li.textContent = txt;
      return li;
    });
  }

  const bullets = $("#build-bullets");
  if (bullets) {
    renderList(bullets, langData.hero?.build || [], (txt) => {
      const li = document.createElement("li");
      li.textContent = txt;
      return li;
    });
  }
}

function renderHeroFeature(langData) {
  const grid = $("#hero-feature-grid");
  if (!grid) return;

  const projects = Array.isArray(langData.projects) ? langData.projects : [];
  if (projects.length === 0) {
    grid.innerHTML = "";
    return;
  }

  const ids = Array.isArray(langData.hero?.featuredProjectIds) ? langData.hero.featuredProjectIds : [];
  let picks = [];
  if (ids.length) {
    ids.forEach((id) => {
      const hit = projects.find((p) => String(p.id || "") === String(id));
      if (hit) picks.push(hit);
    });
  }
  if (picks.length === 0) picks = projects.slice(0, 3);

  const seen = new Set();
  picks = picks
    .filter((p) => p && (p.id || p.title))
    .filter((p) => {
      const key = String(p.id || p.title || "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);

  grid.innerHTML = "";
  const frag = document.createDocumentFragment();
  picks.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "feature-item";
    btn.addEventListener("click", () => openProjectModal(p, langData));

    const strong = document.createElement("strong");
    strong.textContent = p.title || "";

    const span = document.createElement("span");
    span.textContent = p.subtitle || p.problem || "";

    const stack = document.createElement("div");
    stack.className = "feature-stack";
    (Array.isArray(p.stack) ? p.stack : []).slice(0, 4).forEach((t) => {
      const pill = document.createElement("span");
      pill.className = "feature-pill";
      pill.textContent = t;
      stack.appendChild(pill);
    });

    btn.appendChild(strong);
    btn.appendChild(span);
    if (stack.childNodes.length) btn.appendChild(stack);

    frag.appendChild(btn);
  });
  grid.appendChild(frag);
}

function renderPipeline(langData) {
  const grid = $("#pipeline-grid");
  if (!grid) return;

  const items = langData.hero?.pipeline || [];
  if (!Array.isArray(items) || items.length === 0) {
    grid.innerHTML = "";
    return;
  }

  // Create/update a detail panel under the grid (without changing HTML).
  const host = grid.parentElement;
  let detail = host ? host.querySelector(".pipeline-detail") : null;
  if (host && !detail) {
    detail = document.createElement("div");
    detail.className = "pipeline-detail";
    host.appendChild(detail);
  }

  const setActive = (id) => {
    $all(".pipe-node", grid).forEach((b) => b.classList.toggle("is-active", b.dataset.id === id));
    const item = items.find((x) => x.id === id) || items[0];
    if (!detail) return;

    detail.innerHTML = "";
    const h = document.createElement("strong");
    h.textContent = item.title;
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = item.desc || "";
    const ul = document.createElement("ul");
    (item.bullets || []).forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      ul.appendChild(li);
    });
    detail.appendChild(h);
    detail.appendChild(p);
    if (ul.childNodes.length) detail.appendChild(ul);
  };

  grid.innerHTML = "";
  const frag = document.createDocumentFragment();
  items.forEach((it, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pipe-node";
    btn.dataset.id = it.id || String(idx);

    const strong = document.createElement("strong");
    strong.textContent = it.title || "Step";
    const span = document.createElement("span");
    span.textContent = it.desc || "";

    btn.appendChild(strong);
    btn.appendChild(span);
    btn.addEventListener("click", () => {
      setActive(btn.dataset.id);
      // Nice UX: scroll slightly toward the lab map on second click.
      if (btn.dataset.id === state._lastPipeId) {
        const lab = $("#lab");
        if (lab) lab.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      }
      state._lastPipeId = btn.dataset.id;
    });
    frag.appendChild(btn);
  });
  grid.appendChild(frag);

  setActive(items[0].id || "0");
}

function renderSkills(langData) {
  const grid = $("#skills-grid");
  if (!grid) return;
  renderList(grid, langData.skills || [], (group) => {
    const card = document.createElement("div");
    card.className = "card";
    const h = document.createElement("h3");
    h.textContent = group.group;
    const ul = document.createElement("ul");
    ul.className = "skill-items";
    (group.items || []).forEach((it) => {
      const li = document.createElement("li");
      li.className = "pilltag";
      li.textContent = it;
      ul.appendChild(li);
    });
    card.appendChild(h);
    card.appendChild(ul);
    return card;
  });
}

function collectToolboxTags(langData) {
  const freq = new Map();
  const bump = (tag) => {
    const t = String(tag || "").trim();
    if (!t) return;
    freq.set(t, (freq.get(t) || 0) + 1);
  };

  (langData.projects || []).forEach((p) => (p.stack || []).forEach(bump));
  // Pull a few from skills to fill the board, without exploding the list.
  (langData.skills || []).forEach((g) => (g.items || []).forEach((it) => bump(it)));

  // Sort by frequency, then name (stable).
  const tags = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t]) => t);

  // Keep it dense but not overwhelming.
  return tags.slice(0, 36);
}

function renderToolbox(langData) {
  const root = $("#toolbox-tags");
  const stats = $("#toolbox-stats");
  const btnClear = $("#toolbox-clear");
  if (!root || !stats || !btnClear) return;

  const tags = collectToolboxTags(langData);
  const selected = new Set(state.toolboxSelected);
  const countLabel = String(langData?.toolbox?.countLabel || (state.lang === "pt" ? "projetos" : "projects"));

  const updateStats = () => {
    const total = Array.isArray(langData.projects) ? langData.projects.length : 0;
    if (selected.size === 0) {
      stats.textContent = total ? `${total} ${countLabel}` : "";
      btnClear.disabled = true;
      return;
    }
    const matchCount = $all("#projects-grid .card.is-match").length;
    const names = Array.from(selected).slice(0, 3).join(" + ");
    const more = selected.size > 3 ? ` +${selected.size - 3}` : "";
    stats.textContent = `${names}${more} · ${matchCount}/${total}`;
    btnClear.disabled = false;
  };

  const apply = () => {
    state.toolboxSelected = Array.from(selected);
    $all(".tbox-tag", root).forEach((b) => b.classList.toggle("is-active", selected.has(b.dataset.tag)));
    applyToolboxFilter();
    updateStats();
  };

  root.innerHTML = "";
  const frag = document.createDocumentFragment();
  tags.forEach((t) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tbox-tag";
    b.dataset.tag = t;
    b.textContent = t;
    b.addEventListener("click", (ev) => {
      const multi = Boolean(ev.shiftKey);
      if (!multi) {
        if (selected.size === 1 && selected.has(t)) selected.clear();
        else {
          selected.clear();
          selected.add(t);
        }
      } else {
        if (selected.has(t)) selected.delete(t);
        else selected.add(t);
      }
      apply();
    });
    frag.appendChild(b);
  });
  root.appendChild(frag);

  btnClear.onclick = () => {
    selected.clear();
    apply();
  };

  // Initial apply (keeps selection across language switches).
  apply();
}

function applyToolboxFilter() {
  const selected = state.toolboxSelected || [];
  const cards = $all("#projects-grid .card");
  if (selected.length === 0) {
    cards.forEach((c) => c.classList.remove("is-muted", "is-match"));
    return;
  }
  const wanted = new Set(selected);
  cards.forEach((c) => {
    const stack = String(c.dataset.stack || "");
    const tags = new Set(stack.split("|").filter(Boolean));
    let ok = true;
    wanted.forEach((t) => {
      if (!tags.has(t)) ok = false;
    });
    c.classList.toggle("is-match", ok);
    c.classList.toggle("is-muted", !ok);
  });
}

function getDialogBackdrop() {
  let el = document.getElementById("dlg-backdrop");
  if (el) return el;
  el = document.createElement("div");
  el.id = "dlg-backdrop";
  el.className = "dlg-backdrop";
  el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);
  return el;
}

function markDialogPolyfill(dialogEl) {
  if (!dialogEl || dialogEl.dataset.polyfill) return;
  const ok = typeof dialogEl.showModal === "function" && typeof dialogEl.close === "function";
  if (ok) return;
  dialogEl.dataset.polyfill = "1";
}

function openDialog(dialogEl) {
  if (!dialogEl) return false;

  // Track the active dialog for generic escape/backdrop handling.
  state._activeDialog = dialogEl;

  // Native path first.
  if (typeof dialogEl.showModal === "function") {
    try {
      dialogEl.showModal();
      return true;
    } catch {
      // Fallthrough to polyfill path.
    }
  }

  // Polyfill path (older Safari/iOS).
  dialogEl.setAttribute("open", "open");
  markDialogPolyfill(dialogEl);
  const bd = getDialogBackdrop();
  bd.classList.add("is-open");
  document.documentElement.classList.add("is-modal-open");
  document.body.classList.add("is-modal-open");
  return true;
}

function closeDialog(dialogEl) {
  const dlg = dialogEl || state._activeDialog;
  if (!dlg) return false;

  // Native close when possible.
  if (typeof dlg.close === "function") {
    try {
      dlg.close();
    } catch {
      // ignore
    }
  }

  // Always drop the open attribute for polyfill and safety.
  try {
    dlg.removeAttribute("open");
  } catch {
    // ignore
  }

  const bd = document.getElementById("dlg-backdrop");
  if (bd) bd.classList.remove("is-open");
  document.documentElement.classList.remove("is-modal-open");
  document.body.classList.remove("is-modal-open");

  if (dlg.id === "project-modal") state.currentProjectId = null;
  if (state._activeDialog === dlg) state._activeDialog = null;
  return true;
}

function setupDialogs() {
  // Mark polyfill-only dialogs early (so CSS can hide them while closed).
  $all("dialog").forEach(markDialogPolyfill);

  const bd = getDialogBackdrop();
  if (!bd.dataset.bound) {
    bd.dataset.bound = "1";
    bd.addEventListener("click", () => {
      const active = state._activeDialog;
      if (active && active.id === "cmdk") closeCmdk();
      else closeDialog(null);
    });
  }

  // Close buttons inside dialogs: required for browsers that don't support method="dialog".
  $all(".modal-close, .cmdk-close").forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      const dlg = btn.closest ? btn.closest("dialog") : null;
      if (dlg && dlg.id === "cmdk") closeCmdk();
      else closeDialog(dlg);
    });
  });

  // Tap/click outside the inner panel to close (mobile-friendly).
  $all("dialog").forEach((dlg) => {
    if (dlg.dataset.outsideBound) return;
    dlg.dataset.outsideBound = "1";
    dlg.addEventListener("click", (ev) => {
      if (ev.target !== dlg) return;
      if (dlg.id === "cmdk") closeCmdk();
      else closeDialog(dlg);
    });
  });
}

function normalizeText(input) {
  const s = String(input || "").toLowerCase();
  try {
    // Allow "avaliacao" to match "avaliação", etc.
    return s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return s.replace(/\s+/g, " ").trim();
  }
}

function buildCmdkItems(langData) {
  const kinds = langData?.cmdk?.kinds || {};
  const items = [];

  const add = (it) => {
    items.push({
      ...it,
      _hay: normalizeText(`${it.title || ""} ${it.subtitle || ""} ${(it.keywords || []).join(" ")}`),
      kindLabel: it.kindLabel || kinds[it.kind] || it.kind || "",
    });
  };

  // Sections (navigation)
  const sections = [
    { id: "about", key: "about" },
    { id: "skills", key: "skills" },
    { id: "toolbox", key: "toolbox" },
    { id: "projects", key: "projects" },
    { id: "lab", key: "lab" },
    { id: "experience", key: "experience" },
    { id: "education", key: "education" },
    { id: "contact", key: "contact" },
  ];
  sections.forEach((s) => {
    const label = langData?.nav?.[s.key];
    if (!label) return;
    add({
      id: `section:${s.id}`,
      kind: "section",
      title: label,
      subtitle: langData?.cmdk?.sectionHint || "",
      action: () => {
        const el = document.getElementById(s.id);
        if (el) el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      },
    });
  });

  // Quick actions
  add({
    id: "action:toggle-theme",
    kind: "action",
    title: langData?.cmdk?.toggleTheme || (state.theme === "dark" ? "Light theme" : "Dark theme"),
    subtitle: langData?.cmdk?.actionHint || "",
    action: () => {
      applyTheme(state.theme === "dark" ? "light" : "dark");
      updateThemeToggle(langData);
      // Keep label updated while palette is open.
      state.cmdk.items = buildCmdkItems(langData);
      filterCmdk($("#cmdk-input")?.value || "");
    },
  });

  // Profile links
  const prof = langData?.profile || {};
  const links = [
    { id: "email", title: langData?.cmdk?.email || "Email", href: prof.email ? `mailto:${prof.email}` : "" },
    { id: "linkedin", title: "LinkedIn", href: prof.linkedin || "" },
    { id: "github", title: "GitHub", href: prof.github || "" },
    { id: "whatsapp", title: langData?.cmdk?.whatsapp || "WhatsApp", href: prof.whatsapp || "" },
  ];
  links.forEach((l) => {
    if (!l.href) return;
    add({
      id: `link:${l.id}`,
      kind: "link",
      title: l.title,
      subtitle: l.href.replace(/^mailto:/, ""),
      action: () => window.open(l.href, "_blank", "noreferrer"),
    });
  });

  // Projects (case studies)
  (langData?.projects || []).forEach((p, idx) => {
    add({
      id: `project:${p.id || idx}`,
      kind: "project",
      title: p.title || "",
      subtitle: p.subtitle || "",
      keywords: Array.isArray(p.stack) ? p.stack : [],
      action: () => openProjectModal(p, langData),
    });
  });

  return items;
}

function renderCmdkResults() {
  const list = $("#cmdk-results");
  if (!list) return;

  const items = state.cmdk.filtered || [];
  const active = Math.max(0, Math.min(state.cmdk.activeIndex || 0, Math.max(0, items.length - 1)));
  state.cmdk.activeIndex = active;

  list.innerHTML = "";
  const frag = document.createDocumentFragment();
  items.forEach((it, idx) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cmdk-item";
    btn.classList.toggle("is-active", idx === active);
    btn.dataset.id = it.id || "";

    const left = document.createElement("div");
    left.className = "cmdk-left";
    const strong = document.createElement("strong");
    strong.textContent = it.title || "";
    const sub = document.createElement("span");
    sub.textContent = it.subtitle || "";
    left.appendChild(strong);
    left.appendChild(sub);

    const k = document.createElement("span");
    k.className = "cmdk-kbd";
    k.textContent = it.kindLabel || "";

    btn.appendChild(left);
    btn.appendChild(k);

    btn.addEventListener("click", () => executeCmdkItem(it));
    li.appendChild(btn);
    frag.appendChild(li);
  });
  list.appendChild(frag);
}

function filterCmdk(query) {
  const q = normalizeText(query);
  const all = state.cmdk.items || [];
  const out = q
    ? all.filter((it) => it._hay && it._hay.includes(q))
    : all.slice(0);

  // Keep it snappy.
  state.cmdk.filtered = out.slice(0, 16);
  state.cmdk.activeIndex = 0;
  renderCmdkResults();
}

function closeCmdk() {
  const dlg = $("#cmdk");
  if (!dlg) return;
  state.cmdk.open = false;
  closeDialog(dlg);
  const back = state.cmdk._returnFocus;
  state.cmdk._returnFocus = null;
  if (back && typeof back.focus === "function") back.focus();
}

function openCmdk() {
  const dlg = $("#cmdk");
  const input = $("#cmdk-input");
  if (!dlg || !input) return;

  state.cmdk.open = true;
  state.cmdk._returnFocus = document.activeElement;
  openDialog(dlg);

  // Fresh query per open.
  input.value = "";
  filterCmdk("");
  setTimeout(() => {
    try {
      input.focus();
      input.select();
    } catch {
      // ignore
    }
  }, 0);
}

function executeCmdkItem(it) {
  if (!it) return;
  closeCmdk();
  // Let dialog close animation happen first.
  setTimeout(() => {
    try {
      if (typeof it.action === "function") it.action();
    } catch {
      // ignore
    }
  }, 30);
}

function setupCmdk() {
  const dlg = $("#cmdk");
  const input = $("#cmdk-input");
  const openBtn = $("#cmdk-open");
  if (!dlg || !input) return;

  if (!dlg.dataset.bound) {
    dlg.dataset.bound = "1";

    if (openBtn) openBtn.addEventListener("click", openCmdk);

    dlg.addEventListener("close", () => {
      state.cmdk.open = false;
      const back = state.cmdk._returnFocus;
      state.cmdk._returnFocus = null;
      if (back && typeof back.focus === "function") back.focus();
    });

    input.addEventListener("input", () => filterCmdk(input.value));

    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        closeCmdk();
        return;
      }
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        state.cmdk.activeIndex = Math.min(
          (state.cmdk.activeIndex || 0) + 1,
          Math.max(0, (state.cmdk.filtered || []).length - 1),
        );
        renderCmdkResults();
        return;
      }
      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        state.cmdk.activeIndex = Math.max((state.cmdk.activeIndex || 0) - 1, 0);
        renderCmdkResults();
        return;
      }
      if (ev.key === "Enter") {
        ev.preventDefault();
        const cur = (state.cmdk.filtered || [])[state.cmdk.activeIndex || 0];
        if (cur) executeCmdkItem(cur);
      }
    });

    // Global shortcut
    window.addEventListener("keydown", (ev) => {
      const k = String(ev.key || "").toLowerCase();
      if ((ev.ctrlKey || ev.metaKey) && k === "k") {
        ev.preventDefault();
        if (state.cmdk.open) closeCmdk();
        else openCmdk();
      }
      if (state.cmdk.open && k === "escape") {
        ev.preventDefault();
        closeCmdk();
      }
    });
  }

  // Always rebuild items for the current language (cheap).
  const langData = state.content ? state.content[state.lang] : null;
  if (langData) state.cmdk.items = buildCmdkItems(langData);
  filterCmdk(input.value || "");
}

function setupScrollProgress() {
  const bar = $("#scroll-progress-bar");
  if (!bar) return;
  if (bar.dataset.bound) return;
  bar.dataset.bound = "1";

  let raf = 0;
  const tick = () => {
    raf = 0;
    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - doc.clientHeight);
    const p = Math.max(0, Math.min(1, (doc.scrollTop || 0) / max));
    bar.style.width = `${(p * 100).toFixed(2)}%`;
  };
  const on = () => {
    if (raf) return;
    raf = window.requestAnimationFrame(tick);
  };
  window.addEventListener("scroll", on, { passive: true });
  window.addEventListener("resize", on, { passive: true });
  tick();
}

function setupCardTilt() {
  if (prefersReducedMotion()) return;
  if (!window.matchMedia) return;
  const ok = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!ok) return;

  const cards = $all(".card, .panel-card, .titem, .edu, .feature-item");
  cards.forEach((el) => {
    if (el.dataset.tiltBound) return;
    el.dataset.tiltBound = "1";

    const maxDeg = 8;
    const onMove = (ev) => {
      const rect = el.getBoundingClientRect();
      const px = (ev.clientX - rect.left) / Math.max(1, rect.width);
      const py = (ev.clientY - rect.top) / Math.max(1, rect.height);
      const ry = (px - 0.5) * (maxDeg * 2);
      const rx = -(py - 0.5) * (maxDeg * 2);
      el.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
      el.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
    };
    const onLeave = () => {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
  });
}

function safeLink(url) {
  if (!url) return null;
  try {
    // eslint-disable-next-line no-new
    new URL(url, window.location.href);
    return url;
  } catch {
    return null;
  }
}

function openProjectModal(project, langData) {
  const modal = $("#project-modal");
  const body = $("#project-modal-body");
  if (!modal || !body || !project) return;

  const labels = langData?.labels || {};
  const title = String(project.title || "");
  const subtitle = String(project.subtitle || "");
  const problem = String(project.problem || "");
  const approach = Array.isArray(project.approach) ? project.approach : [];
  const impact = Array.isArray(project.impact) ? project.impact : [];
  const highlights = Array.isArray(project.highlights) ? project.highlights : [];
  const stack = Array.isArray(project.stack) ? project.stack : [];
  const disclaimer = String(project.disclaimer || "");

  body.innerHTML = "";

  const h = document.createElement("h3");
  h.textContent = title;
  body.appendChild(h);

  if (subtitle) {
    const sub = document.createElement("p");
    sub.className = "muted";
    sub.textContent = subtitle;
    body.appendChild(sub);
  }

  const grid2 = document.createElement("div");
  grid2.className = "grid2";

  const mkBox = (heading, contentEl) => {
    const box = document.createElement("div");
    box.className = "box";
    const hh = document.createElement("strong");
    hh.textContent = heading;
    box.appendChild(hh);
    box.appendChild(contentEl);
    return box;
  };

  const mkList = (arr) => {
    const ul = document.createElement("ul");
    arr.forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      ul.appendChild(li);
    });
    return ul;
  };

  if (problem) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = problem;
    grid2.appendChild(mkBox(labels.problem || "Problem", p));
  }
  if (approach.length) grid2.appendChild(mkBox(labels.approach || "Approach", mkList(approach)));
  if (impact.length) grid2.appendChild(mkBox(labels.impact || "Impact", mkList(impact)));
  if (highlights.length) grid2.appendChild(mkBox(labels.highlights || "Highlights", mkList(highlights)));
  body.appendChild(grid2);

  if (stack.length) {
    const row = document.createElement("div");
    row.className = "stack";
    stack.forEach((t) => {
      const s = document.createElement("span");
      s.className = "pilltag";
      s.textContent = t;
      row.appendChild(s);
    });
    body.appendChild(row);
  }

  if (disclaimer) {
    const d = document.createElement("p");
    d.className = "tiny muted";
    d.textContent = disclaimer;
    body.appendChild(d);
  }

  // Open with view transitions when supported.
  withViewTransition(() => {
    state.currentProjectId = project.id || title;
    openDialog(modal);
  });
}

function renderProjects(langData) {
  const grid = $("#projects-grid");
  if (!grid) return;
  renderList(grid, langData.projects || [], (p) => {
    const card = document.createElement("article");
    card.className = "card";
    card.tabIndex = 0;
    card.dataset.projectId = p.id || "";
    card.dataset.stack = Array.isArray(p.stack) ? p.stack.join("|") : "";

    const top = document.createElement("div");
    top.className = "project-top";

    const left = document.createElement("div");
    const h = document.createElement("h3");
    h.textContent = p.title;
    const sub = document.createElement("p");
    sub.className = "project-subtitle";
    sub.textContent = p.subtitle || "";
    left.appendChild(h);
    left.appendChild(sub);

    const ill = document.createElement("img");
    ill.className = "project-ill";
    ill.alt = "";
    ill.loading = "lazy";
    ill.src = p.image || "assets/projects/project-generic.svg";

    top.appendChild(left);
    top.appendChild(ill);
    card.appendChild(top);

    const ul = document.createElement("ul");
    ul.className = "highlights";
    (p.highlights || []).forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      ul.appendChild(li);
    });
    card.appendChild(ul);

    const stack = document.createElement("div");
    stack.className = "stack";
    (p.stack || []).forEach((t) => {
      const s = document.createElement("span");
      s.className = "pilltag";
      s.textContent = t;
      stack.appendChild(s);
    });
    card.appendChild(stack);

    const foot = document.createElement("div");
    foot.className = "project-foot";

    const links = document.createElement("div");
    links.className = "links";
    const repo = safeLink(p.links?.repo);
    const demo = safeLink(p.links?.demo);
    const writeup = safeLink(p.links?.writeup);

    const addLink = (href, label) => {
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = label;
      links.appendChild(a);
    };

    if (repo) addLink(repo, langData.labels?.repo || "Repo");
    if (demo) addLink(demo, langData.labels?.demo || "Demo");
    if (writeup) addLink(writeup, langData.labels?.writeup || "Writeup");

    const disc = document.createElement("div");
    disc.className = "disclaimer";
    disc.textContent = p.disclaimer || "";

    foot.appendChild(links);
    foot.appendChild(disc);
    card.appendChild(foot);

    const open = (ev) => {
      // Ignore clicks on external links.
      const a = ev.target && ev.target.closest ? ev.target.closest("a") : null;
      if (a) return;
      openProjectModal(p, langData);
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        openProjectModal(p, langData);
      }
    });

    return card;
  });
}

function renderExperience(langData) {
  const root = $("#experience-list");
  if (!root) return;
  renderList(root, langData.experience || [], (e) => {
    const item = document.createElement("div");
    item.className = "titem";

    const when = document.createElement("div");
    when.className = "twhen";
    when.textContent = e.when || "";

    const main = document.createElement("div");
    main.className = "tmain";

    const h = document.createElement("h3");
    h.textContent = e.title;
    const org = document.createElement("p");
    org.className = "torg";
    org.textContent = e.org || "";

    const ul = document.createElement("ul");
    ul.className = "tbullets";
    (e.bullets || []).forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      ul.appendChild(li);
    });

    main.appendChild(h);
    main.appendChild(org);
    main.appendChild(ul);
    item.appendChild(when);
    item.appendChild(main);
    return item;
  });
}

function renderEducation(langData) {
  const root = $("#education-list");
  if (!root) return;
  renderList(root, langData.education || [], (ed) => {
    const card = document.createElement("div");
    card.className = "edu";
    const h = document.createElement("h3");
    h.textContent = ed.title;
    const p = document.createElement("p");
    p.textContent = `${ed.org}${ed.year ? " · " + ed.year : ""}`;
    const extra = document.createElement("p");
    extra.className = "muted tiny";
    extra.textContent = ed.note || "";
    const bullets = Array.isArray(ed.bullets) ? ed.bullets : [];
    card.appendChild(h);
    card.appendChild(p);
    if (ed.note) card.appendChild(extra);
    if (bullets.length) {
      const ul = document.createElement("ul");
      ul.className = "edu-bullets";
      bullets.forEach((t) => {
        const li = document.createElement("li");
        li.textContent = t;
        ul.appendChild(li);
      });
      card.appendChild(ul);
    }
    return card;
  });
}

function renderCertifications(langData) {
  const root = $("#certs-list");
  if (!root) return;
  renderList(root, langData.certifications || [], (c) => {
    const card = document.createElement(c.href ? "a" : "div");
    card.className = "cert";
    if (c.href) {
      card.href = c.href;
      card.target = "_blank";
      card.rel = "noreferrer";
    }

    const top = document.createElement("div");
    top.className = "cert-top";

    const icon = document.createElement("div");
    icon.className = "cert-icon";
    if (c.badge) {
      const img = document.createElement("img");
      img.src = c.badge;
      img.alt = c.issuer ? String(c.issuer) : "Certification";
      img.loading = "lazy";
      icon.appendChild(img);
    } else {
      icon.textContent = (c.issuer || "Cert").slice(0, 2).toUpperCase();
    }

    const main = document.createElement("div");
    main.className = "cert-main";

    const h = document.createElement("h3");
    h.textContent = c.title || "";

    const meta = document.createElement("p");
    meta.className = "muted";
    const parts = [];
    if (c.issuer) parts.push(String(c.issuer));
    if (c.date) parts.push(String(c.date));
    if (c.note) parts.push(String(c.note));
    meta.textContent = parts.join(" · ");

    main.appendChild(h);
    if (meta.textContent) main.appendChild(meta);

    top.appendChild(icon);
    top.appendChild(main);
    card.appendChild(top);
    return card;
  });
}

function renderQuickLinks(langData) {
  const root = $("#quick-links");
  if (!root) return;
  renderList(root, langData.quickLinks || [], (l) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = l.href || "#";
    if (l.external) {
      a.target = "_blank";
      a.rel = "noreferrer";
    }
    a.textContent = l.label;
    li.appendChild(a);
    return li;
  });
}

function renderLab(langData) {
  const legend = $("#lab-legend");
  const map = $("#lab-map");
  const detail = $("#lab-detail");
  if (!legend || !map || !detail) return;

  const lab = langData.lab || {};
  const nodes = Array.isArray(lab.nodes) ? lab.nodes : [];
  const lg = Array.isArray(lab.legend) ? lab.legend : [];

  renderList(legend, lg, (it) => {
    const span = document.createElement("span");
    span.className = "lab-pill";
    span.textContent = it.label || "";
    if (it.hint) span.title = it.hint;
    return span;
  });

  map.innerHTML = "";
  detail.innerHTML = "";

  // SVG edges layer
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "lab-edges");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  map.appendChild(svg);

  const nodeIndex = new Map(nodes.map((n) => [n.id, n]));

  const renderDetail = (n) => {
    detail.innerHTML = "";
    const h = document.createElement("h3");
    h.textContent = n.title || n.label || "";
    const p = document.createElement("p");
    p.textContent = n.body || "";
    detail.appendChild(h);
    detail.appendChild(p);
    if (Array.isArray(n.bullets) && n.bullets.length) {
      const ul = document.createElement("ul");
      n.bullets.forEach((t) => {
        const li = document.createElement("li");
        li.textContent = t;
        ul.appendChild(li);
      });
      detail.appendChild(ul);
    }
  };

  // Draw edges first (behind nodes).
  nodes.forEach((n) => {
    const links = Array.isArray(n.links) ? n.links : [];
    links.forEach((toId) => {
      const t = nodeIndex.get(toId);
      if (!t) return;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(n.x));
      line.setAttribute("y1", String(n.y));
      line.setAttribute("x2", String(t.x));
      line.setAttribute("y2", String(t.y));
      line.setAttribute("stroke", "rgba(30, 111, 92, 0.35)");
      line.setAttribute("stroke-width", "0.7");
      line.setAttribute("stroke-linecap", "round");
      svg.appendChild(line);
    });
  });

  const setActive = (id) => {
    $all(".lab-node button", map).forEach((b) => b.classList.toggle("is-active", b.dataset.id === id));
    const n = nodeIndex.get(id) || nodes[0];
    if (n) renderDetail(n);
  };

  // Nodes
  nodes.forEach((n) => {
    const wrap = document.createElement("div");
    wrap.className = "lab-node";
    wrap.style.setProperty("--x", String(n.x));
    wrap.style.setProperty("--y", String(n.y));

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = n.label || "";
    btn.dataset.id = n.id || "";
    btn.addEventListener("click", () => setActive(btn.dataset.id));
    btn.addEventListener("pointerenter", () => {
      if (prefersReducedMotion()) return;
      setActive(btn.dataset.id);
    });

    wrap.appendChild(btn);
    map.appendChild(wrap);
  });

  if (nodes[0]?.id) setActive(nodes[0].id);
}

function setupReveal() {
  const els = $all("[data-reveal]");
  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add("is-visible");
      });
    },
    { threshold: 0.12 }
  );
  els.forEach((el) => io.observe(el));
}

class FxCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    this.w = 0;
    this.h = 0;
    this.raf = 0;
    this.points = [];
    this.theme = "light";
    this.running = false;
    this._onResize = () => this.resize();
    this._onVis = () => (document.hidden ? this.stop() : this.start());
  }

  init() {
    this.resize();
    window.addEventListener("resize", this._onResize, { passive: true });
    document.addEventListener("visibilitychange", this._onVis);
    this.seed();
  }

  destroy() {
    this.stop();
    window.removeEventListener("resize", this._onResize);
    document.removeEventListener("visibilitychange", this._onVis);
  }

  setTheme(theme) {
    this.theme = theme === "dark" ? "dark" : "light";
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, Math.floor(rect.width));
    this.h = Math.max(1, Math.floor(rect.height));
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
  }

  seed() {
    const count = Math.max(52, Math.min(90, Math.floor((this.w * this.h) / 18000)));
    this.points = Array.from({ length: count }).map(() => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: 1.2 + Math.random() * 1.2,
    }));
  }

  start() {
    if (this.running || prefersReducedMotion()) {
      this.drawStatic();
      return;
    }
    this.running = true;
    const loop = () => {
      this.step();
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  step() {
    for (const p of this.points) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -20) p.x = this.w + 20;
      if (p.x > this.w + 20) p.x = -20;
      if (p.y < -20) p.y = this.h + 20;
      if (p.y > this.h + 20) p.y = -20;
    }
  }

  drawStatic() {
    this.draw(true);
  }

  draw(staticOnly = false) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue("--accent").trim() || "#1e6f5c";
    const accent2 = styles.getPropertyValue("--accent2").trim() || "#b08968";

    const maxDist = 160;

    // Edges
    ctx.lineWidth = 1;
    for (let i = 0; i < this.points.length; i++) {
      for (let j = i + 1; j < this.points.length; j++) {
        const a = this.points[i];
        const b = this.points[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > maxDist) continue;
        const t = 1 - d / maxDist;
        ctx.strokeStyle = `rgba(30, 111, 92, ${0.18 * t})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // Nodes
    for (let idx = 0; idx < this.points.length; idx++) {
      const p = this.points[idx];
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 14);
      g.addColorStop(0, this.theme === "dark" ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.12)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = idx % 2 === 0 ? accent : accent2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (staticOnly) return;
  }
}

function setLang(next) {
  if (!state.content) return;
  if (!(next in state.content)) next = DEFAULT_LANG;
  state.lang = next;
  localStorage.setItem("lang", next);

  const langData = state.content[next];
  $all(".lang-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.lang === next));
  setMeta(langData);
  applyI18n(langData);
  applyProfileLinks(langData);
  updateThemeToggle(langData);

  renderAbout(langData);
  renderFocus(langData);
  renderHeroFeature(langData);
  renderPipeline(langData);
  renderSkills(langData);
  renderProjects(langData);
  renderToolbox(langData);
  renderExperience(langData);
  renderEducation(langData);
  renderCertifications(langData);
  renderLab(langData);
  renderQuickLinks(langData);

  // Progressive enhancement re-binders after re-render.
  setupCardTilt();
  setupCmdk();
}

async function bootstrap() {
  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  // FX canvas
  const fxCanvas = $("#fx-canvas");
  if (fxCanvas) {
    try {
      const fx = new FxCanvas(fxCanvas);
      fx.init();
      state.fx = fx;
    } catch (err) {
      console.warn("FX canvas disabled:", err);
    }
  }

  applyTheme(getPreferredTheme());

  // Language buttons
  $all(".lang-btn").forEach((b) => {
    b.addEventListener("click", () => {
      withViewTransition(() => setLang(b.dataset.lang || "en"));
    });
  });

  // Theme toggle
  const themeBtn = $("#theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      withViewTransition(() => {
        applyTheme(state.theme === "dark" ? "light" : "dark");
        const langData = state.content ? state.content[state.lang] : null;
        updateThemeToggle(langData);
      });
    });
  }
  updateThemeToggle(null);

  // Copy email on right click (nice but optional)
  const emailBtn = $("#contact-email");
  if (emailBtn) {
    emailBtn.addEventListener("contextmenu", async (ev) => {
      ev.preventDefault();
      const txt = emailBtn.textContent || "";
      try {
        await navigator.clipboard.writeText(txt);
      } catch {
        // ignore
      }
    });
  }

  // Close modal with transitions
  const modal = $("#project-modal");
  if (modal) {
    modal.addEventListener("close", () => {
      state.currentProjectId = null;
    });
  }

  setupDialogs();
  setupReveal();
  setupScrollProgress();

  try {
    const res = await fetch("content.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load content.json: ${res.status}`);
    state.content = await res.json();
    setLang(state.lang);
    if (state.fx) {
      state.fx.setTheme(state.theme);
      state.fx.start();
    }
  } catch (err) {
    console.error(err);
    const about = $("#about-content");
    if (about) about.textContent = "Content failed to load. Please try again.";
  }
}

window.addEventListener("DOMContentLoaded", bootstrap);
