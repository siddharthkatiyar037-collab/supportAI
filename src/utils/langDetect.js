/**
 * langDetect.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Detects the language of a user's message using three strategies:
 *   1. Unicode script ranges  → Devanagari (Hindi/Hinglish), Arabic
 *   2. Vocabulary scoring     → Hinglish (Latin-script Hindi words)
 *   3. Keyword heuristics     → Spanish, French, German, Portuguese
 *
 * Exports a single global object: LangDetect
 * Usage:
 *   const lang = LangDetect.detect("mera order kahan hai");  // → "hinglish"
 *   const meta = LangDetect.getMeta("hinglish");             // → { label, ... }
 * ─────────────────────────────────────────────────────────────────────────────
 */

const LangDetect = (() => {

  // ─── Unicode script ranges ──────────────────────────────────────────────────

  const SCRIPT = {
    devanagari: /[\u0900-\u097F]/,
    arabic:     /[\u0600-\u06FF]/,
    latin:      /[a-zA-Z]/,
  };

  // ─── Hinglish vocabulary ────────────────────────────────────────────────────
  // Common Hindi words written in Latin script (Romanised Hindi).
  // Two or more hits in a message → classify as Hinglish.

  const HINGLISH_VOCAB = new Set([
    // Pronouns & basic words
    'kya','hai','hain','mera','meri','mere','mujhe','aap','tum','hum','woh','yeh',
    // Question words
    'kahan','kaise','kyun','kyunki','kab','kitna','kaun','kuch','koi',
    // Common verbs
    'kar','karo','karna','ho','hona','hua','gaya','gayi','aana','jana','lena',
    'dena','dekho','suno','bata','batao','bhejo','samjho',
    // Responses & fillers
    'haan','nahi','nahin','theek','thik','acha','achha','bilkul','zaroor',
    'abhi','jaldi','bahut','zyada','thoda','bas','sab','sirf',
    // Social / casual
    'yaar','bhai','didi','please','tension',
    // Connectors
    'aur','ya','agar','toh','tab','phir','lekin','isliye','matlab',
    // Customer support specific
    'order','refund','payment','paise','rupaye','account','password','delivery',
    'shipping','cancel','problem','issue','dikkat','pareshani','galti',
    'milega','milegi','chahiye','chahte','band','chalu',
    // Common phrases (treated as single tokens)
    'help','please',
  ]);

  // ─── Greeting words ─────────────────────────────────────────────────────────
  // Used by the greeting detector — not part of language detection per se.

  const GREETING_TOKENS = new Set([
    'hi','hello','hey','hii','hiii','helo','heya','sup','wassup','yo','howdy',
    'namaste','namaskar','salam','salaam','marhaba','ahlan',
    'hola','bonjour','ciao','hallo',
  ]);

  // ─── Keyword rules for Latin-script languages ───────────────────────────────

  const KEYWORD_RULES = [
    {
      lang: 'es',
      words: ['hola','gracias','por favor','ayuda','necesito','quiero','buenos',
               'cómo','qué','dónde','señor','señora','estoy','tengo','quería'],
    },
    {
      lang: 'fr',
      words: ['bonjour','merci','s\'il vous','aide','besoin','comment','pourquoi',
               'madame','monsieur','voudrais','pouvez','français','j\'ai','j\'ai'],
    },
    {
      lang: 'de',
      words: ['hallo','danke','hilfe','bitte','warum','können','haben','möchte',
               'schön','ich','mein','wie','bitte','nein'],
    },
    {
      lang: 'pt',
      words: ['olá','obrigado','ajuda','preciso','quero','como','você','por favor'],
    },
  ];

  // ─── Public: detect(text) ───────────────────────────────────────────────────

  /**
   * Detects the language of the given text.
   * @param  {string} text  Raw user input
   * @returns {'en'|'hi'|'hinglish'|'ar'|'es'|'fr'|'de'|'pt'}
   */
  function detect(text) {
    if (!text || !text.trim()) return 'en';

    const hasDevanagari = SCRIPT.devanagari.test(text);
    const hasArabic     = SCRIPT.arabic.test(text);
    const hasLatin      = SCRIPT.latin.test(text);

    // Arabic script — quick return
    if (hasArabic && !hasDevanagari) return 'ar';

    // Pure Devanagari (no Latin letters at all)
    if (hasDevanagari && !hasLatin) return 'hi';

    // Mixed Devanagari + Latin → Hinglish
    if (hasDevanagari && hasLatin) return 'hinglish';

    // ── Latin-only text from here ──────────────────────────────────────────

    const lower  = text.toLowerCase();
    const tokens = lower.match(/\b[a-z']+\b/g) || [];
    const total  = tokens.length;

    // Hinglish vocabulary scoring
    const hinglishHits = tokens.filter(w => HINGLISH_VOCAB.has(w)).length;

    const isHinglish =
      hinglishHits >= 2 ||                                     // 2+ Hindi words
      (hinglishHits === 1 && total <= 5) ||                    // 1 Hindi word in short message
      (total > 3 && hinglishHits / total >= 0.25);             // >25% Hindi words

    if (isHinglish) return 'hinglish';

    // Check other Latin-script languages
    for (const rule of KEYWORD_RULES) {
      const hits = rule.words.filter(w => lower.includes(w)).length;
      if (hits >= 1) return rule.lang;
    }

    return 'en';
  }

  // ─── Public: isGreeting(text) ───────────────────────────────────────────────

  /**
   * Returns true if the message is a greeting or simple opening phrase.
   * Uses short-message heuristics to avoid false positives.
   * @param  {string} text
   * @returns {boolean}
   */
  function isGreeting(text) {
    const lower  = text.toLowerCase().trim();
    const tokens = lower.match(/[\w\u0900-\u097F\u0600-\u06FF]+/g) || [];

    // Whole message is a known greeting token
    if (GREETING_TOKENS.has(lower)) return true;

    // Short message (≤ 4 tokens) containing a greeting token
    if (tokens.length <= 4 && tokens.some(t => GREETING_TOKENS.has(t))) return true;

    // Devanagari "namaste" patterns
    if (/[\u0928\u092E\u0938\u094D\u0924\u0947]/.test(text)) return true;

    // Simple "help me" style openers
    if (/^(help( me)?|i need help|mujhe (madad|help) chahiye|help chahiye)$/i.test(lower)) return true;

    return false;
  }

  // ─── Public: getMeta(lang) ──────────────────────────────────────────────────

  /**
   * Returns display metadata for a detected language code.
   * Used by the app to update badges, banners, and pills.
   * @param  {string} lang
   * @returns {{ label, pillClass, badgeClass, bannerClass, bannerText }}
   */
  function getMeta(lang) {
    const map = {
      auto: {
        label: 'Auto',
        pillClass: 'lang-pill--en',
        badgeClass: '',
        bannerClass: '',
        bannerText: 'Type in any language — Hindi, Hinglish, English, Arabic, Spanish aur bhi!',
      },
      en: {
        label: 'EN',
        pillClass: 'lang-pill--en',
        badgeClass: '',
        bannerClass: '',
        bannerText: 'English detected — responding in English',
      },
      hi: {
        label: 'HI',
        pillClass: 'lang-pill--hindi',
        badgeClass: 'topbar__detect-badge--hindi',
        bannerClass: 'lang-banner--hindi',
        bannerText: 'Hindi detect hui — Hindi mein jawab dunga 🇮🇳',
      },
      hinglish: {
        label: 'HI+EN',
        pillClass: 'lang-pill--hinglish',
        badgeClass: 'topbar__detect-badge--hinglish',
        bannerClass: 'lang-banner--hinglish',
        bannerText: '🇮🇳 Hinglish detected — bilkul sahi jagah aaye ho!',
      },
      ar: {
        label: 'AR',
        pillClass: 'lang-pill--arabic',
        badgeClass: 'topbar__detect-badge--arabic',
        bannerClass: '',
        bannerText: 'تم اكتشاف العربية — سأرد بالعربية',
      },
      es: {
        label: 'ES',
        pillClass: 'lang-pill--spanish',
        badgeClass: 'topbar__detect-badge--spanish',
        bannerClass: '',
        bannerText: 'Español detectado — responderé en español',
      },
      fr: {
        label: 'FR',
        pillClass: 'lang-pill--en',
        badgeClass: '',
        bannerClass: '',
        bannerText: 'Français détecté — je répondrai en français',
      },
      de: {
        label: 'DE',
        pillClass: 'lang-pill--en',
        badgeClass: '',
        bannerClass: '',
        bannerText: 'Deutsch erkannt — ich antworte auf Deutsch',
      },
    };

    return map[lang] || map.en;
  }

  // ─── Expose public API ──────────────────────────────────────────────────────

  return { detect, isGreeting, getMeta };

})();
