/**
 * app.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Main application controller for SupportAI.
 *
 * Responsibilities:
 *   - Initialises the app on DOMContentLoaded
 *   - Manages application state (language, escalation, history)
 *   - Orchestrates LangDetect → FAQEngine → ClaudeAPI → ChatUI pipeline
 *   - Handles language selector dropdown and manual language override
 *   - Controls sidebar toggle (mobile), escalation flow, and chat reset
 *
 * Dependencies (loaded before this script in index.html):
 *   - LangDetect  (src/utils/langDetect.js)
 *   - FAQEngine   (src/utils/faqEngine.js)
 *   - ClaudeAPI   (src/utils/claudeApi.js)
 *   - ChatUI      (src/components/chatUI.js)
 *
 * Exports: App  (global, referenced by inline onclick handlers in index.html)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const App = (() => {

  // ─── Application State ────────────────────────────────────────────────────

  const state = {
    /** Currently active language code ('en', 'hi', 'hinglish', etc.) */
    currentLang: 'en',

    /**
     * Manually-selected language override.
     * null  = auto-detect from each message
     * string = locked to this language regardless of input
     */
    manualLang: null,

    /** True while a bot reply is being generated (blocks duplicate sends) */
    isBotTyping: false,

    /** True after the user has been escalated to a human agent */
    isEscalated: false,

    /**
     * Conversation history sent to Claude API for context.
     * Format: [{ role: 'user'|'assistant', content: string }, ...]
     */
    conversationHistory: [],
  };

  // ─── DOM reference cache ──────────────────────────────────────────────────
  // Populated once after DOMContentLoaded to avoid repeated querySelector calls.

  let dom = {};

  function cacheDOM() {
    dom = {
      messageInput:    document.getElementById('messageInput'),
      sendBtn:         document.getElementById('sendBtn'),
      langBanner:      document.getElementById('langBanner'),
      langBannerText:  document.getElementById('langBannerText'),
      detectBadge:     document.getElementById('detectBadge'),
      detectBadgeLabel:document.getElementById('detectBadgeLabel'),
      sidebarLangPill: document.getElementById('sidebarLangPill'),
      escalationNotice:document.getElementById('escalationNotice'),
      escalateBtn:     document.getElementById('escalateBtn'),
      sidebar:         document.getElementById('sidebar'),
      menuBtn:         document.getElementById('menuBtn'),
      sidebarCloseBtn: document.getElementById('sidebarCloseBtn'),
      langSelectorBtn: document.getElementById('langSelectorBtn'),
      langSelectorLabel:document.getElementById('langSelectorLabel'),
      langDropdown:    document.getElementById('langDropdown'),
    };
  }

  // ─── Initialisation ───────────────────────────────────────────────────────

  function init() {
    cacheDOM();
    bindEventListeners();
    showWelcomeMessage();
  }

  function bindEventListeners() {
    // Send on Enter (not Shift+Enter)
    dom.messageInput.addEventListener('keydown', handleInputKeydown);

    // Auto-resize textarea as user types
    dom.messageInput.addEventListener('input', () => autoResizeTextarea(dom.messageInput));

    // Sidebar open/close (mobile)
    dom.menuBtn.addEventListener('click', () => dom.sidebar.classList.add('sidebar--open'));
    dom.sidebarCloseBtn.addEventListener('click', () => dom.sidebar.classList.remove('sidebar--open'));

    // Close language dropdown when clicking outside
    document.addEventListener('click', event => {
      const clickedOutside =
        !dom.langSelectorBtn.contains(event.target) &&
        !dom.langDropdown.contains(event.target);

      if (clickedOutside) {
        dom.langDropdown.classList.add('hidden');
        dom.langSelectorBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ─── Welcome message ──────────────────────────────────────────────────────

  function showWelcomeMessage() {
    const chips = FAQEngine.getChips('en');
    ChatUI.addBotMessage(
      '👋 Hello! I am **SupportAI**, your multilingual customer support assistant.\n\n' +
      'I understand **Hindi, Hinglish, Arabic, Spanish, French** and more — ' +
      'just type in whatever feels natural!\n\nHow can I help you today?',
      chips
    );
  }

  // ─── Core send pipeline ───────────────────────────────────────────────────

  /**
   * Reads the input, runs it through the detection → FAQ → Claude pipeline,
   * and renders the reply.
   */
  async function sendMessage() {
    const text = dom.messageInput.value.trim();
    if (!text || state.isBotTyping) return;

    // Clear input immediately
    dom.messageInput.value = '';
    dom.messageInput.style.height = 'auto';
    dom.sendBtn.disabled = true;

    ChatUI.addUserMessage(text);

    // If already escalated to human, just acknowledge the message
    if (state.isEscalated) {
      await pause(700);
      ChatUI.addBotMessage(
        getLocalisedString('escalatedAck', state.currentLang)
      );
      dom.sendBtn.disabled = false;
      return;
    }

    // ── Step 1: detect language ──────────────────────────────────────────────
    const lang = state.manualLang || LangDetect.detect(text);
    state.currentLang = lang;
    updateLanguageUI(lang);

    state.isBotTyping = true;
    ChatUI.showTypingIndicator();

    // ── Step 2: check for human-agent request ────────────────────────────────
    if (isHumanAgentRequest(text)) {
      await pause(1000);
      ChatUI.removeTypingIndicator();
      state.isBotTyping = false;
      ChatUI.addBotMessage(getLocalisedString('escalationAck', lang));
      await pause(700);
      escalateToHuman();
      dom.sendBtn.disabled = false;
      return;
    }

    // ── Step 3: check for greeting ───────────────────────────────────────────
    if (LangDetect.isGreeting(text)) {
      await pause(800);
      ChatUI.removeTypingIndicator();
      state.isBotTyping = false;
      const chips = FAQEngine.getChips(lang);
      ChatUI.addBotMessage(FAQEngine.getGreetingReply(lang), chips);
      dom.sendBtn.disabled = false;
      return;
    }

    // ── Step 4: FAQ keyword match ────────────────────────────────────────────
    const faqResult = FAQEngine.match(text, lang);

    if (faqResult && faqResult.answer !== null) {
      await pause(900 + Math.random() * 300); // human-feeling delay
      ChatUI.removeTypingIndicator();
      state.isBotTyping = false;
      ChatUI.addBotMessage(faqResult.answer);
      state.conversationHistory.push(
        { role: 'user',      content: text },
        { role: 'assistant', content: faqResult.answer }
      );
      dom.sendBtn.disabled = false;
      return;
    }

    // ── Step 5: Claude API ───────────────────────────────────────────────────
    state.conversationHistory.push({ role: 'user', content: text });
    await pause(300); // let typing indicator show briefly

    const reply = await ClaudeAPI.send(text, lang, state.conversationHistory);
    ChatUI.removeTypingIndicator();
    state.isBotTyping = false;
    ChatUI.addBotMessage(reply);
    state.conversationHistory.push({ role: 'assistant', content: reply });

    dom.sendBtn.disabled = false;
  }

  // ─── Send from chip ───────────────────────────────────────────────────────

  /**
   * Triggered when a FAQ suggestion chip is tapped.
   * Fills the input and sends immediately.
   * @param {string} query
   */
  function sendQuery(query) {
    dom.messageInput.value = query;
    sendMessage();
  }

  // ─── FAQ panel ────────────────────────────────────────────────────────────

  /** Shows a fresh set of suggestion chips in the chat */
  function showFAQPanel() {
    const lang  = state.currentLang;
    const chips = FAQEngine.getChips(lang);

    const promptText = {
      en:       'Here are some things I can help with:',
      hi:       'मैं इनमें से किसी भी मुद्दे में मदद कर सकता हूँ:',
      hinglish: 'Yeh rahi common queries — tap karo ya apna sawaal poochho:',
      ar:       'إليك بعض الأمور التي يمكنني مساعدتك بها:',
      es:       'Aquí hay algunas cosas con las que puedo ayudarte:',
    };

    ChatUI.addBotMessage(promptText[lang] || promptText.en, chips);
  }

  // ─── Escalation ───────────────────────────────────────────────────────────

  /** Triggers the human-agent escalation flow */
  function escalateToHuman() {
    state.isEscalated = true;

    dom.escalationNotice.classList.remove('hidden');
    dom.escalateBtn.disabled = true;

    const messages = {
      en:       '✅ You have been connected to a **live human agent**. Your full conversation has been shared.\n\nEstimated wait: **~3 minutes** (you are #2 in queue).',
      hi:       '✅ आपको **लाइव एजेंट** से जोड़ दिया गया है। अनुमानित प्रतीक्षा: **~3 मिनट**।',
      hinglish: '✅ Aapko **live agent** se connect kar diya gaya! Queue mein #2 hain — wait **~3 minutes**. Tension mat lo! 😊',
      ar:       '✅ تم توصيلك بوكيل بشري. وقت الانتظار المقدر: **~3 دقائق**.',
      es:       '✅ Has sido conectado con un **agente humano**. Tiempo de espera estimado: **~3 minutos**.',
    };

    ChatUI.addBotMessage(messages[state.currentLang] || messages.en);
  }

  /**
   * Returns true if the user is explicitly requesting a human agent.
   * @param {string} text
   */
  function isHumanAgentRequest(text) {
    const lower = text.toLowerCase();
    const triggers = [
      'human', 'agent', 'real person', 'person', 'operator', 'representative',
      'insaan', 'banda', 'kisi se baat', 'baat karni', 'live support',
      'talk to someone', 'speak to', 'connect me',
    ];
    return triggers.some(trigger => lower.includes(trigger));
  }

  // ─── Language selector ────────────────────────────────────────────────────

  /** Toggles the language dropdown open/closed */
  function toggleLangDropdown() {
    const isHidden = dom.langDropdown.classList.contains('hidden');
    dom.langDropdown.classList.toggle('hidden', !isHidden);
    dom.langSelectorBtn.setAttribute('aria-expanded', String(isHidden));
  }

  /**
   * Locks the UI to a specific language, or restores auto-detect.
   * @param {string} lang  Language code, or 'auto'
   */
  function setLanguage(lang) {
    // Close dropdown
    dom.langDropdown.classList.add('hidden');
    dom.langSelectorBtn.setAttribute('aria-expanded', 'false');

    // Update active option in dropdown
    dom.langDropdown.querySelectorAll('.lang-dropdown__item').forEach(item => {
      item.classList.toggle('lang-dropdown__item--active', item.dataset.lang === lang);
      item.setAttribute('aria-selected', String(item.dataset.lang === lang));
    });

    // Update button label
    const buttonLabels = {
      auto: 'Auto', en: 'EN', hi: 'HI', hinglish: 'HI+EN',
      ar: 'AR', es: 'ES', fr: 'FR', de: 'DE',
    };
    dom.langSelectorLabel.textContent = buttonLabels[lang] || 'Auto';

    if (lang === 'auto') {
      state.manualLang = null;
      updateLanguageUI('en');
      dom.langBannerText.textContent =
        'Auto-detect is back on — just type in any language and I will figure it out!';
      ChatUI.addBotMessage(
        '🌐 Auto-detect is back on! Just type in any language and I will respond accordingly.'
      );
    } else {
      state.manualLang = lang;
      state.currentLang = lang;
      updateLanguageUI(lang);

      const confirmMessages = {
        en:       '🌐 Language locked to **English**. All my replies will be in English.',
        hi:       '🌐 भाषा **हिंदी** पर सेट कर दी गई है। सभी जवाब हिंदी में आएंगे।',
        hinglish: '🌐 Language **Hinglish** pe set kar di! Ab main Hinglish mein baat karunga. 😊',
        ar:       '🌐 تم تعيين اللغة على **العربية**. ستكون جميع الردود بالعربية.',
        es:       '🌐 Idioma establecido en **Español**. Todas las respuestas serán en español.',
        fr:       '🌐 Langue définie sur **Français**. Toutes les réponses seront en français.',
        de:       '🌐 Sprache auf **Deutsch** eingestellt. Alle Antworten auf Deutsch.',
      };
      ChatUI.addBotMessage(confirmMessages[lang] || confirmMessages.en);
    }
  }

  // ─── Language UI update ───────────────────────────────────────────────────

  /**
   * Updates all language-related UI elements (banner, detect badge, sidebar pill).
   * @param {string} lang
   */
  function updateLanguageUI(lang) {
    const meta = LangDetect.getMeta(lang);

    // Detect badge (topbar)
    dom.detectBadge.className    = `topbar__detect-badge ${meta.badgeClass}`;
    dom.detectBadgeLabel.textContent = meta.label;

    // Banner below topbar
    dom.langBanner.className     = `lang-banner ${meta.bannerClass}`;
    dom.langBannerText.textContent = meta.bannerText;

    // Sidebar session pill
    dom.sidebarLangPill.textContent = meta.label;
    dom.sidebarLangPill.className   = `lang-pill ${meta.pillClass}`;
  }

  // ─── Chat reset ───────────────────────────────────────────────────────────

  /** Resets the entire chat to its initial state */
  function resetChat() {
    // Reset state
    state.currentLang        = 'en';
    state.manualLang         = null;
    state.isBotTyping        = false;
    state.isEscalated        = false;
    state.conversationHistory = [];

    // Reset UI elements
    ChatUI.clearFeed();
    dom.escalationNotice.classList.add('hidden');
    dom.escalateBtn.disabled = false;
    dom.sendBtn.disabled     = false;
    dom.sidebar.classList.remove('sidebar--open');

    // Reset language selector
    dom.langSelectorLabel.textContent = 'Auto';
    dom.langDropdown.querySelectorAll('.lang-dropdown__item').forEach(item => {
      item.classList.toggle('lang-dropdown__item--active', item.dataset.lang === 'auto');
      item.setAttribute('aria-selected', String(item.dataset.lang === 'auto'));
    });

    updateLanguageUI('auto');
    showWelcomeMessage();
  }

  // ─── Input helpers ────────────────────────────────────────────────────────

  /**
   * Sends on Enter, allows Shift+Enter for line breaks.
   * @param {KeyboardEvent} event
   */
  function handleInputKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  /**
   * Grows the textarea vertically as the user types (up to max-height).
   * @param {HTMLTextAreaElement} el
   */
  function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 110) + 'px';
  }

  // ─── Localised strings ────────────────────────────────────────────────────

  const LOCALISED = {
    escalatedAck: {
      en:       'Your message has been forwarded to the agent. They will be with you shortly.',
      hi:       'आपका संदेश एजेंट को भेज दिया गया है। वे जल्द ही आपसे जुड़ेंगे।',
      hinglish: 'Aapka message agent ko forward ho gaya — woh abhi aapke paas aayenge!',
      ar:       'تم إرسال رسالتك إلى الوكيل. سيتواصل معك قريباً.',
      es:       'Tu mensaje ha sido enviado al agente. Estará contigo pronto.',
    },
    escalationAck: {
      en:       'Of course! Let me connect you with a live support agent right away.',
      hi:       'ज़रूर! मैं आपको अभी एक लाइव एजेंट से जोड़ता हूँ।',
      hinglish: 'Bilkul yaar! Main abhi ek live agent se connect karta hoon tumhare liye.',
      ar:       'بالتأكيد! سأوصلك بوكيل دعم حي الآن.',
      es:       '¡Por supuesto! Te conecto con un agente en vivo ahora mismo.',
    },
  };

  function getLocalisedString(key, lang) {
    return LOCALISED[key]?.[lang] || LOCALISED[key]?.en || '';
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  /** Returns a Promise that resolves after `ms` milliseconds */
  function pause(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', init);

  // ─── Public API ───────────────────────────────────────────────────────────
  // Methods referenced by onclick handlers in index.html

  return {
    sendMessage,
    sendQuery,
    showFAQPanel,
    escalateToHuman,
    toggleLangDropdown,
    setLanguage,
    resetChat,
    handleInputKeydown,
    autoResizeTextarea,
  };

})();
