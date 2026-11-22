
const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const Issue = require("../models/Issue");

// ==========================================
// 1. OLLAMA CONFIGURATION
// ==========================================

const OLLAMA_URL =
  process.env.OLLAMA_URL || "http://127.0.0.1:11434";

const MODEL =
  process.env.OLLAMA_MODEL || "llama3.2:3b";

// ==========================================
// 2. COMPLAINT STATUS INTENT DETECTION
// ==========================================

const isStatusQuestion = (message) => {
  const patterns = [
    /\b(check|show|tell me|get|see|track|tracking)\b.{0,60}\b(my|the)?\s*(complaint|issue|report)(s)?\b.{0,60}\b(status|update|progress)\b/i,
    /\b(my|the)\s+(complaint|issue|report)(s)?\s+(status|update|progress)\b/i,
    /\b(status|progress|update)\b.{0,50}\b(my|the)?\s*(complaint|issue|report)(s)?\b/i,
    /\b(meri|meri wali|apni)\s+(complaint|shikayat)\s+(ka|ki)\s+(status|update|progress)\b/i,
    /मेरी शिकायत का स्टेटस|मेरी शिकायत की स्थिति|शिकायत का स्टेटस|शिकायत की स्थिति|मेरी शिकायत कहाँ तक पहुँची|शिकायत ट्रैक/i,
  ];

  return patterns.some((pattern) => pattern.test(message));
};

// ==========================================
// 3. CLEAN CONVERSATION HISTORY
// ==========================================

const prepareHistory = (history) => {
  if (!Array.isArray(history)) return [];

  const cleaned = history
    .filter(
      (item) =>
        item &&
        ["user", "assistant"].includes(item.role) &&
        typeof item.text === "string" &&
        item.text.trim()
    )
    .slice(-8)
    .map((item) => ({
      role: item.role,
      content: item.text.trim().slice(0, 1200),
    }));

  // Conversation should start with a user message.
  while (cleaned.length && cleaned[0].role !== "user") {
    cleaned.shift();
  }

  // Merge consecutive messages with the same role.
  const normalized = [];

  for (const item of cleaned) {
    const last = normalized[normalized.length - 1];

    if (last && last.role === item.role) {
      last.content += "\n" + item.content;
    } else {
      normalized.push({ ...item });
    }
  }

  return normalized;
};

// ==========================================
// 4. GENERATE OLLAMA RESPONSE
// ==========================================

