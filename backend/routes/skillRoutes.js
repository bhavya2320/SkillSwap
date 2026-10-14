const express = require("express");
const router = express.Router();
const { protect } = require("../src/middleware/authMiddleware");

const {
  addSkill,
  getSkills,
  updateSkill,
  deleteSkill,
  getMatches,
} = require("../controllers/skillController");

router.use(protect);
router.post("/", addSkill);
router.get("/", getSkills);
router.get("/matches/:userId", getMatches);
router.put("/:id", updateSkill);
router.delete("/:id", deleteSkill);

module.exports = router;