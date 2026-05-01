// Node server with Socket.io and SPA support
require('dotenv').config();
const path = require('path');
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const mongoose = require('mongoose');
const cors = require("cors");
const OpenAI = require("openai");

// Models
const Message = require("./models/Message");
const Chat = require("./models/Chat");
const User = require("./models/User");

// Routes
const authRoutes = require("./routes/auth");

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log("Connected to MongoDB"))
.catch((err) => console.log("MongoDB connection error:", err));

// Middleware
app.use(express.json());

app.use(cors({
    origin: [
        "http://localhost:3000",
        "https://vishsup-nayaljii.vercel.app"
    ],
    credentials: true
}));

app.use(express.static(path.join(__dirname, "../frontend")));

// Auth Routes
app.use("/api/auth", authRoutes);

// OpenRouter Client
const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        "HTTP-Referer": "https://vishsup-nayaljii.vercel.app",
        "X-Title": "Vish AI Chatbot",
    },
});

// Messages API
app.get('/messages', async (req, res) => {
    try {
        const messages = await Message.find().sort({ time: 1 });
        res.json(messages);
    } catch (err) {
        console.error("Error fetching messages:", err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Delete message API
app.delete('/message/:id', async (req, res) => {
    const messageId = req.params.id;
    if(!mongoose.Types.ObjectId.isValid(messageId)){
        return res.status(400).json({ error: 'Invalid message ID' });
    }
    try {
        await Message.findByIdAndDelete(messageId);
        res.json({ success: true });
    } catch (err) {
        console.error("Error deleting message:", err);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

// AI Chat APIs

// User-wise AI history
app.get("/ai/history/:username", async (req, res) => {
    const { username } = req.params;

    if (!username) {
        return res.status(400).json({ error: "Username is required" });
    }

    try {
        const chats = await Chat.find({ username }).sort({ createdAt: 1 });
        res.json(chats);
    } catch (error) {
        console.error("AI history fetch error:", error);
        res.status(500).json({ error: "Failed to fetch AI history" });
    }
});

// AI chat message save + reply
app.post("/ai/chat", async (req, res) => {
    const { username, message } = req.body;

    if (!username || !message) {
        return res.status(400).json({ error: "Username and message are required" });
    }

    try {
        const previousChats = await Chat.find({ username })
        .sort({ createdAt: -1 })
        .limit(6);

        const historyMessages = previousChats
        .reverse()
        .flatMap((chat) => [
            { role: "user", content: chat.message },
            { role: "assistant", content: chat.reply }
        ]);

        const completion = await client.chat.completions.create({
            model: "openrouter/free",
            messages: [
                {
                    role: "system",
                    content: "You are Vish'sUp AI assistant. Reply in a clean, friendly, modern chat style. Keep answers readable, well-spaced, and not too long unless asked. Use short paragraphs and simple formatting where useful."
                },
                ...historyMessages,
                { role: "user", content: message }
            ]
        });

        const aiReply = completion.choices?.[0]?.message?.content || "No response";

        const savedChat = await Chat.create({
            username,
            message,
            reply: aiReply
        });

        res.json({
            reply: aiReply,
            id: savedChat._id,
            createdAt: savedChat.createdAt
        });
        } catch (err) {
            console.error("AI chat route error:", err);
            res.status(500).json({
                error: err.message || "Something went wrong"
        });
    }
});

// User wise Delete message API
app.delete("/ai/history/:username", async (req, res) => {
    const { username } = req.params;

    try {
        await Chat.deleteMany({ username });
        res.json({ success: true, message: "AI history cleared" });
    } catch (error) {
        console.error("AI history delete error:", error);
        res.status(500).json({ error: "Failed to clear AI history" });
    }
});

// Socket.io
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://vishsup-nayaljii.vercel.app"
    ],
    methods: ["GET", "POST"]
  }
});

// Socket.io logic
const users = {};
const onlineUsers = {};
const disconnectTimers = {};

io.on('connection', socket => {
    socket.on('new-user-joined', name => {
        users[socket.id] = name;
        onlineUsers[name] = socket.id; // overwrite

        // reconnect Timer delete
        if(disconnectTimers[name]){
            clearTimeout(disconnectTimers[name]);
            delete disconnectTimers[name];
        }
        const usersList = Object.keys(onlineUsers).map(name => ({ name, id: onlineUsers[name] }));
        io.emit('update-users', usersList);
        socket.broadcast.emit('user-joined', name);
    });

    socket.on('send', async (message) => {
        try {
        const newMsg = new Message({
            name: users[socket.id],
            message: message
        });
        await newMsg.save();

        const msgData = {
            message: message,
            name: users[socket.id],
            id: newMsg._id,
            time: newMsg.time
        };

        socket.emit('receive', msgData);
        socket.broadcast.emit('receive', msgData);
        } catch (err) {
            console.error("Error saving message:", err);
        }
    });
    
    socket.on('delete-message', async (id) => {
        if (!id) return;
        try {
            await Message.findByIdAndDelete(id);
            io.emit('message-deleted', id);
        } catch (err) {
            console.error("Error deleting message:", err);
        }
    });
    
    socket.on('typing', () => {
        socket.broadcast.emit('user-typing', users[socket.id]);
    });
    socket.on('stop-typing', () => {
        socket.broadcast.emit('user-stop-typing');
    });
    
    socket.on('disconnect', async (reason) => {
        const name = users[socket.id];

        if(!name) return;

        delete onlineUsers[name];
        delete users[socket.id];

        try {
            await User.findOneAndUpdate(
                { username: name },
                { lastSeen: new Date() }
            );
        } catch (err) {
            console.error("Last seen update error:", err);
        }
        
        const usersList = Object.keys(onlineUsers).map(username => ({
            name: username,
            id: onlineUsers[username]
        }));

        io.emit('update-users', usersList);

        disconnectTimers[name] = setTimeout(() => {
            if (!onlineUsers[name]) {
                io.emit('left', name);
            }
        }, 3000);
    });
});

// SPA fallback
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Server port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));