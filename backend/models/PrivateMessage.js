const mongoose = require("mongoose");

const privateMessageSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
    },
    sender: {
        type: String,
        required: true,
    },
    receiver: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    time: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model("PrivateMessage", privateMessageSchema);