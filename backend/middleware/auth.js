const { verifyToken } = require("../services/authService");

function authenticate(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ")
        ? header.slice("Bearer ".length)
        : null;
    const user = verifyToken(token);

    if (!user) {
        return res.status(401).json({
            error: "Authentication required"
        });
    }

    req.user = user;
    next();
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({
            error: "Admin role required"
        });
    }

    next();
}

module.exports = {
    authenticate,
    requireAdmin
};
