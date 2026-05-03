const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    name: String,
    message: String,
    time: { type: Date, default: Date.now },
    replyTo: {
        id: String,
        sender: String,
        message: String
    },
    reactions: {
        type: Map,
        of: [String],
        default: {}
    }
});

module.exports = mongoose.model("Message", messageSchema);