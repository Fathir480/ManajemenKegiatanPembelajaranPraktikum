const express = require('express');
const router = express.Router();
// Route placeholder - fitur absensi publik ditangani oleh asisten.routes
router.get('/', (req, res) => res.json({ message: 'Absensi endpoint' }));
module.exports = router;
