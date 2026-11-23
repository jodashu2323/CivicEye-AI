
import { useEffect, useRef, useState } from "react";
import "./AssistantChat.css";

const API_URL = "http://localhost:5000/api/assistant/chat";

const WELCOME_MESSAGE = {
  role: "assistant",
  text: "Hello! 👋 I'm CivicEye AI Assistant. I can help you report civic issues, understand complaint categories and track your complaints.\n\nनमस्ते! मैं आपकी कैसे मदद कर सकता हूँ?",
};

function AssistantChat({ user, isPage, onOpenPage, onClosePage }) {
  const [isOpen, setIsOpen] = useState(false);
  const [language, setLanguage] = useState("both");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState([
    WELCOME_MESSAGE,
  ]);

  const messagesEndRef = useRef(null);

  // NEW: Chat window reference
  const chatWindowRef = useRef(null);

  // NEW: Floating toggle button reference
  const toggleButtonRef = useRef(null);

  // Prevent duplicate API requests.
  const requestInProgressRef = useRef(false);

  // Prevent an old response from appearing after Clear Chat.
  const chatSessionRef = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  // ==========================================
  // NEW: CLOSE CHAT ON OUTSIDE CLICK / TOUCH
  // ==========================================

  useEffect(() => {
    // Listener only runs while chatbot is open.
    if (!isOpen || isPage) return;

    const handleOutsideClick = (event) => {
      const target = event.target;

      // Ignore clicks inside chatbot window.
      if (chatWindowRef.current?.contains(target)) {
        return;
      }

      // Ignore clicks on floating toggle button.
      if (toggleButtonRef.current?.contains(target)) {
        return;
      }

      // Click outside: close chatbot.
      setIsOpen(false);
    };

    // Capture phase helps detect outside interactions
    // even if another element stops event propagation.
    document.addEventListener(
      "pointerdown",
      handleOutsideClick,
      true
    );

    return () => {
      // NEW: Remove listener when chatbot closes/unmounts.
      document.removeEventListener(
        "pointerdown",
        handleOutsideClick,
        true
      );
    };
  }, [isOpen, isPage]);

  // ==========================================
  // SEND MESSAGE
  // ==========================================

  const sendMessage = async (text = message) => {
    const trimmedMessage = text.trim();

    if (!trimmedMessage || requestInProgressRef.current) {
      return;
    }

    // Lock immediately to prevent double clicks.
    requestInProgressRef.current = true;

    const currentSession = chatSessionRef.current;

    const userMessage = {
      role: "user",
      text: trimmedMessage,
    };

    // Take previous messages before adding current message.
    const previousMessages = messages;

    setMessages((previous) => [
      ...previous,
      userMessage,
    ]);

    setMessage("");
    setLoading(true);

    try {
      // Keep recent conversation context.
      const history = previousMessages
        .filter(
          (item) =>
            ["user", "assistant"].includes(item.role) &&
            typeof item.text === "string"
        )
        .slice(-8)
        .map((item) => ({
          role: item.role,
          text: item.text,
        }));

      const userId = user?.id || user?._id;

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmedMessage,
          language,
          userId,
          history,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to get AI response."
        );
      }

      // Ignore response if user cleared the chat meanwhile.
      if (currentSession !== chatSessionRef.current) {
        return;
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text: data.reply || "Sorry, please try again.",
        },
      ]);

    } catch (error) {
      console.error("Assistant error:", error);

      if (currentSession !== chatSessionRef.current) {
        return;
      }

      let errorMessage =
        error.message ||
        "CivicEye AI is temporarily unavailable. Please try again.";

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text: errorMessage,
        },
      ]);

    } finally {
      requestInProgressRef.current = false;
      setLoading(false);
    }
  };

  // ==========================================
  // FORM SUBMIT
  // ==========================================

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  // ==========================================
  // CLEAR CHAT
  // ==========================================

  const clearChat = () => {
    // Invalidate any pending response.
    chatSessionRef.current += 1;

    setMessages([
      {
        ...WELCOME_MESSAGE,
      },
    ]);

    setMessage("");
  };

  // ==========================================
  // QUICK QUESTIONS
  // ==========================================

  const quickQuestions = [
    "How can I report a road issue?",
    "Suggest a complaint category",
    "Check my complaint status",
  ];

  return (
    <>
      {!isPage && (
        <>
          <button
            // NEW: Toggle button ref
            ref={toggleButtonRef}
            className="civic-ai-float"
            onClick={() => setIsOpen((previous) => !previous)}
            aria-label="Open CivicEye AI Assistant"
          >
            {isOpen ? "×" : "🤖"}
          </button>

          {isOpen && (
            <div
              // NEW: Chat window ref
              ref={chatWindowRef}
              className="civic-ai-window"
            >
              <div className="civic-ai-header">
                <div className="civic-ai-heading">
                  <div className="civic-ai-avatar">🤖</div>

                  <div>
                    <h3>CivicEye AI</h3>
                    <span>● Online Assistant</span>
                  </div>
                </div>

                <div className="civic-ai-header-actions">
                  <button
                    onClick={onOpenPage}
                    title="Open full assistant page"
                  >
                    ⛶
                  </button>

                  <button
                    onClick={() => setIsOpen(false)}
                  >
                    ×
                  </button>
                </div>
              </div>

              <ChatContent
                messages={messages}
                loading={loading}
                language={language}
                setLanguage={setLanguage}
                message={message}
                setMessage={setMessage}
                handleSubmit={handleSubmit}
                sendMessage={sendMessage}
                messagesEndRef={messagesEndRef}
                quickQuestions={quickQuestions}
              />
            </div>
          )}
        </>
      )}

      {isPage && (
        <div className="civic-ai-page">
          <div className="civic-ai-page-top">
            <button onClick={onClosePage}>
              ← Back to Home
            </button>

            <span>CivicEye AI Assistant</span>

            <button onClick={clearChat}>
              Clear Chat
            </button>
          </div>

          <div className="civic-ai-page-content">
            <div className="civic-ai-page-title">
              <div>🤖</div>

              <h1>Your Civic Support Assistant</h1>

              <p>
                Ask questions, get complaint guidance and understand
                civic services in Hindi or English.
              </p>
            </div>

            <ChatContent
              messages={messages}
              loading={loading}
              language={language}
              setLanguage={setLanguage}
              message={message}
              setMessage={setMessage}
              handleSubmit={handleSubmit}
              sendMessage={sendMessage}
              messagesEndRef={messagesEndRef}
              quickQuestions={quickQuestions}
              fullPage
            />
          </div>
        </div>
      )}
    </>
  );
}

