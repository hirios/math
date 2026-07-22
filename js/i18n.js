/* Internationalization (i18n) Module - Meadow Math */

/**
 * i18n system for Meadow Math
 * Supports English (US), Vietnamese, and Brazilian Portuguese
 * Translations are loaded from JSON files in /lang/{locale}/ folders
 * 
 * Folder structure:
 *   lang/
 *     en/
 *       common.json      - Shared translations (nav, buttons, feedback)
 *       prek.json        - Pre-K section translations
 *       kindergarten.json
 *       grade1.json - grade5.json
 *     vi/
 *       common.json
 *       prek.json
 *       kindergarten.json
 *       grade1.json - grade5.json
 *     pt/
 *       common.json
 *       prek.json
 *       kindergarten.json
 *       grade1.json - grade5.json
 */

/* Resolve the lang/ folder from this script's own URL.
   i18n.js always lives in js/, so lang/ is always its sibling - this works at
   any page depth (/, /grade1/, /tools/clock/, /grade1/activities/) and under
   any deploy root (domain root or a GitHub Pages /repo/ subpath), with no
   depth counting. document.currentScript is valid here because this file runs
   at parse time. */
const LANG_BASE = (() => {
  const el = document.currentScript || document.querySelector('script[src$="js/i18n.js"]');
  if (el && el.src) {
    return new URL('../lang', el.src).href;
  }
  return './lang'; // last-resort fallback
})();

/* Persistent translation cache (localStorage), stale-while-revalidate.
   The pages ship hardcoded English, so a returning visitor who picked pt/vi
   used to watch English for ~1.1s while four sequential fetches completed.
   Caching lets us apply the right language synchronously, before first paint;
   the network copy is fetched anyway and re-applied only if it differs, so a
   deploy that changes the JSON still lands on the next visit. */
const LangCache = {
  prefix: 'meadowmath-i18n:',

  key(lang, name) {
    return `${this.prefix}${lang}:${name}`;
  },

  get(lang, name) {
    try {
      const raw = localStorage.getItem(this.key(lang, name));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null; // storage blocked, quota, or corrupt entry
    }
  },

  set(lang, name, data) {
    try {
      localStorage.setItem(this.key(lang, name), JSON.stringify(data));
    } catch (e) {
      // Quota exceeded: drop our own entries and retry once. The section
      // files run ~50KB each, so a few languages can fill a tight quota.
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith(this.prefix))
          .forEach(k => localStorage.removeItem(k));
        localStorage.setItem(this.key(lang, name), JSON.stringify(data));
      } catch (e2) { /* give up - memory cache still works */ }
    }
  }
};

