/**
 * faqEngine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Keyword-based FAQ matcher with pre-written multilingual answers.
 *
 * Flow:
 *   1. App calls FAQEngine.match(userText, lang)
 *   2. Engine scores each FAQ entry by keyword presence
 *   3. Returns the best-matching answer (or null → fall through to Claude API)
 *
 * Also provides:
 *   FAQEngine.getGreetingReply(lang)  → warm welcome in detected language
 *   FAQEngine.getChips(lang)          → suggestion chip data for a language
 *
 * Exports: FAQEngine  (global)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const FAQEngine = (() => {

  // ─── Greeting replies ────────────────────────────────────────────────────────
  // Shown when LangDetect.isGreeting() returns true.

  const GREETING_REPLIES = {
    en:       '👋 Hello! Great to have you here. I am **SupportAI** and I am ready to help.\n\nWhat can I assist you with today?',
    hi:       '👋 नमस्ते! मैं **SupportAI** हूँ — आपकी सेवा में हाज़िर हूँ।\n\nआज मैं आपकी कैसे मदद कर सकता हूँ?',
    hinglish: '👋 Heyyy! Kaise ho? Main **SupportAI** hoon — aapki koi bhi problem solve karne ke liye ready hoon! 😊\n\nBatao, kya help chahiye?',
    ar:       '👋 أهلاً وسهلاً! أنا **SupportAI** وأنا هنا لمساعدتك.\n\nكيف يمكنني مساعدتك اليوم؟',
    es:       '👋 ¡Hola! Soy **SupportAI** y estoy aquí para ayudarte.\n\n¿En qué puedo asistirte hoy?',
    fr:       '👋 Bonjour! Je suis **SupportAI**, votre assistant multilingue.\n\nComment puis-je vous aider aujourd\'hui?',
    de:       '👋 Hallo! Ich bin **SupportAI**. Wie kann ich Ihnen heute helfen?',
  };

  // ─── FAQ database ────────────────────────────────────────────────────────────
  // Each entry:
  //   id       → unique identifier
  //   keywords → array of substrings matched against lowercased user text
  //   answers  → map of lang → answer string (use **text** for bold)
  //              Set to null to trigger human escalation instead of a reply.

  const FAQ_DB = [
    {
      id: 'order_tracking',
      keywords: [
        'track', 'order', 'kahan', 'kahan hai', 'shipment', 'parcel',
        'tracking', 'mera order', 'where is my', 'shipped', 'dispatched',
        'delivery status', 'out for delivery',
      ],
      answers: {
        en:       '📦 Please share your **order ID** and I\'ll pull up real-time tracking info for you right away!',
        hi:       '📦 अपना **ऑर्डर ID** शेयर करें — मैं तुरंत आपका ट्रैकिंग स्टेटस बता दूँगा!',
        hinglish: '📦 Apna **order ID** share karo — main abhi tracking check karta hoon tumhare liye!',
        ar:       '📦 يرجى مشاركة **رقم طلبك** وسأتحقق من حالة الشحن فوراً!',
        es:       '📦 Por favor comparte tu **número de pedido** y verificaré el envío de inmediato.',
        fr:       '📦 Veuillez partager votre **numéro de commande** et je vérifierai immédiatement.',
        de:       '📦 Bitte teilen Sie Ihre **Bestellnummer** mit und ich überprüfe den Status sofort.',
      },
    },
    {
      id: 'refund',
      keywords: [
        'refund', 'wapas', 'paise wapas', 'money back', 'return',
        'refund chahiye', 'reimburse', 'chargeback', 'paisa wapas',
      ],
      answers: {
        en:       '💳 Refunds are processed within **5–7 business days**. Please share your order number and the reason for your return.',
        hi:       '💳 रिफंड **5–7 कार्य दिवसों** में प्रोसेस होती है। ऑर्डर नंबर और वापसी का कारण बताएं।',
        hinglish: '💳 Refund **5–7 business days** mein process hoti hai. Order number aur reason batao — main abhi request raise karta hoon!',
        ar:       '💳 تتم معالجة المبالغ المستردة خلال **5–7 أيام عمل**. يرجى مشاركة رقم الطلب وسبب الإرجاع.',
        es:       '💳 Los reembolsos se procesan en **5–7 días hábiles**. Comparte tu número de pedido y el motivo.',
        fr:       '💳 Les remboursements sont traités en **5–7 jours ouvrables**. Partagez votre numéro de commande.',
        de:       '💳 Rückerstattungen werden innerhalb von **5–7 Werktagen** bearbeitet. Bitte teilen Sie Ihre Bestellnummer mit.',
      },
    },
    {
      id: 'password_reset',
      keywords: [
        'password', 'reset password', 'forgot password', 'password bhool',
        'can\'t login', 'login problem', 'password reset karna', 'access issue',
      ],
      answers: {
        en:       '🔑 Click **"Forgot Password"** on the login page — a secure reset link will arrive in your email within 2 minutes.',
        hi:       '🔑 लॉगिन पेज पर **"Forgot Password"** क्लिक करें — रीसेट लिंक 2 मिनट में आपके ईमेल पर आ जाएगा।',
        hinglish: '🔑 Login page par **"Forgot Password"** click karo — 2 minute mein reset link tumhare email pe aa jaayega!',
        ar:       '🔑 انقر على **"نسيت كلمة المرور"** في صفحة تسجيل الدخول وسيصل رابط الإعادة خلال دقيقتين.',
        es:       '🔑 Haz clic en **"¿Olvidaste tu contraseña?"** en la página de inicio — te enviaremos un enlace en 2 minutos.',
        fr:       '🔑 Cliquez sur **"Mot de passe oublié?"** sur la page de connexion — un lien arrivera en 2 minutes.',
        de:       '🔑 Klicken Sie auf **"Passwort vergessen?"** auf der Anmeldeseite — ein Link kommt in 2 Minuten.',
      },
    },
    {
      id: 'cancel_order',
      keywords: [
        'cancel', 'order cancel', 'cancellation', 'band karo', 'cancel karna',
        'withdraw order', 'order cancel karna',
      ],
      answers: {
        en:       '❌ Orders can be cancelled within **24 hours** of placement. Share your order ID and I\'ll process it immediately.',
        hi:       '❌ ऑर्डर **24 घंटे** के अंदर कैंसिल हो सकता है। ऑर्डर ID बताएं — मैं अभी करता हूँ।',
        hinglish: '❌ Order **24 ghante** ke andar cancel ho sakta hai. Apna order ID batao — main abhi cancel kar deta hoon!',
        ar:       '❌ يمكن إلغاء الطلبات خلال **24 ساعة**. يرجى مشاركة رقم الطلب.',
        es:       '❌ Los pedidos pueden cancelarse dentro de **24 horas**. Comparte tu número de pedido.',
        fr:       '❌ Les commandes peuvent être annulées dans les **24 heures**. Partagez votre numéro.',
        de:       '❌ Bestellungen können innerhalb von **24 Stunden** storniert werden. Bitte teilen Sie Ihre Bestellnummer.',
      },
    },
    {
      id: 'payment_issue',
      keywords: [
        'payment', 'payment failed', 'payment issue', 'transaction', 'paid',
        'charge', 'billing', 'invoice', 'paisa', 'paise', 'amount deducted',
        'payment stuck', 'payment nahi hua',
      ],
      answers: {
        en:       '💰 For payment issues, share your **transaction ID** and I\'ll investigate right away. If the amount was deducted, it usually reverses within 3–5 business days.',
        hi:       '💰 अपना **ट्रांजेक्शन ID** शेयर करें — मैं तुरंत जाँच करूँगा।',
        hinglish: '💰 Payment issue ke liye apna **transaction ID** share karo. Agar amount deduct hua hai toh main 24 ghante mein resolve karunga!',
        ar:       '💰 يرجى مشاركة **معرّف المعاملة** وسأتحقق من الأمر فوراً.',
        es:       '💰 Para problemas de pago, comparte tu **ID de transacción** y lo investigaré.',
        fr:       '💰 Pour les problèmes de paiement, partagez votre **ID de transaction**.',
        de:       '💰 Bei Zahlungsproblemen teilen Sie bitte Ihre **Transaktions-ID** mit.',
      },
    },
    {
      id: 'delivery_delay',
      keywords: [
        'delay', 'late', 'nahi aaya', 'delivery late', 'slow', 'stuck',
        'not delivered', 'shipping delay', 'delayed', 'parcel nahi aaya',
        'order nahi aaya',
      ],
      answers: {
        en:       '🚚 Sorry about the delay! Share your **order ID** so I can check the current shipping status and escalate if needed.',
        hi:       '🚚 देरी के लिए माफी! **ऑर्डर ID** दीजिए ताकि मैं शिपिंग स्टेटस चेक कर सकूँ।',
        hinglish: '🚚 Yaar delay ke liye sorry! Apna **order ID** do — main abhi shipping status check karta hoon!',
        ar:       '🚚 نعتذر عن التأخير! يرجى مشاركة **رقم الطلب** حتى أتمكن من التحقق.',
        es:       '🚚 ¡Lo siento por el retraso! Comparte tu **número de pedido** para verificar el envío.',
        fr:       '🚚 Désolé pour le retard! Partagez votre **numéro de commande** pour vérifier.',
        de:       '🚚 Entschuldigung für die Verzögerung! Bitte teilen Sie Ihre **Bestellnummer** mit.',
      },
    },
    {
      id: 'human_agent',
      // Setting answers to null triggers human escalation flow in app.js
      keywords: [
        'human', 'agent', 'real person', 'person', 'operator', 'representative',
        'insaan', 'banda', 'kisi se baat', 'baat karni', 'live chat',
        'talk to someone', 'speak to', 'connect me',
      ],
      answers: null,
    },
  ];

  // ─── FAQ suggestion chips ─────────────────────────────────────────────────
  // Displayed below the welcome message as tappable shortcuts.

  const CHIP_SETS = {
    en: [
      { label: '📦 Track my order',    query: 'Where is my order?' },
      { label: '💳 Request a refund',  query: 'I need a refund' },
      { label: '🔑 Reset password',    query: 'I forgot my password' },
      { label: '❌ Cancel order',      query: 'Cancel my order' },
      { label: '💰 Payment issue',     query: 'I have a payment issue' },
      { label: '🚚 Delivery delay',    query: 'My delivery is late' },
      { label: '🧑 Talk to human',     query: 'I want to speak to a human agent' },
    ],
    hinglish: [
      { label: '📦 Order kahan hai',       query: 'Mera order kahan hai?' },
      { label: '💳 Refund chahiye',        query: 'Mujhe refund chahiye' },
      { label: '🔑 Password reset karo',   query: 'Password reset karna hai' },
      { label: '❌ Order cancel karo',     query: 'Order cancel karna hai' },
      { label: '💰 Payment issue hai',     query: 'Mera payment stuck hai' },
      { label: '🚚 Delivery late ho gayi', query: 'Delivery abhi tak nahi aayi' },
      { label: '🧑 Human se baat',         query: 'Kisi insaan se baat karni hai' },
    ],
    hi: [
      { label: '📦 ऑर्डर ट्रैक करें', query: 'मेरा ऑर्डर कहाँ है?' },
      { label: '💳 रिफंड चाहिए',      query: 'मुझे रिफंड चाहिए' },
      { label: '🔑 पासवर्ड रीसेट',    query: 'पासवर्ड भूल गया हूँ' },
      { label: '🧑 एजेंट से बात',      query: 'किसी से बात करनी है' },
    ],
    ar: [
      { label: '📦 تتبع الطلب',   query: 'أين طلبي؟' },
      { label: '💳 استرداد المبلغ', query: 'أريد استرداد المبلغ' },
      { label: '🧑 وكيل بشري',    query: 'أريد التحدث مع وكيل' },
    ],
    es: [
      { label: '📦 Rastrear pedido', query: '¿Dónde está mi pedido?' },
      { label: '💳 Reembolso',       query: 'Necesito un reembolso' },
      { label: '🧑 Hablar con alguien', query: 'Quiero hablar con una persona' },
    ],
  };

  // ─── Public: match(text, lang) ───────────────────────────────────────────────

  /**
   * Finds the best-matching FAQ entry for the given user text.
   *
   * @param  {string} text  Lowercased user input
   * @param  {string} lang  Detected language code
   * @returns {{ id: string, answer: string|null }|null}
   *   - null            → no match, caller should use Claude API
   *   - { answer: null} → human escalation trigger
   *   - { answer: str } → pre-written reply string
   */
  function match(text, lang = 'en') {
    const lower = text.toLowerCase();

    for (const faq of FAQ_DB) {
      const matched = faq.keywords.some(keyword => lower.includes(keyword));
      if (!matched) continue;

      if (faq.answers === null) {
        return { id: faq.id, answer: null }; // → escalation
      }

      const answer = faq.answers[lang] || faq.answers.en;
      return { id: faq.id, answer };
    }

    return null; // → no match
  }

  // ─── Public: getGreetingReply(lang) ─────────────────────────────────────────

  /**
   * Returns a warm greeting reply in the specified language.
   * @param  {string} lang
   * @returns {string}
   */
  function getGreetingReply(lang) {
    return GREETING_REPLIES[lang] || GREETING_REPLIES.en;
  }

  // ─── Public: getChips(lang) ──────────────────────────────────────────────────

  /**
   * Returns FAQ suggestion chips for a given language.
   * @param  {string} lang
   * @returns {Array<{ label: string, query: string }>}
   */
  function getChips(lang) {
    return CHIP_SETS[lang] || CHIP_SETS.en;
  }

  // ─── Expose public API ───────────────────────────────────────────────────────

  return { match, getGreetingReply, getChips };

})();
