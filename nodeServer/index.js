// Node server with Socket.io and SPA support
require('dotenv').config();
const path = require('path');
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const mongoose = require('mongoose');

console.log("mongodb uri:", process.env.MONGODB_URI);
// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log("Connected to MongoDB"))
.catch((err) => console.log("MongoDB connection error:", err));

// Middleware
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, "../frontend")));

// API routes
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

// Messages API
const Message = require("./models/Message");

app.get('/messages', async (req, res) => {
    const messages = await Message.find().sort({ time: 1 });
    res.json(messages);
});

// SPA catch-all (for frontend routing)
app.get(/^\/.*$/, (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "index.html"));
});

// Socket.io logic
const users = {};
const onlineUser = {};

io.on('connection', socket => {
    socket.on('new-user-joined', name => {
        users[socket.id] = name;
        onlineUser[socket.id] = { name, id: socket.id };
        socket.broadcast.emit('user-joined', name);
        io.emit('update-users', Object.values(onlineUser));
    });

    socket.on('send', async (message) => {
        const newMsg = new Message({
            name: users[socket.id],
            message: message
        });
        await newMsg.save();

        const msgData = {
            message: message,
            name: users[socket.id],
            id: newMsg._id
        };

        socket.emit('receive', msgData);
        socket.broadcast.emit('receive', msgData);
    });

    socket.on('disconnect', () => {
        socket.broadcast.emit('left', users[socket.id]);
        delete users[socket.id];
        delete onlineUser[socket.id];
        io.emit('update-users', Object.values(onlineUser));
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
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

// Server port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));