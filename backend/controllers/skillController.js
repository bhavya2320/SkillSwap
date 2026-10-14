const Skill = require("../models/Skill");

const validTypes = ["teach", "learn"];
const validLevels = ["Beginner", "Intermediate", "Advanced"];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.addSkill = async (req, res) => {
  try {
    const { name, type, level, description } = req.body;
    const normalizedName = typeof name === "string" ? name.trim() : "";

    if (!normalizedName || !validTypes.includes(type)) {
      return res.status(400).json({
        message: "A skill name and a type of teach or learn are required",
      });
    }

    if (level !== undefined && !validLevels.includes(level)) {
      return res.status(400).json({
        message: "Level must be Beginner, Intermediate, or Advanced",
      });
    }

    const skill = await Skill.create({
      userId: String(req.userId),
      userName: req.user.name,
      name: normalizedName,
      type,
      level,
      description,
    });

    return res.status(201).json({
      message: "Skill added successfully",
      skill,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getSkills = async (req, res) => {
  try {
    const { search, type, userId } = req.query;
    const filter = {};

    if (search) {
      filter.name = { $regex: escapeRegex(String(search)), $options: "i" };
    }

    if (type) {
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          message: "Type must be teach or learn",
        });
      }
      filter.type = type;
    }

    if (userId) {
      filter.userId = userId;
    }

    const skills = await Skill.find(filter).sort({ createdAt: -1 });
    return res.json({ count: skills.length, skills });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateSkill = async (req, res) => {
  try {
    const { name, type, level, description } = req.body;
    const updates = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "Skill name is required" });
      }
      updates.name = name.trim();
    }

    if (type !== undefined) {
      if (!validTypes.includes(type)) {
        return res.status(400).json({ message: "Type must be teach or learn" });
      }
      updates.type = type;
    }

    if (level !== undefined) {
      if (!validLevels.includes(level)) {
        return res.status(400).json({
          message: "Level must be Beginner, Intermediate, or Advanced",
        });
      }
      updates.level = level;
    }

    if (description !== undefined) {
      if (typeof description !== "string") {
        return res.status(400).json({ message: "Description must be text" });
      }
      updates.description = description.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Provide at least one skill field" });
    }

    const skill = await Skill.findOneAndUpdate(
      { _id: req.params.id, userId: String(req.userId) },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!skill) {
      return res.status(404).json({ message: "Skill not found for this user" });
    }

    return res.json({ message: "Skill updated successfully", skill });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteSkill = async (req, res) => {
  try {
    const skill = await Skill.findOneAndDelete({
      _id: req.params.id,
      userId: String(req.userId),
    });

    if (!skill) {
      return res.status(404).json({
        message: "Skill not found for this user",
      });
    }

    return res.json({ message: "Skill deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getMatches = async (req, res) => {
  try {
    if (String(req.params.userId) !== String(req.userId)) {
      return res.status(403).json({ message: "You can only view your own matches" });
    }

    const wantedSkills = await Skill.find({
      userId: String(req.userId),
      type: "learn",
    });
    const names = wantedSkills.map((skill) => skill.name);

    if (names.length === 0) {
      return res.json({
        message: "Add skills you want to learn first",
        matches: [],
      });
    }

    const matches = await Skill.find({
      userId: { $ne: String(req.userId) },
      type: "teach",
      name: {
        $in: names.map((name) => new RegExp(`^${escapeRegex(name)}$`, "i")),
      },
    }).sort({ createdAt: -1 });

    return res.json({ count: matches.length, matches });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  addSkill: exports.addSkill,
  getSkills: exports.getSkills,
  updateSkill: exports.updateSkill,
  deleteSkill: exports.deleteSkill,
  getMatches: exports.getMatches,
};
