const crypto = require("crypto");
const pool = require("../config/db");

const TOKEN_SECRET =
    process.env.AUTH_SECRET || "flowai-local-dev-secret";

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
    const hash = crypto
        .pbkdf2Sync(password, salt, 100000, 64, "sha512")
        .toString("hex");

    return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
    const [salt, hash] = storedHash.split(":");
    const candidate = hashPassword(password, salt).split(":")[1];

    return crypto.timingSafeEqual(
        Buffer.from(hash, "hex"),
        Buffer.from(candidate, "hex")
    );
}

function base64url(value) {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(value) {
    return crypto
        .createHmac("sha256", TOKEN_SECRET)
        .update(value)
        .digest("base64url");
}

function createToken(user) {
    const payload = base64url({
        id: user.id,
        username: user.username,
        role: user.role,
        exp: Date.now() + 24 * 60 * 60 * 1000
    });

    return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
    if (!token || !token.includes(".")) {
        return null;
    }

    const [payload, signature] = token.split(".");
    const expectedSignature = sign(payload);

    if (signature !== expectedSignature) {
        return null;
    }

    const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

    if (!user.exp || user.exp < Date.now()) {
        return null;
    }

    return user;
}

async function createUser(username, password, role) {
    const safeRole = role === "admin" ? "admin" : "user";

    const result = await pool.query(
        `
        INSERT INTO users
        (
            username,
            password_hash,
            role
        )
        VALUES
        (
            $1,
            $2,
            $3
        )
        RETURNING id, username, role
        `,
        [
            username,
            hashPassword(password),
            safeRole
        ]
    );

    return result.rows[0];
}

async function getUserByUsername(username) {
    const result = await pool.query(
        `
        SELECT id, username, password_hash, role
        FROM users
        WHERE username = $1
        `,
        [username]
    );

    return result.rows[0] || null;
}

module.exports = {
    createToken,
    verifyToken,
    createUser,
    getUserByUsername,
    verifyPassword
};
