/* eslint-disable no-console */
(() => {
  "use strict";

  const DEFAULT_LANG = (() => {
    const navLang = (navigator.language || "").toLowerCase();
    return navLang.startsWith("pt") ? "pt" : "en";
  })();

  const state = {
    content: null,
    lang: localStorage.getItem("lang") || DEFAULT_LANG,
  };

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function $all(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function getByPath(obj, path) {
    const parts = path.split(".");
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
  }

  function renderList(parent, items, renderItem) {
    parent.innerHTML = "";
    const frag = document.createDocumentFragment();
    items.forEach((item) => frag.appendChild(renderItem(item)));
    parent.appendChild(frag);
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

  function renderProjects(langData) {
    const grid = $("#projects-grid");
    if (!grid) return;
    renderList(grid, langData.projects || [], (p) => {
      const card = document.createElement("article");
      card.className = "card";

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
      card.appendChild(h);
      card.appendChild(p);
      if (ed.note) card.appendChild(extra);
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
    renderAbout(langData);
    renderFocus(langData);
    renderSkills(langData);
    renderProjects(langData);
    renderExperience(langData);
    renderEducation(langData);
    renderQuickLinks(langData);
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

  async function bootstrap() {
    const year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());

    $all(".lang-btn").forEach((b) => {
      b.addEventListener("click", () => setLang(b.dataset.lang || "en"));
    });

    setupReveal();

    try {
      const res = await fetch("content.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load content.json: ${res.status}`);
      state.content = await res.json();
      setLang(state.lang);
    } catch (err) {
      console.error(err);
      const about = $("#about-content");
      if (about) about.textContent = "Content failed to load. Please try again.";
    }
  }

  window.addEventListener("DOMContentLoaded", bootstrap);
})();
