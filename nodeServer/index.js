// Node sesrver which will handle socket io connections

require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const{Server} = require("socket.io");
const io = new Server(server);
const mongoose = require('mongoose');

app.use(express.json());
app.use(express.static("../frontend"));

mongoose.connect(process.env.MONGODB_URI).then(() => console.log("Connected to MongoDB")).catch((err)=> console.log(err));

const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

const Message = require("./models/Message");

app.get('/messages', async (req, res) => {
    const messages = await Message.find().sort({time: 1});
    res.json(messages);
});


app.get('/', (req, res) => {
    res.sendFile(__dirname + '/../frontend/index.html');
});


const users = {};
const onlineUser = {};


io.on('connection', socket => {
    socket.on('new-user-joined', name => {
        users[socket.id] = name;
        onlineUser[socket.id] = {name, id: socket.id};
        socket.broadcast.emit('user-joined', name);
        io.emit('update-users', Object.values(onlineUser)); // Send updated online users list to all clients
    });
    
    // message 
    socket.on('send', async (message) => {
        
        const newMsg = new Message({
            name: users[socket.id],
            message: message
        });
        
        await newMsg.save(); // save in DB

        const msgData = {
            message: message,
            name: users[socket.id],
            id: newMsg._id
        };
        
        socket.emit('receive', msgData); // Emit to sender
        socket.broadcast.emit('receive', msgData);
    });
    
    socket.on('disconnect', () => {
        socket.broadcast.emit('left', users[socket.id]);
        delete users[socket.id];
        delete onlineUser[socket.id];
        io.emit('update-users', Object.values(onlineUser)); // Send updated online users list to all clients
    });

    socket.on('delete-message', async (id) => {
        if(!id){
            console.log("Id is undefined");
            return;
        }
        try {
            await Message.findByIdAndDelete(id);
            io.emit('message-deleted', id);
        } catch (err) {
            console.error("Error deleting message:", err);
        }});

    socket.on('typing', () => {
        socket.broadcast.emit('user-typing', users[socket.id]);
    });
    socket.on('stop-typing', () => {
        socket.broadcast.emit('user-stop-typing');
});
});


app.delete('/message/:id', async (req, res) => {
    try {
        await Message.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
