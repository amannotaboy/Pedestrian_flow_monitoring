const express = require("express");
const {
    createToken,
    createUser,
    getUserByUsername,
    verifyPassword
} = require("../services/authService");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
const ADMIN_REGISTER_PASSWORD =
    process.env.ADMIN_REGISTER_PASSWORD || "flowai-admin";

function sanitizeUser(user) {
    return {
        id: user.id,
        username: user.username,
        role: user.role
    };
}

router.post("/register", async (req, res) => {
    try {
        const username = String(req.body.username || "").trim();
        const password = String(req.body.password || "");
        const requestedRole =
            req.body.role === "admin" ? "admin" : "user";
        const adminPassword =
            String(req.body.adminPassword || "");
        const role =
            requestedRole === "admin"
            && adminPassword === ADMIN_REGISTER_PASSWORD
                ? "admin"
                : "user";

        if (username.length < 3 || password.length < 6) {
            return res.status(400).json({
                error: "Username must be 3+ chars and password 6+ chars"
            });
        }

        const user = await createUser(username, password, role);
        const token = createToken(user);

        return res.json({
            token,
            user: sanitizeUser(user)
        });
    } catch (err) {
        if (err.code === "23505") {
            return res.status(409).json({
                error: "Username already exists"
            });
        }

        console.error(err);

        return res.status(500).json({
            error: "Register failed"
        });
    }
});

router.post("/login", async (req, res) => {
    try {
        const username = String(req.body.username || "").trim();
        const password = String(req.body.password || "");
        const user = await getUserByUsername(username);

        if (!user || !verifyPassword(password, user.password_hash)) {
            return res.status(401).json({
                error: "Invalid username or password"
            });
        }

        const safeUser = sanitizeUser(user);

        return res.json({
            token: createToken(safeUser),
            user: safeUser
        });
    } catch (err) {
        console.error(err);

        return res.status(500).json({
            error: "Login failed"
        });
    }
});

router.get("/me", authenticate, (req, res) => {
    return res.json({
        user: sanitizeUser(req.user)
    });
});

module.exports = router;
