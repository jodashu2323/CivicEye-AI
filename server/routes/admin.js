
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Issue = require("../models/Issue");
const User = require("../models/user");
const Notification = require("../models/Notification");
const { auth, adminOnly } = require("../middleware/auth");

const ALLOWED_STATUSES = ["Pending", "In Progress", "Resolved"];

function isValidCoordinates(latitude, longitude) {
  if (
    latitude === null ||
    latitude === undefined ||
    latitude === "" ||
    longitude === null ||
    longitude === undefined ||
    longitude === ""
  ) {
    return false;
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

// Protect all admin routes.
router.use(auth, adminOnly);

// GET ALL COMPLAINTS
router.get("/issues", async (req, res) => {
  try {
    const issues = await Issue.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      issues,
    });
  } catch (error) {
    console.error("ADMIN GET ISSUES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load complaints.",
    });
  }
});

// SAVE / UPDATE COMPLAINT LOCATION
router.put("/issues/:id/location", async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid complaint ID.",
      });
    }

    if (!isValidCoordinates(latitude, longitude)) {
      return res.status(400).json({
        success: false,
        message: "Valid latitude and longitude are required.",
      });
    }

    const issue = await Issue.findById(id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found.",
      });
    }

    issue.latitude = Number(latitude);
    issue.longitude = Number(longitude);

    await issue.save();
    await issue.populate("userId", "name email");

    return res.status(200).json({
      success: true,
      message: "Complaint location saved successfully.",
      issue,
    });
  } catch (error) {
    console.error("ADMIN SAVE LOCATION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to save complaint location.",
    });
  }
});

// UPDATE COMPLAINT STATUS + CREATE NOTIFICATION
router.put("/issues/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid complaint ID.",
      });
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be Pending, In Progress, or Resolved.",
      });
    }

    const issue = await Issue.findById(id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found.",
      });
    }

    const statusChanged = issue.status !== status;

    if (statusChanged) {
      if (!Array.isArray(issue.statusHistory)) {
        issue.statusHistory = [];
      }

      if (issue.statusHistory.length === 0) {
        issue.statusHistory.push({
          status: issue.status || "Pending",
          note: "Complaint submitted",
          changedAt: issue.createdAt || new Date(),
        });
      }

      issue.status = status;

      issue.statusHistory.push({
        status,
        note:
          typeof note === "string" && note.trim()
            ? note.trim().slice(0, 500)
            : `Status changed to ${status}`,
        changedAt: new Date(),
      });

      await issue.save();

      // Notification errors must not undo a successful status update.
      if (issue.userId) {
        try {
          await Notification.create({
            recipient: issue.userId,
            issue: issue._id,
            title: "Complaint Status Updated",
            message: `Your complaint "${
              issue.title || issue.category || "Civic complaint"
            }" is now ${status}.`,
            type: "status_updated",
          });
        } catch (notificationError) {
          console.error(
            "STATUS NOTIFICATION CREATION ERROR:",
            notificationError
          );
        }
      }
    }

    await issue.populate("userId", "name email");

    return res.status(200).json({
      success: true,
      message: statusChanged
        ? "Complaint status updated successfully."
        : "Complaint already has this status.",
      issue,
    });
  } catch (error) {
    console.error("ADMIN UPDATE STATUS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update complaint status.",
    });
  }
});

// GET ALL USERS
router.get("/users", async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("ADMIN GET USERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load users.",
    });
  }
});

module.exports = router;
