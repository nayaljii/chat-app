const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        index: true
    },
    message: {
        type: String,
        required: true
    },
    reply: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Chat", chatSchema);