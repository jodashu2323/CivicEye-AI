
const mongoose = require("mongoose");

const issueSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Prevents the same submission from creating multiple complaints.
    idempotencyKey: {
      type: String,
      trim: true,
      immutable: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      enum: [
        "Road Damage",
        "Street Light",
        "Garbage",
        "Water Supply",
        "Drainage",
        "Other",
      ],
      default: "Other",
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    latitude: {
      type: Number,
      default: null,
      min: -90,
      max: 90,
    },

    longitude: {
      type: Number,
      default: null,
      min: -180,
      max: 180,
    },

    image: {
      type: String,
      default: "",
    },

    aiCategory: {
      type: String,
      default: "Other",
    },

    aiPriority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },

    aiSummary: {
      type: String,
      default: "",
    },

    aiConfidence: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["Pending", "In Progress", "Resolved"],
      default: "Pending",
    },

    statusHistory: {
      type: [
        {
          status: {
            type: String,
            enum: ["Pending", "In Progress", "Resolved"],
            required: true,
          },
          note: {
            type: String,
            default: "",
          },
          changedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: function () {
        return [
          {
            status: this.status || "Pending",
            note: "Complaint submitted",
            changedAt: this.createdAt || new Date(),
          },
        ];
      },
    },
  },
  {
    timestamps: true,
  }
);

// A user cannot create two issues with the same submission key.
// Old issues without a key are excluded from this index.
issueSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" },
    },
  }
);

module.exports = mongoose.model("Issue", issueSchema);
