const express = require("express");
const router = express.Router();

router.get("/healthCheck", (req, res) => {
  res.send({ response: "I am alive" }).status(200);
});

module.exports = router;
