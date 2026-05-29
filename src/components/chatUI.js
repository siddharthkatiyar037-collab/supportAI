/**
 * chatUI.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles all DOM rendering for the chat feed:
 *   - Bot and user message bubbles
 *   - Animated typing indicator
 *   - FAQ suggestion chip rows
 *   - Minimal Markdown parsing (**bold**, newlines)
 *   - Auto-scroll to latest message
 *
 * Exports: ChatUI  (global)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const ChatUI = (() => {

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Returns the messages container element */
  const feed = () => document.getElementById('messages');

  /** Returns current time as "HH:MM" */
  function currentTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /** Scrolls the message feed to the very bottom */
  function scrollToBottom() {
    const el = feed();
    if (el) el.scrollTop = el.scrollHeight;
  }

  /**
   * Converts minimal Markdown to HTML.
   * Supports: **bold**, \n → <br>
   * @param  {string} text
   * @returns {string}
   */
  function parseMarkdown(text) {
    return text
      .replace(/</g, '&lt;')                          // escape HTML entities first
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // **bold**
      .replace(/\n/g, '<br>');                        // line breaks
  }

  // ─── Message row factory ───────────────────────────────────────────────────

  /**
   * Creates and appends a message row (bot or user) to the feed.
   * @param  {string} role   'bot' | 'user'
   * @param  {string} html   Already-parsed HTML string for bubble content
   * @returns {HTMLElement}  The outermost message wrapper
   */
  function createMessageRow(role, html) {
    const wrapper = document.createElement('div');
    wrapper.className = `message message--${role}`;

    const avatarIcon = role === 'bot' ? 'ti-robot' : 'ti-user';

    wrapper.innerHTML = `
      <div class="message__avatar" aria-hidden="true">
        <i class="ti ${avatarIcon}"></i>
      </div>
      <div class="message__body">
        <div class="message__bubble">${html}</div>
        <div class="message__time">${currentTime()}</div>
      </div>
    `;

    feed().appendChild(wrapper);
    scrollToBottom();
    return wrapper;
  }

  // ─── Public: addBotMessage ─────────────────────────────────────────────────

  /**
   * Renders a bot message bubble, optionally with FAQ suggestion chips.
   *
   * @param  {string} text         Message text (supports **bold** and \n)
   * @param  {Array}  chips        Optional array of { label, query } chip objects
   * @returns {HTMLElement}        The message wrapper element
   */
  function addBotMessage(text, chips = []) {
    const wrapper = createMessageRow('bot', parseMarkdown(text));

    // Attach chips if provided
    if (chips.length > 0) {
      const chipsContainer = document.createElement('div');
      chipsContainer.className = 'faq-chips';

      chips.forEach(chip => {
        const button = document.createElement('button');
        button.className = 'faq-chip';
        button.textContent = chip.label;
        // Chips call back into App — loose coupling via onclick
        button.onclick = () => App.sendQuery(chip.query);
        chipsContainer.appendChild(button);
      });

      wrapper.querySelector('.message__body').appendChild(chipsContainer);
    }

    return wrapper;
  }

  // ─── Public: addUserMessage ────────────────────────────────────────────────

  /**
   * Renders a user message bubble.
   * Text is escaped (no Markdown) to display as-is.
   *
   * @param  {string} text
   * @returns {HTMLElement}
   */
  function addUserMessage(text) {
    // For user messages: escape HTML but do not parse Markdown
    const escaped = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return createMessageRow('user', escaped);
  }

  // ─── Public: showTypingIndicator ─────────────────────────────────────────

  /**
   * Inserts an animated "bot is typing" indicator into the feed.
   * Call removeTypingIndicator() to remove it.
   */
  function showTypingIndicator() {
    const wrapper = document.createElement('div');
    wrapper.className = 'message message--bot';
    wrapper.id = 'typingIndicator';

    wrapper.innerHTML = `
      <div class="message__avatar" aria-hidden="true">
        <i class="ti ti-robot"></i>
      </div>
      <div class="message__body">
        <div class="message__bubble">
          <div class="typing-indicator" aria-label="Bot is typing">
            <span class="typing-indicator__dot"></span>
            <span class="typing-indicator__dot"></span>
            <span class="typing-indicator__dot"></span>
          </div>
        </div>
      </div>
    `;

    feed().appendChild(wrapper);
    scrollToBottom();
  }

  // ─── Public: removeTypingIndicator ────────────────────────────────────────

  /**
   * Removes the typing indicator from the feed, if present.
   */
  function removeTypingIndicator() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
  }

  // ─── Public: clearFeed ────────────────────────────────────────────────────

  /**
   * Clears all messages from the feed.
   */
  function clearFeed() {
    const el = feed();
    if (el) el.innerHTML = '';
  }

  // ─── Expose public API ────────────────────────────────────────────────────

  return {
    addBotMessage,
    addUserMessage,
    showTypingIndicator,
    removeTypingIndicator,
    clearFeed,
    scrollToBottom,
  };

})();
