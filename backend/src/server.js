import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import { initializeDatabase } from "./bootstrap.js";
import { config } from "./config.js";
import { pool } from "./db.js";

const app = express();

app.use(express.json({ limit: "2mb" }));

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role
    },
    config.jwtSecret,
    { expiresIn: "12h" }
  );
}

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTags(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((tag) => sanitizeText(tag)).filter(Boolean))];
}

function normalizePublicContact(payload = {}) {
  return {
    title: sanitizeText(payload.title),
    organization: sanitizeText(payload.organization),
    phone: sanitizeText(payload.phone),
    email: sanitizeText(payload.email),
    address: sanitizeText(payload.address),
    website: sanitizeText(payload.website),
    notes: sanitizeText(payload.notes),
    tags: normalizeTags(payload.tags)
  };
}

function normalizePrivatePayload(payload = {}) {
  return {
    ciphertext: sanitizeText(payload.ciphertext),
    iv: sanitizeText(payload.iv),
    salt: sanitizeText(payload.salt),
    cryptoVersion: Number(payload.crypto_version || 1)
  };
}

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const result = await pool.query(
      "SELECT id, username, email, role FROM users WHERE id = $1",
      [payload.sub]
    );

    if (!result.rows[0]) {
      return res.status(401).json({ error: "Unknown user" });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    version: config.version,
    app: config.appSlug
  });
});

app.post("/api/auth/login", async (req, res) => {
  const email = sanitizeText(req.body?.email).toLowerCase();
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const result = await pool.query(
    `
      SELECT id, username, email, role, password_hash
      FROM users
      WHERE email = $1 OR LOWER(username) = $1
      LIMIT 1
    `,
    [email]
  );

  const user = result.rows[0];

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  res.json({
    token: signToken(user),
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    }
  });
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/public-contacts", authMiddleware, async (req, res) => {
  const result = await pool.query(
    `
      SELECT id, title, organization, phone, email, address, website, notes, tags, created_at, updated_at
      FROM public_contacts
      WHERE owner_user_id = $1
      ORDER BY updated_at DESC, created_at DESC
    `,
    [req.user.id]
  );

  res.json(result.rows);
});

app.post("/api/public-contacts", authMiddleware, async (req, res) => {
  const contact = normalizePublicContact(req.body);
  const result = await pool.query(
    `
      INSERT INTO public_contacts
        (owner_user_id, title, organization, phone, email, address, website, notes, tags)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, title, organization, phone, email, address, website, notes, tags, created_at, updated_at
    `,
    [
      req.user.id,
      contact.title,
      contact.organization,
      contact.phone,
      contact.email,
      contact.address,
      contact.website,
      contact.notes,
      contact.tags
    ]
  );

  res.status(201).json(result.rows[0]);
});

app.get("/api/public-contacts/:id", authMiddleware, async (req, res) => {
  const result = await pool.query(
    `
      SELECT id, title, organization, phone, email, address, website, notes, tags, created_at, updated_at
      FROM public_contacts
      WHERE id = $1 AND owner_user_id = $2
    `,
    [req.params.id, req.user.id]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: "Public contact not found" });
  }

  res.json(result.rows[0]);
});

app.put("/api/public-contacts/:id", authMiddleware, async (req, res) => {
  const contact = normalizePublicContact(req.body);
  const result = await pool.query(
    `
      UPDATE public_contacts
      SET title = $3,
          organization = $4,
          phone = $5,
          email = $6,
          address = $7,
          website = $8,
          notes = $9,
          tags = $10,
          updated_at = NOW()
      WHERE id = $1 AND owner_user_id = $2
      RETURNING id, title, organization, phone, email, address, website, notes, tags, created_at, updated_at
    `,
    [
      req.params.id,
      req.user.id,
      contact.title,
      contact.organization,
      contact.phone,
      contact.email,
      contact.address,
      contact.website,
      contact.notes,
      contact.tags
    ]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: "Public contact not found" });
  }

  res.json(result.rows[0]);
});

app.delete("/api/public-contacts/:id", authMiddleware, async (req, res) => {
  const result = await pool.query(
    "DELETE FROM public_contacts WHERE id = $1 AND owner_user_id = $2 RETURNING id",
    [req.params.id, req.user.id]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: "Public contact not found" });
  }

  res.status(204).send();
});

app.get("/api/private-contacts", authMiddleware, async (req, res) => {
  const result = await pool.query(
    `
      SELECT id, ciphertext, iv, salt, crypto_version, created_at, updated_at
      FROM private_contacts
      WHERE owner_user_id = $1
      ORDER BY updated_at DESC, created_at DESC
    `,
    [req.user.id]
  );

  res.json(result.rows);
});

app.post("/api/private-contacts", authMiddleware, async (req, res) => {
  const payload = normalizePrivatePayload(req.body);
  if (!payload.ciphertext || !payload.iv || !payload.salt) {
    return res.status(400).json({ error: "ciphertext, iv and salt are required" });
  }

  const result = await pool.query(
    `
      INSERT INTO private_contacts (owner_user_id, ciphertext, iv, salt, crypto_version)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, ciphertext, iv, salt, crypto_version, created_at, updated_at
    `,
    [req.user.id, payload.ciphertext, payload.iv, payload.salt, payload.cryptoVersion]
  );

  res.status(201).json(result.rows[0]);
});

app.get("/api/private-contacts/:id", authMiddleware, async (req, res) => {
  const result = await pool.query(
    `
      SELECT id, ciphertext, iv, salt, crypto_version, created_at, updated_at
      FROM private_contacts
      WHERE id = $1 AND owner_user_id = $2
    `,
    [req.params.id, req.user.id]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: "Private contact not found" });
  }

  res.json(result.rows[0]);
});

app.put("/api/private-contacts/:id", authMiddleware, async (req, res) => {
  const payload = normalizePrivatePayload(req.body);
  if (!payload.ciphertext || !payload.iv || !payload.salt) {
    return res.status(400).json({ error: "ciphertext, iv and salt are required" });
  }

  const result = await pool.query(
    `
      UPDATE private_contacts
      SET ciphertext = $3,
          iv = $4,
          salt = $5,
          crypto_version = $6,
          updated_at = NOW()
      WHERE id = $1 AND owner_user_id = $2
      RETURNING id, ciphertext, iv, salt, crypto_version, created_at, updated_at
    `,
    [req.params.id, req.user.id, payload.ciphertext, payload.iv, payload.salt, payload.cryptoVersion]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: "Private contact not found" });
  }

  res.json(result.rows[0]);
});

app.delete("/api/private-contacts/:id", authMiddleware, async (req, res) => {
  const result = await pool.query(
    "DELETE FROM private_contacts WHERE id = $1 AND owner_user_id = $2 RETURNING id",
    [req.params.id, req.user.id]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: "Private contact not found" });
  }

  res.status(204).send();
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

async function start() {
  await initializeDatabase();
  app.listen(config.port, () => {
    console.log(`con backend listening on port ${config.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start backend:", error);
  process.exit(1);
});
