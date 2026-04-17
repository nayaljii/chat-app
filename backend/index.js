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

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log("Connected to MongoDB"))
.catch((err) => console.log("MongoDB connection error:", err));

// Middleware
app.use(express.json());

app.use(cors({
    origin: [
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "https://your-frontend-name.vercel.app"
    ],
    credentials: true
}));

// API routes
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

// Messages API
const Message = require("./models/Message");

app.get('/messages', async (req, res) => {
    try {
        const messages = await Message.find().sort({ time: 1 });
        res.json(messages);
    } catch (err) {
        console.error("Error fetching messages:", err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5500",
      "http://127.0.0.1:5500",
      "https://your-frontend-name.vercel.app"
    ],
    methods: ["GET", "POST"]
  }
});

// Socket.io logic
const users = {};
const onlineUser = {};
const disconnectTimers = {};

io.on('connection', socket => {
    socket.on('new-user-joined', name => {
        users[socket.id] = name;
        onlineUser[name] = socket.id; // overwrite

        // reconnect Timer delete
        if(disconnectTimers[name]){
            delete disconnectTimers[name];
        }
        const usersList = Object.keys(onlineUser).map(name => ({ name, id: onlineUser[name] }));
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
    
    socket.on('disconnect', (reason) => {
        const name = users[socket.id];
        disconnectTimers[name] = setTimeout( () => { 
        if(!onlineUser[name]) {
            socket.broadcast.emit('left', name);
        }},3000); // delay 3sec
        delete onlineUser[name];
        delete users[socket.id];
        const usersList = Object.keys(onlineUser).map(name => ({ name, id: onlineUser[name] }));
        io.emit('update-users', usersList);
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