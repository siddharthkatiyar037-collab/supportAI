

const ClaudeAPI = (() => {

  // ─── Configuration ──────────────────────────────────────────────────────────

  const API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
  const API_KEY      = 'YOUR_API_KEY'; // Get free key at console.groq.com
  const MODEL        = 'llama-3.3-70b-versatile';
  const MAX_TOKENS   = 300;
  const TEMPERATURE  = 0.7;

  // Maximum conversation turns sent for context
  const MAX_HISTORY_TURNS = 10;

  // ─── Language-tuned system prompts ──────────────────────────────────────────

  const SYSTEM_PROMPTS = {
    en:
      'You are SupportAI, a friendly customer support bot. ' +
      'Reply in clear helpful English. 2-3 sentences max. ' +
      'Never invent order details, prices, or policies.',

    hi:
      'You are SupportAI. Reply ONLY in Hindi (Devanagari script). ' +
      'Be warm and helpful. 2-3 sentences.',

    hinglish:
      'You are SupportAI, a friendly Indian support bot. ' +
      'Reply in natural Hinglish mixing Hindi and English like Indians chat casually. ' +
      'Use phrases: bilkul, theek hai, koi baat nahi, zaroor, tension mat lo, abhi check karta hoon. ' +
      'Keep it warm and casual — like a helpful friend. 2-3 sentences.',

    ar:
      'You are SupportAI. Reply ONLY in Arabic. ' +
      'Be warm and helpful. 2-3 sentences.',

    es:
      'You are SupportAI. Reply in friendly Spanish. 2-3 sentences.',

    fr:
      'You are SupportAI. Reply in friendly French. 2-3 sentences.',

    de:
      'You are SupportAI. Reply in friendly German. 2-3 sentences.',
  };

  // ─── Fallback messages (shown when API call fails) ───────────────────────────

  const FALLBACK_MESSAGES = {
    en:       'I am having trouble connecting right now. Please try again or escalate to a human agent.',
    hi:       'कनेक्शन में समस्या है। कृपया फिर से प्रयास करें।',
    hinglish: 'Yaar thodi technical problem aa gayi — dobara try karo!',
    ar:       'هناك مشكلة في الاتصال. حاول مرة أخرى.',
    es:       'Hay un problema de conexión. Inténtalo de nuevo.',
    fr:       'Problème de connexion. Veuillez réessayer.',
    de:       'Verbindungsproblem. Bitte erneut versuchen.',
  };

  // ─── Public: send(userMessage, lang, history) ────────────────────────────────

  /**
   * Sends a message to the Groq API and returns the AI reply.
   *
   * @param  {string} userMessage  Raw user input
   * @param  {string} lang         Detected or manually-set language code
   * @param  {Array}  history      Array of { role: 'user'|'assistant', content: string }
   * @returns {Promise<string>}    The bot's reply text
   */
  async function send(userMessage, lang = 'en', history = []) {
    const systemPrompt = SYSTEM_PROMPTS[lang] || SYSTEM_PROMPTS.en;

    // Build messages array: system prompt + trimmed history + new user message
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-MAX_HISTORY_TURNS).map(m => ({
        role:    m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ];

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model:       MODEL,
          messages:    messages,
          max_tokens:  MAX_TOKENS,
          temperature: TEMPERATURE,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        console.error('[GroqAPI] HTTP error:', response.status, errorBody);
        throw new Error(`HTTP ${response.status}`);
      }

      const data  = await response.json();
      const reply = data.choices?.[0]?.message?.content;

      if (!reply) {
        console.warn('[GroqAPI] Empty response:', data);
        return FALLBACK_MESSAGES[lang] || FALLBACK_MESSAGES.en;
      }

      return reply;

    } catch (error) {
      console.error('[GroqAPI] Request failed:', error);
      return FALLBACK_MESSAGES[lang] || FALLBACK_MESSAGES.en;
    }
  }

  // ─── Expose public API ────────────────────────────────────────────────────

  return { send };

})();
