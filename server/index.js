require("dotenv/config");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const path = require("path");

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// --- Serve Static Frontend Files ---
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-for-development-only";

// --- Middleware: Verify Token ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return res.status(401).json({ error: "Access denied or token missing" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = user;
        next();
    });
};

// --- Auth Routes ---
app.post("/api/auth/register", async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ error: "Username already taken" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword
            }
        });

        res.json({ message: "Registration successful" });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

app.post("/api/auth/login", async (req, res) => {
    try {
        console.log("Login Attempt:", req.body);
        const { username, password } = req.body;

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) {
            return res.status(400).json({ error: "Invalid username or password" });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: "Invalid username or password" });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
            expiresIn: "7d"
        });

        res.json({ token, username: user.username });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// --- User Profile (Protected) ---
app.get("/api/auth/me", authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, username: true, createdAt: true }
        });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// --- Novel Routes ---
app.get("/api/novels", authenticateToken, async (req, res) => {
    try {
        const novels = await prisma.novel.findMany({
            where: { userId: req.user.id },
            include: { chapters: true }
        });
        res.json(novels);
    } catch (error) {
        res.status(500).json({ error: "Server error fetching novels" });
    }
});

app.post("/api/novels", authenticateToken, async (req, res) => {
    try {
        const { title, description, cover, author, tags, status } = req.body;
        const newNovel = await prisma.novel.create({
            data: {
                title,
                description,
                cover,
                author,
                tags,
                status,
                user: { connect: { id: req.user.id } }
            },
            include: { chapters: true }
        });
        res.json(newNovel);
    } catch (error) {
        res.status(500).json({ error: "Failed to create novel" });
    }
});

app.put("/api/novels/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Ensure user owns the novel
        const novel = await prisma.novel.findFirst({ where: { id, userId: req.user.id } });
        if (!novel) return res.status(404).json({ error: "Novel not found" });

        const updatedNovel = await prisma.novel.update({
            where: { id },
            data: updateData,
            include: { chapters: true }
        });
        res.json(updatedNovel);
    } catch (error) {
        res.status(500).json({ error: "Failed to update novel" });
    }
});

app.delete("/api/novels/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const novel = await prisma.novel.findFirst({ where: { id, userId: req.user.id } });
        if (!novel) return res.status(404).json({ error: "Novel not found" });

        await prisma.novel.delete({ where: { id } });
        res.json({ message: "Novel deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete novel" });
    }
});

// --- Chapter Routes ---
app.post("/api/chapters", authenticateToken, async (req, res) => {
    try {
        const { novelId, title, content, summary, wordCount, status, order } = req.body;

        // Verify novel ownership
        const novel = await prisma.novel.findFirst({ where: { id: novelId, userId: req.user.id } });
        if (!novel) return res.status(404).json({ error: "Novel not found or unauthorized" });

        const newChapter = await prisma.chapter.create({
            data: { title, content, summary, wordCount, status, order, novelId }
        });
        res.json(newChapter);
    } catch (error) {
        res.status(500).json({ error: "Failed to create chapter" });
    }
});

app.put("/api/chapters/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Verify ownership via related novel
        const chapter = await prisma.chapter.findUnique({
            where: { id },
            include: { novel: true }
        });

        if (!chapter || chapter.novel.userId !== req.user.id) {
            return res.status(404).json({ error: "Chapter not found or unauthorized" });
        }

        const updatedChapter = await prisma.chapter.update({
            where: { id },
            data: updateData
        });
        res.json(updatedChapter);
    } catch (error) {
        res.status(500).json({ error: "Failed to update chapter" });
    }
});

app.delete("/api/chapters/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const chapter = await prisma.chapter.findUnique({
            where: { id },
            include: { novel: true }
        });

        if (!chapter || chapter.novel.userId !== req.user.id) {
            return res.status(404).json({ error: "Chapter not found or unauthorized" });
        }

        await prisma.chapter.delete({ where: { id } });
        res.json({ message: "Chapter deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete chapter" });
    }
});

// --- Prompt Routes ---
app.get("/api/prompts", authenticateToken, async (req, res) => {
    try {
        const prompts = await prisma.prompt.findMany({
            where: {
                OR: [
                    { userId: req.user.id },
                    { isSystem: true }
                ]
            }
        });
        res.json(prompts);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch prompts" });
    }
});

app.post("/api/prompts", authenticateToken, async (req, res) => {
    try {
        const { name, content, category, tags } = req.body;
        const newPrompt = await prisma.prompt.create({
            data: {
                name,
                content,
                category,
                tags,
                userId: req.user.id
            }
        });
        res.json(newPrompt);
    } catch (error) {
        res.status(500).json({ error: "Failed to create prompt" });
    }
});

app.put("/api/prompts/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, content, category, tags } = req.body;

        const prompt = await prisma.prompt.findUnique({ where: { id } });
        if (!prompt || prompt.userId !== req.user.id) {
            return res.status(404).json({ error: "Prompt not found or unauthorized" });
        }

        const updatedPrompt = await prisma.prompt.update({
            where: { id },
            data: { name, content, category, tags }
        });
        res.json(updatedPrompt);
    } catch (error) {
        res.status(500).json({ error: "Failed to update prompt" });
    }
});

app.delete("/api/prompts/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const prompt = await prisma.prompt.findUnique({ where: { id } });
        if (!prompt || prompt.userId !== req.user.id) {
            return res.status(404).json({ error: "Prompt not found or unauthorized" });
        }

        await prisma.prompt.delete({ where: { id } });
        res.json({ message: "Prompt deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete prompt" });
    }
});

// --- Config Routes ---
app.get("/api/configs", authenticateToken, async (req, res) => {
    try {
        const configs = await prisma.config.findMany({
            where: { userId: req.user.id }
        });
        res.json(configs);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch configs" });
    }
});

app.post("/api/configs", authenticateToken, async (req, res) => {
    try {
        const { key, value } = req.body; // value should be stringified JSON
        const config = await prisma.config.upsert({
            where: {
                userId_key: {
                    userId: req.user.id,
                    key: key
                }
            },
            update: { value },
            create: {
                key,
                value,
                userId: req.user.id
            }
        });
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: "Failed to save config" });
    }
});

// --- Health Check ---
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});


// --- Catch-all route for SPA ---
app.get("*", (req, res) => {
    // If the request is for an API that doesn't exist, don't serve index.html
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "API route not found" });
    }
    res.sendFile(path.join(distPath, "index.html"));
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
