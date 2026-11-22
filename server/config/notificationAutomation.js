const Issue = require("../models/Issue");
const User = require("../models/user");
const Notification = require("../models/Notification");
const { getIO } = require("./socket");

// Keep the original Notification.create method.
const originalNotificationCreate = Notification.create.bind(Notification);

// Emit notification after it is saved in MongoDB.
Notification.create = async function (...args) {
  const result = await originalNotificationCreate(...args);

  try {
    const notifications = Array.isArray(result) ? result : [result];
    const io = getIO();

    notifications.forEach((notification) => {
      const recipientId = notification.recipient.toString();

      io.to(`user:${recipientId}`).emit(
        "new_notification",
        notification
      );
    });
  } catch (error) {
    console.error("Notification socket emit error:", error);
  }

  return result;
};

// Keep the original Issue.save method.
const originalIssueSave = Issue.prototype.save;

// Automatically notify admins when a new complaint is saved.
Issue.prototype.save = async function (...args) {
  const isNewIssue = this.isNew;

  const savedIssue = await originalIssueSave.apply(this, args);

  if (isNewIssue) {
    try {
      const admins = await User.find({ role: "admin" }).select("_id");

      if (admins.length > 0) {
        const adminNotifications = admins.map((admin) => ({
          recipient: admin._id,
          issue: savedIssue._id,
          title: "New Complaint Received",
          message: `A new complaint "${savedIssue.title}" has been submitted.`,
          type: "complaint_created",
        }));

        await Notification.create(adminNotifications);
      }
    } catch (error) {
      console.error("Admin notification creation error:", error);
    }
  }

  return savedIssue;
};

console.log("Notification automation initialized.");