// ==========================================
// CHAT CONTENT COMPONENT
// ==========================================

function ChatContent({
  messages,
  loading,
  language,
  setLanguage,
  message,
  setMessage,
  handleSubmit,
  sendMessage,
  messagesEndRef,
  quickQuestions,
  fullPage,
}) {
  return (
    <div
      className={`civic-ai-content ${
        fullPage ? "full-page-chat" : ""
      }`}
    >
      <div className="civic-ai-toolbar">
        <span>Choose language</span>

        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="both">
            Auto Hindi / English
          </option>

          <option value="english">
            English
          </option>

          <option value="hindi">
            हिंदी
          </option>
        </select>
      </div>

      <div className="civic-ai-messages">
        {messages.map((item, index) => (
          <div
            key={index}
            className={`civic-ai-message ${
              item.role === "user"
                ? "user-message"
                : "bot-message"
            }`}
          >
            {item.text}
          </div>
        ))}

        {loading && (
          <div className="civic-ai-message bot-message typing-message">
            CivicEye AI is typing...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="civic-ai-quick">
        {quickQuestions.map((question) => (
          <button
            key={question}
            onClick={() => sendMessage(question)}
            disabled={loading}
          >
            {question}
          </button>
        ))}
      </div>

      <form
        className="civic-ai-input"
        onSubmit={handleSubmit}
      >
        <input
          type="text"
          placeholder="Ask something... / कुछ पूछें..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={loading}
        />

        <button
          type="submit"
          disabled={loading || !message.trim()}
        >
          ➤
        </button>
      </form>
    </div>
  );
}

export default AssistantChat;