const i18n = {
  // Current language
  currentLang: 'en',

  // Loaded translations (merged common + section-specific)
  translations: {},

  // Default fallback language
  fallbackLang: 'en',

  // Supported languages
  supportedLanguages: ['en', 'vi', 'pt'],

  // Available sections (for lazy loading)
  sections: ['prek', 'kinder', 'kindergarten', 'grade1', 'grade2', 'grade3', 'grade4', 'grade5', 'tools', 'about'],

  // In-memory translations, seeded from localStorage then refreshed
  cache: {
    en: {},
    vi: {},
    pt: {}
  },

  // Which files have been revalidated over the network this session.
  // Separate from `cache` so a localStorage-seeded value still gets refetched.
  fetched: {
    en: {},
    vi: {},
    pt: {}
  },

  // Flag to track if running from file:// protocol
  isFileProtocol: window.location.protocol === 'file:',

  // Promise that resolves when init() finishes
  _initPromise: null,

  /**
   * Get the base path for language files.
   * Derived once from this script's own URL - see LANG_BASE above.
   */
  getBasePath() {
    return LANG_BASE;
  },

  /**
   * Read the saved language preference into currentLang.
   */
  resolveLanguage() {
    let savedLang = null;
    try {
      savedLang = localStorage.getItem('meadowmath-lang');
    } catch (e) { /* storage blocked */ }
    if (savedLang && this.supportedLanguages.includes(savedLang)) {
      this.currentLang = savedLang;
    }
    document.documentElement.lang = this.currentLang;
  },

  /**
   * Seed the in-memory cache from localStorage and apply straight away.
   * Runs synchronously at script parse time, so for a returning visitor the
   * correct language is in the DOM before the browser paints - no flicker.
   * Returns true if the current language was fully served from cache.
   */
  primeFromCache(section) {
    const lang = this.currentLang;
    let complete = true;

    const common = LangCache.get(lang, 'common');
    if (common) {
      this.cache[lang].common = common;
      this.translations[lang] = { ...common };
    } else {
      complete = false;
    }

    if (section) {
      const data = LangCache.get(lang, section);
      if (data) {
        this.cache[lang][section] = data;
        this.translations[lang] = { ...this.translations[lang], section: data };
      } else {
        complete = false;
      }
    }

    if (this.translations[lang]) {
      this.applyTranslations();
    }
    return complete;
  },

  /**
   * Initialize the i18n system.
   *
   * Ordering matters here:
   *  - the current language's common + section are fetched in PARALLEL and
   *    are the only things the first paint waits on;
   *  - the English fallback only supplies keys missing from the current
   *    language, so it loads in the background and re-applies when it lands
   *    rather than blocking (it used to double the critical path).
   */
  async init() {
    const section = this.detectCurrentSection();

    // Network fetches for the current language, in parallel.
    const wanted = [this.loadCommon(this.currentLang)];
    if (section) wanted.push(this.loadSection(this.currentLang, section));

    // Fallback loads off the critical path.
    let fallbackDone = Promise.resolve();
    if (this.currentLang !== this.fallbackLang) {
      const fb = [this.loadCommon(this.fallbackLang)];
      if (section) fb.push(this.loadSection(this.fallbackLang, section));
      fallbackDone = Promise.all(fb).then(() => this.applyTranslations());
    }

    await Promise.all(wanted);
    this.applyTranslations();

    // Elements parsed after this script (a couple of activity pages) and any
    // markup added between parse time and DOM ready still need a pass.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.applyTranslations();
        this.setupLanguageButtons();
      }, { once: true });
    } else {
      this.setupLanguageButtons();
    }

    // ready() must not resolve until the fallback is merged too, otherwise the
    // 306 activity pages that `await i18n.ready()` could read a key that only
    // exists in English and get the raw key string back.
    await fallbackDone;
  },

  /**
   * Returns a promise that resolves when the initial i18n.init() completes.
   * Useful for activities that need translations before rendering dynamic text.
   */
  ready() {
    return this._initPromise || Promise.resolve();
  },

  /**
   * Detect which section we're currently in based on URL
   */
  detectCurrentSection() {
    const path = window.location.pathname.toLowerCase();

    for (const section of this.sections) {
      if (path.includes(`/${section}/`) || path.includes(`/${section}.`) || path.endsWith(`/${section}`)) {
        return section;
      }
    }

    return null;
  },

  /**
   * Merge common translations without clobbering an already-merged section.
   * (This used to assign `{ ...data }` outright, which was safe only because
   * common was always awaited before section. Now that they load in parallel,
   * assignment would drop whichever landed first.)
   */
  mergeCommon(lang, data) {
    this.translations[lang] = { ...this.translations[lang], ...data };
  },

  /**
   * Load common translations for a language.
   * Guarded by `fetched`, not by the in-memory cache: a value seeded from
   * localStorage must still be revalidated over the network once per session.
   */
  async loadCommon(lang) {
    if (this.fetched[lang].common) {
      this.mergeCommon(lang, this.cache[lang].common);
      return;
    }

    try {
      const basePath = this.getBasePath();
      const response = await fetch(`${basePath}/${lang}/common.json`);

      if (!response.ok) {
        throw new Error(`Failed to load common translations for ${lang}`);
      }

      const data = await response.json();
      this.cache[lang].common = data;
      this.fetched[lang].common = true;
      LangCache.set(lang, 'common', data);
      this.mergeCommon(lang, data);
    } catch (error) {
      console.warn(`Could not load common translations for ${lang}:`, error);
      if (this.cache[lang].common) {
        // Offline or 404: the cached copy is better than falling back to keys.
        this.mergeCommon(lang, this.cache[lang].common);
      } else if (!this.translations[lang]) {
        this.translations[lang] = {};
      }
    }
  },

  /**
   * Load section-specific translations for a language
   */
  async loadSection(lang, section) {
    const merge = data => {
      // Wrap section translations under 'section' key for data-i18n attributes
      this.translations[lang] = { ...this.translations[lang], section: data };
    };

    if (this.fetched[lang][section]) {
      merge(this.cache[lang][section]);
      return;
    }

    try {
      const basePath = this.getBasePath();
      const response = await fetch(`${basePath}/${lang}/${section}.json`);

      if (!response.ok) {
        throw new Error(`Failed to load ${section} translations for ${lang}`);
      }

      const data = await response.json();
      this.cache[lang][section] = data;
      this.fetched[lang][section] = true;
      LangCache.set(lang, section, data);
      merge(data);
    } catch (error) {
      console.warn(`Could not load ${section} translations for ${lang}:`, error);
      if (this.cache[lang][section]) {
        merge(this.cache[lang][section]); // keep the cached copy
      }
    }
  },

  /**
   * Get a translation by key (supports nested keys like "nav.home" or "section.activities.countBerries.title")
   */
  t(key) {
    const keys = key.split('.');
    let value = this.translations[this.currentLang];

    // Navigate through nested keys
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Try fallback language
        value = this.translations[this.fallbackLang];
        if (!value) return key;

        for (const fk of keys) {
          if (value && typeof value === 'object' && fk in value) {
            value = value[fk];
          } else {
            return key; // Return key if not found
          }
        }
        break;
      }
    }

    return typeof value === 'string' ? value : key;
  },

  /**
   * Get a raw value by key (returns objects, arrays, or strings)
   * Use this for complex data structures like Learn More content
   */
  getRaw(key) {
    const keys = key.split('.');

    // Try current language first
    let value = this.translations[this.currentLang];
    let found = true;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        found = false;
        break;
      }
    }

    if (found && value !== undefined) {
      return value;
    }

    // Try fallback language
    value = this.translations[this.fallbackLang];
    if (!value) return null;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return null;
      }
    }

    return value !== undefined ? value : null;
  },

  /**
   * Apply translations to all elements with data-i18n attribute
   */
  applyTranslations() {
    const elements = document.querySelectorAll('[data-i18n]');

    elements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translation = this.t(key);

      if (translation !== key) {
        el.textContent = translation;
      }
    });

    // Handle placeholder translations
    const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
    placeholderElements.forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const translation = this.t(key);
      if (translation !== key) {
        el.placeholder = translation;
      }
    });

    // Handle title/aria-label translations
    const titleElements = document.querySelectorAll('[data-i18n-title]');
    titleElements.forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const translation = this.t(key);
      if (translation !== key) {
        el.title = translation;
        el.setAttribute('aria-label', translation);
      }
    });

    // Update page title if needed
    const titleEl = document.querySelector('title[data-i18n]');
    if (titleEl) {
      const titleKey = titleEl.getAttribute('data-i18n');
      const translation = this.t(titleKey);
      if (translation !== titleKey) {
        document.title = translation;
      }
    }
  },

  /**
   * Set up language button click handlers
   * Uses language buttons instead of dropdown
   */
  setupLanguageButtons() {
    const buttons = document.querySelectorAll('.lang-btn');

    buttons.forEach(btn => {
      const lang = btn.getAttribute('data-lang');

      // Set initial active state
      if (lang === this.currentLang) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }

      // Add click handler
      btn.addEventListener('click', async () => {
        if (lang === this.currentLang) return; // Already active

        await this.setLanguage(lang);

        // Update button states
        buttons.forEach(b => {
          const bLang = b.getAttribute('data-lang');
          if (bLang === lang) {
            b.classList.add('active');
            b.setAttribute('aria-pressed', 'true');
          } else {
            b.classList.remove('active');
            b.setAttribute('aria-pressed', 'false');
          }
        });
      });
    });
  },

  /**
   * Change the current language
   */
  async setLanguage(lang) {
    if (!this.supportedLanguages.includes(lang)) {
      console.warn(`Language "${lang}" not supported`);
      return;
    }

    this.currentLang = lang;

    // Save preference
    try {
      localStorage.setItem('meadowmath-lang', lang);
    } catch (e) { /* storage blocked */ }

    // Update HTML lang attribute
    document.documentElement.lang = lang;

    const currentSection = this.detectCurrentSection();

    // Show the cached copy immediately so the switch feels instant, then
    // refresh from network below.
    this.primeFromCache(currentSection);

    // Load in parallel rather than one after the other
    const pending = [this.loadCommon(lang)];
    if (currentSection) pending.push(this.loadSection(lang, currentSection));
    await Promise.all(pending);

    // Apply new translations
    this.applyTranslations();

    // Emit language change event for activities to listen to
    document.dispatchEvent(new CustomEvent('languageChanged', { 
      detail: { language: lang } 
    }));
  },

  /**
   * Preload translations for a specific section
   * Useful when navigating to a new section
   */
  async preloadSection(section) {
    for (const lang of this.supportedLanguages) {
      if (!this.cache[lang][section]) {
        await this.loadSection(lang, section);
      }
    }
  },

  /**
   * Get all translations for current language (useful for JavaScript access)
   */
  getTranslations() {
    return this.translations[this.currentLang] || {};
  },

  /**
   * Check if a translation key exists
   */
  hasTranslation(key) {
    return this.t(key) !== key;
  }
};

/* Bootstrap at parse time, not on DOMContentLoaded.
   This script tag sits after the translatable markup on every page, so the
   [data-i18n] elements already exist here. Applying the cached language now
   lands it before first paint - waiting for DOMContentLoaded and then four
   sequential fetches is what made English sit on screen for ~1.1s.

   Assigning _initPromise synchronously also closes a latent race: the 306
   activity pages that `await i18n.ready()` from an inline script used to get
   Promise.resolve() whenever they ran before DOMContentLoaded, and rendered
   with untranslated strings. */
i18n.resolveLanguage();
i18n.primeFromCache(i18n.detectCurrentSection());
i18n._initPromise = i18n.init();

// Export for use in other modules
window.i18n = i18n;

// Reload Grade 3 activities on language change to refresh dynamic strings
document.addEventListener('languageChanged', () => {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('/grade3/activities/')) {
    window.location.reload();
  }
});
