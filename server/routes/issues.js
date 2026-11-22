
const express = require("express");
const router = express.Router();

const { GoogleGenAI } = require("@google/genai");
const mongoose = require("mongoose");

const Issue = require("../models/Issue");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { auth } = require("../middleware/auth");

const ALLOWED_CATEGORIES = [
  "Road Damage",
  "Street Light",
  "Garbage",
  "Water Supply",
  "Drainage",
  "Other",
];

const ALLOWED_PRIORITIES = ["Low", "Medium", "High", "Critical"];
const ALLOWED_STATUSES = ["Pending", "In Progress", "Resolved"];

// ======================================================
// CREATE ISSUE + AI ANALYSIS + NOTIFICATION
// ======================================================

router.post("/", auth, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      location,
      latitude,
      longitude,
      image,
    } = req.body || {};

    // DUPLICATE SUBMISSION PROTECTION
    const idempotencyKey = req.get("Idempotency-Key");

    if (
      typeof idempotencyKey !== "string" ||
      idempotencyKey.length < 8 ||
      idempotencyKey.length > 128
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission key. Please try submitting again.",
      });
    }

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof description !== "string" ||
      !description.trim() ||
      typeof location !== "string" ||
      !location.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields.",
      });
    }

    const hasLatitude =
      latitude !== undefined && latitude !== null && latitude !== "";

    const hasLongitude =
      longitude !== undefined && longitude !== null && longitude !== "";

    if (hasLatitude !== hasLongitude) {
      return res.status(400).json({
        success: false,
        message: "Please provide both latitude and longitude.",
      });
    }

    let savedLatitude = null;
    let savedLongitude = null;

    if (hasLatitude && hasLongitude) {
      savedLatitude = Number(latitude);
      savedLongitude = Number(longitude);

      if (
        !Number.isFinite(savedLatitude) ||
        !Number.isFinite(savedLongitude) ||
        savedLatitude < -90 ||
        savedLatitude > 90 ||
        savedLongitude < -180 ||
        savedLongitude > 180
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid latitude or longitude.",
        });
      }
    }

    // Ensure the unique index is initialized.
    await Issue.init();

    // Check whether this user already submitted this request.
    const existingIssue = await Issue.findOne({
      userId: req.user._id,
      idempotencyKey,
    });

    if (existingIssue) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: "This complaint has already been registered.",
        issue: existingIssue,
      });
    }

    let aiCategory = ALLOWED_CATEGORIES.includes(category)
      ? category
      : "Other";

    let aiPriority = "Medium";
    let aiSummary = description.trim();
    let aiConfidence = 70;

    // AI analysis remains optional.
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is missing");
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
      });

      const prompt = `
You are an AI civic issue analyzer.

Title: ${title.trim()}
Description: ${description.trim()}
Location: ${location.trim()}
Selected category: ${category || "Not provided"}

Allowed categories: Road Damage, Street Light, Garbage,
Water Supply, Drainage, Other.

Allowed priorities: Low, Medium, High, Critical.

Return only valid JSON:
{
  "category": "Road Damage",
  "priority": "High",
  "summary": "Short professional summary",
  "confidence": 95
}

Confidence must be a number between 0 and 100.
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      });

      if (!response.text) {
        throw new Error("AI returned an empty response");
      }

      const result = JSON.parse(response.text);

      if (ALLOWED_CATEGORIES.includes(result.category)) {
        aiCategory = result.category;
      }

      if (ALLOWED_PRIORITIES.includes(result.priority)) {
        aiPriority = result.priority;
      }

      if (typeof result.summary === "string" && result.summary.trim()) {
        aiSummary = result.summary.trim();
      }

      if (
        typeof result.confidence === "number" &&
        result.confidence >= 0 &&
        result.confidence <= 100
      ) {
        aiConfidence = result.confidence;
      }
    } catch (aiError) {
      console.error("Issue AI analysis failed:", aiError.message);

      aiCategory = ALLOWED_CATEGORIES.includes(category)
        ? category
        : "Other";

      aiPriority = "Medium";
      aiSummary = description.trim();
      aiConfidence = 0;
    }

    let issue;

    try {
      // UNIQUE INDEX prevents simultaneous duplicate submissions.
      issue = await Issue.create({
        userId: req.user._id,
        idempotencyKey,
        title: title.trim(),
        description: description.trim(),
        category: aiCategory,
        location: location.trim(),
        latitude: savedLatitude,
        longitude: savedLongitude,
        image: typeof image === "string" ? image : "",
        aiCategory,
        aiPriority,
        aiSummary,
        aiConfidence,
        status: "Pending",
        statusHistory: [
          {
            status: "Pending",
            note: "Complaint submitted",
            changedAt: new Date(),
          },
        ],
      });
    } catch (createError) {
      // Handle simultaneous duplicate requests.
      if (createError.code === 11000) {
        const duplicateIssue = await Issue.findOne({
          userId: req.user._id,
          idempotencyKey,
        });

        if (duplicateIssue) {
          return res.status(200).json({
            success: true,
            duplicate: true,
            message: "This complaint has already been registered.",
            issue: duplicateIssue,
          });
        }
      }

      throw createError;
    }

    // Notify all admins about the new complaint.
    try {
      const admins = await User.find({ role: "admin" }).select("_id");

      for (const admin of admins) {
        await Notification.create({
          recipient: admin._id,
          issue: issue._id,
          title: "New Complaint Received",
          message: `A new complaint "${issue.title}" has been submitted.`,
          type: "complaint_created",
        });
      }
    } catch (notificationError) {
      console.error("CREATE ADMIN NOTIFICATION ERROR:", notificationError);
    }

    // Notify the authenticated citizen.
    try {
      await Notification.create({
        recipient: req.user._id,
        issue: issue._id,
        title: "Complaint Registered",
        message: `Your complaint "${issue.title}" has been registered successfully.`,
        type: "complaint_created",
      });
    } catch (notificationError) {
      // Complaint remains saved even if notification creation fails.
      console.error("CREATE NOTIFICATION ERROR:", notificationError);
    }

    return res.status(201).json({
      success: true,
      duplicate: false,
      message: "Issue reported successfully",
      issue,
    });
  } catch (error) {
    console.error("CREATE ISSUE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create issue.",
    });
  }
});

// ======================================================
// GET ALL ISSUES - PUBLIC MAP
// ======================================================

router.get("/", async (req, res) => {
  try {
    const issues = await Issue.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    return res.json({ success: true, issues });
  } catch (error) {
    console.error("GET ALL ISSUES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch issues.",
    });
  }
});

// ======================================================
// GET AUTHENTICATED USER'S ISSUES
// ======================================================

router.get("/user", auth, async (req, res) => {
  try {
    const issues = await Issue.find({
      userId: req.user._id,
    }).sort({ createdAt: -1 });

    return res.json({ success: true, issues });
  } catch (error) {
    console.error("GET USER ISSUES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch issues.",
    });
  }
});

// ======================================================
// GET ONE ISSUE - OWNER OR ADMIN
// ======================================================

router.get("/:id", auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid complaint ID.",
      });
    }

    const issue = await Issue.findById(req.params.id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Issue not found.",
      });
    }

    if (
      issue.userId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot access this complaint.",
      });
    }

    return res.json({ success: true, issue });
  } catch (error) {
    console.error("GET ISSUE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch issue.",
    });
  }
});

// ======================================================
// UPDATE ISSUE STATUS - ADMIN
// ======================================================

router.put("/:id/status", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Administrator access required.",
      });
    }

    const { status, note } = req.body || {};

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status.",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid complaint ID.",
      });
    }

    const issue = await Issue.findById(req.params.id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Issue not found.",
      });
    }

    if (issue.status !== status) {
      issue.status = status;

      issue.statusHistory.push({
        status,
        note:
          typeof note === "string" && note.trim()
            ? note.trim()
            : `Status changed to ${status}`,
        changedAt: new Date(),
      });

      await issue.save();

      try {
        await Notification.create({
          recipient: issue.userId,
          issue: issue._id,
          title: "Complaint Status Updated",
          message: `Your complaint "${issue.title}" is now ${status}.`,
          type: "status_updated",
        });
      } catch (notificationError) {
        console.error("STATUS NOTIFICATION ERROR:", notificationError);
      }
    }

    return res.json({
      success: true,
      message: "Issue status updated successfully.",
      issue,
    });
  } catch (error) {
    console.error("UPDATE ISSUE STATUS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update issue status.",
    });
  }
});

module.exports = router;
