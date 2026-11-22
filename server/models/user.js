
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    role: {
      type: String,
      enum: ["citizen", "admin"],
      default: "citizen",
    },
  },
  {
    timestamps: true,
  }
);

// Hash passwords before saving new or modified passwords.
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  // Keep existing bcrypt hashes unchanged.
  if (
    typeof this.password === "string" &&
    /^\$2[aby]\$\d{2}\$/.test(this.password)
  ) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (typeof candidatePassword !== "string") return false;

  // Support legacy plaintext passwords during migration.
  if (!/^\$2[aby]\$\d{2}\$/.test(this.password)) {
    return candidatePassword === this.password;
  }

  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
