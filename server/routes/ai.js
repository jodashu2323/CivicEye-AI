
const express = require("express");
const router = express.Router();

const CATEGORIES = [
  "Road Damage",
  "Street Light",
  "Garbage",
  "Water Supply",
  "Drainage",
  "Other",
];

const SEVERITIES = ["Low", "Medium", "High", "Critical"];
const PRIORITIES = ["Normal", "Important", "Urgent"];

const OLLAMA_URL = (
  process.env.OLLAMA_URL || "http://127.0.0.1:11434"
).replace(/\/$/, "");

const OLLAMA_MODEL =
  process.env.OLLAMA_VISION_MODEL ||
  process.env.OLLAMA_MODEL ||
  "llama3.2:3b";

// Existing backup analysis
const generateFallbackAnalysis = (title, description) => {
  const text = `${title} ${description}`.toLowerCase();

  let category = "Other";
  let severity = "Medium";
  let priority = "Important";

  if (/pothole|road|highway|street damage|broken road|sadak|gaddha/.test(text)) {
    category = "Road Damage";
  } else if (/street light|streetlight|light not working|dark street|lamp post/.test(text)) {
    category = "Street Light";
  } else if (/garbage|trash|waste|rubbish|dustbin|kachra|kuda/.test(text)) {
    category = "Garbage";
  } else if (/water supply|no water|water shortage|water leakage|drinking water|pani/.test(text)) {
    category = "Water Supply";
  } else if (/drainage|sewage|drain|blocked drain|overflow|gutter|naali/.test(text)) {
    category = "Drainage";
  }

  if (/death|fatal|collapsed|collapse|severe accident|injured|electrocution|exposed live wire|sewage flooding/.test(text)) {
    severity = "Critical";
    priority = "Urgent";
  } else if (/dangerous|major|emergency|accident|overflow|blocked|large pothole|no water|not working|broken|leakage/.test(text)) {
    severity = "High";
    priority = "Urgent";
  } else if (/minor|small|slight|occasionally|sometimes/.test(text)) {
    severity = "Low";
    priority = "Normal";
  }

  const summary =
    description.length > 180
      ? `${description.substring(0, 177)}...`
      : description;

  return {
    category,
    severity,
    priority,
    summary,
    reason:
      "Backup analysis generated using complaint keywords and predefined civic issue rules because Ollama was unavailable.",
  };
};

// Validate Ollama response
const normalizeResult = (result) => {
  return {
    category: CATEGORIES.includes(result.category)
      ? result.category
      : "Other",

    severity: SEVERITIES.includes(result.severity)
      ? result.severity
      : "Medium",

    priority: PRIORITIES.includes(result.priority)
      ? result.priority
      : "Important",

    summary:
      typeof result.summary === "string" && result.summary.trim()
        ? result.summary.trim()
        : "Complaint analyzed.",

    reason:
      typeof result.reason === "string" && result.reason.trim()
        ? result.reason.trim()
        : "Based on the reported civic issue.",
  };
};

// Extract JSON even if model adds markdown or extra text
const parseAIResponse = (content) => {
  const cleaned = content
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("Ollama returned an invalid JSON response.");
  }

  return JSON.parse(cleaned.substring(start, end + 1));
};

// Generate analysis using local Ollama
const generateOllamaAnalysis = async (title, description, location) => {
  const prompt = `
You are CivicEye AI, an assistant that analyzes civic complaints.

Analyze the following complaint carefully.

Title: ${title}
Description: ${description}
Location: ${location}

Return ONLY valid JSON. Do not include markdown or extra text.

Use exactly this structure:
{
  "category": "Road Damage",
  "severity": "High",
  "priority": "Urgent",
  "summary": "Short complaint summary",
  "reason": "Explain why this category, severity and priority were selected"
}

Allowed categories: Road Damage, Street Light, Garbage, Water Supply, Drainage, Other.
Allowed severity: Low, Medium, High, Critical.
Allowed priority: Normal, Important, Urgent.

Do not exaggerate severity. Use only information stated in the complaint.
`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You analyze civic complaints and return accurate JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        stream: false,
        format: "json",
        options: {
          temperature: 0.2,
          num_predict: 400,
        },
        keep_alive: "10m",
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data?.message?.content;

    if (!content) {
      throw new Error("Ollama returned an empty response.");
    }

    return parseAIResponse(content);
  } finally {
    clearTimeout(timeout);
  }
};

// Main AI analysis route
router.post("/analyze", async (req, res) => {
  try {
    const { title, description, location } = req.body || {};

    if (
      typeof title !== "string" ||
      typeof description !== "string" ||
      !title.trim() ||
      !description.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required.",
      });
    }

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const cleanLocation =
      typeof location === "string" && location.trim()
        ? location.trim()
        : "Not provided";

    let result;
    let analysisSource = "ollama";

    try {
      const aiResult = await generateOllamaAnalysis(
        cleanTitle,
        cleanDescription,
        cleanLocation
      );

      result = normalizeResult(aiResult);
      console.log("✅ Civic complaint analyzed using Ollama.");
    } catch (error) {
      console.error(
        "Ollama analysis failed. Using backup analysis:",
        error.message
      );

      result = generateFallbackAnalysis(
        cleanTitle,
        cleanDescription
      );

      analysisSource = "fallback";
    }

    const {
      category,
      severity,
      priority,
      summary,
      reason,
    } = result;

    const analysis = [
      `Category: ${category}`,
      `Severity: ${severity}`,
      `Priority: ${priority}`,
      `Summary: ${summary}`,
      `Reason: ${reason}`,
    ].join("\n");

    return res.json({
      success: true,
      category,
      severity,
      priority,
      summary,
      reason,
      analysis,
      analysisSource,
    });
  } catch (error) {
    console.error("AI ANALYSIS ERROR:", error.message || error);

    return res.status(500).json({
      success: false,
      message: "Analysis could not be completed.",
    });
  }
});

module.exports = router;