const generateAIResponse = async (messages) => {
  const controller = new AbortController();

  // Allow enough time for local model generation.
  const timeout = setTimeout(() => {
    controller.abort();
  }, 120000);

  try {
    console.log("Ollama request started.");

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: false,
        keep_alive: "10m",
        options: {
          temperature: 0.4,
          num_predict: 500,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();

      const error = new Error(
        `Ollama returned ${response.status}: ${errorText}`
      );

      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    const reply = data.message?.content?.trim();

    if (!reply) {
      throw new Error("Ollama returned an empty response.");
    }

    console.log("Ollama response generated successfully.");

    return reply;
  } catch (error) {
    console.error("Ollama request failed:", error.message);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

// ==========================================
// 5. CIVICEYE AI ASSISTANT CHAT API
// ==========================================

router.post("/chat", async (req, res) => {
  try {
    const {
      message,
      language = "both",
      userId,
      history = [],
    } = req.body;

    // Validate message
    if (
      !message ||
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a message.",
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Message must be under 2000 characters.",
      });
    }

    // Validate language
    const selectedLanguage = [
      "english",
      "hindi",
      "both",
    ].includes(language)
      ? language
      : "both";

    // ==========================================
    // 6. REAL COMPLAINT STATUS FROM MONGODB
    // ==========================================

    if (isStatusQuestion(message)) {
      if (!userId || !mongoose.isValidObjectId(userId)) {
        return res.json({
          success: true,
          reply:
            selectedLanguage === "english"
              ? "Please log in to check your complaint status."
              : "अपनी शिकायत का स्टेटस देखने के लिए कृपया लॉगिन करें।",
        });
      }

      const issues = await Issue.find({ userId })
        .select("title category status location createdAt")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      if (!issues.length) {
        return res.json({
          success: true,
          reply:
            selectedLanguage === "english"
              ? "You have not registered any complaints yet. You can report a civic issue using the Report an Issue section."
              : "आपने अभी तक कोई शिकायत दर्ज नहीं की है। आप Report an Issue सेक्शन से नई शिकायत दर्ज कर सकते हैं।",
        });
      }

      const issueDetails = issues
        .map((issue, index) => {
          const date = issue.createdAt
            ? new Date(issue.createdAt).toLocaleDateString("en-IN")
            : "Date unavailable";

          return (
            `${index + 1}. ${issue.title}\n` +
            `Category: ${issue.category}\n` +
            `Status: ${issue.status}\n` +
            `Location: ${issue.location || "Not specified"}\n` +
            `Reported on: ${date}`
          );
        })
        .join("\n\n");

      const reply =
        selectedLanguage === "english"
          ? `Here are your latest ${issues.length} complaints:\n\n${issueDetails}\n\nYou can open the My Complaints section for more details.`
          : `आपकी हाल की ${issues.length} शिकायतों की जानकारी:\n\n${issueDetails}\n\nअधिक जानकारी के लिए My Complaints सेक्शन देखें।`;

      return res.json({
        success: true,
        reply,
        issues,
      });
    }

    // ==========================================
    // 7. LANGUAGE INSTRUCTIONS
    // ==========================================

    let languageInstruction;

    if (selectedLanguage === "english") {
      languageInstruction =
        "Reply only in simple, natural English.";
    } else if (selectedLanguage === "hindi") {
      languageInstruction =
        "Reply only in simple, natural Hindi using Devanagari script.";
    } else {
      languageInstruction =
        "Reply in the same language as the user. Understand Hindi, English and Hinglish. If the user writes Hinglish, reply naturally in Hinglish.";
    }

    // ==========================================
    // 8. CIVICEYE AI SYSTEM INSTRUCTIONS
    // ==========================================

    const systemInstruction = `
You are CivicEye AI, a helpful and intelligent assistant
inside the CivicEye civic issue reporting application.

YOUR MAIN PURPOSE:
Help citizens understand, report and manage civic problems.

CONVERSATION BEHAVIOUR:

1. Understand the exact question before answering.
2. Give a relevant answer based on the user's actual message.
3. Use previous conversation messages to understand follow-up questions.
4. Do not give the same generic answer to different questions.
5. Do not repeat your previous answer unless the user asks you to.
6. Avoid unnecessary introductions and long explanations.
7. Give direct, useful and conversational answers.
8. If a question is unclear, ask one relevant clarification.
9. Greetings should receive natural, friendly replies.
10. Do not force every general conversation into a complaint.

CIVIC ISSUE GUIDANCE:

Help with:
- Road damage and potholes.
- Street lights.
- Garbage collection.
- Water supply.
- Drainage and sewage.
- Public infrastructure problems.

COMPLAINT WRITING:

When asked to draft a complaint:
- Suggest a suitable title.
- Write a clear description.
- Include location and details provided by the user.
- Do not invent missing information.
- Never claim that the complaint was submitted.

CATEGORY SUGGESTIONS:

Use only these categories:
- Road Damage
- Street Light
- Garbage
- Water Supply
- Drainage
- Other

COMPLAINT STATUS:

- Never invent complaint records or status.
- Actual complaint status comes from the application database.
- If asked about status, guide the citizen to My Complaints.

CIVIC AWARENESS:

Answer questions about cleanliness, waste management,
water conservation, public infrastructure and civic responsibilities.

LANGUAGE:
${languageInstruction}

RESPONSE STYLE:

- Friendly and natural, like a helpful chatbot.
- Prefer concise answers unless details are requested.
- Use bullet points when they improve readability.
- Use examples when useful.
- Avoid repeating the same opening sentence.
- Do not provide unrelated information.
- Never ask for passwords or OTPs.
- Never pretend to submit complaints.
- Guide users to Report an Issue when they want to register a complaint.
`;

    // ==========================================
    // 9. BUILD OLLAMA CONVERSATION
    // ==========================================

    const safeHistory = prepareHistory(history);

    const messages = [
      {
        role: "system",
        content: systemInstruction,
      },
      ...safeHistory,
      {
        role: "user",
        content: message.trim(),
      },
    ];

    // ==========================================
    // 10. GENERATE RESPONSE
    // ==========================================

    const reply = await generateAIResponse(messages);

    return res.json({
      success: true,
      reply,
    });
  } catch (error) {
    console.error(
      "CIVICEYE ASSISTANT ERROR:",
      error.message
    );

    // Ollama connection refused / not running
    const isConnectionError =
      error.cause?.code === "ECONNREFUSED" ||
      error.code === "ECONNREFUSED";

    if (isConnectionError) {
      return res.status(503).json({
        success: false,
        code: "OLLAMA_NOT_RUNNING",
        message:
          "Local AI service is not running. Please start Ollama and try again.",
      });
    }

    // Request timeout
    if (
      error.name === "AbortError" ||
      error.name === "TimeoutError"
    ) {
      return res.status(503).json({
        success: false,
        code: "AI_TIMEOUT",
        message:
          "AI is taking too long to respond. Please try again.",
      });
    }

    // Ollama model not found
    if (error.status === 404) {
      return res.status(503).json({
        success: false,
        code: "MODEL_NOT_FOUND",
        message:
          "The local AI model was not found. Please check your Ollama model installation.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong. Please try again.",
    });
  }
});

module.exports = router;
