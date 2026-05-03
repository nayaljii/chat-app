const BASE_URL = "https://groupchat-app-fut2.onrender.com";
const name = localStorage.getItem("username");
if(!name) {
    window.location.href = "/home.html";
}

const token = localStorage.getItem("token");   
if(!token) {
    window.location.href = "/home.html";
}

const toggle = document.getElementById('menu-toggle');

if(toggle) {
    toggle.addEventListener('change', () => {
        document.body.classList.toggle("no-scroll", toggle.checked);
    });
}

const socket = io(BASE_URL);
const form = document.getElementById('send-container');
const messageContainer = document.querySelector('.container');
const messageInput = document.getElementById('messageInp');

let replyingTo = null;
let hasUserInteracted = false;

// Send msg notification audio
var audio0 = new Audio('Upload/sms.mp3');
audio0.preload = "auto";
audio0.volume = 1;

// Receive msg notification audio
var audio1 = new Audio('Upload/astute.mp3');
audio1.preload = "auto";
audio1.volume = 1;

// user joind notification audio
var audio2 = new Audio('Upload/another_1.mp3');
audio2.preload = "auto";
audio2.volume = 1;

// user leave notification audio
var audio3 = new Audio('Upload/faahh.mp3');
audio3.preload = "auto";
audio3.volume = 1;

// User Joined or send msg
document.addEventListener('click', () => {
    hasUserInteracted = true;
});

// Scroll if user already bottom
let userAtBottom = true;
messageContainer.addEventListener('scroll', () => {
    const threshold = 50;
    if(messageContainer.scrollTop + messageContainer.clientHeight >= messageContainer.scrollHeight - threshold){
        userAtBottom = true;
    }
    else{
        userAtBottom = false;
    }
});

// Message count
let allUsers = [];
let unreadCounts = {};

// Register users
const registeredUsersDiv = document.getElementById("registered-users");
const toggleRegisteredUsersBtn = document.getElementById("toggle-registered-users");
async function loadRegisteredUsers() {
    try {
        const res = await fetch(`${BASE_URL}/api/auth/users`);
        const users = await res.json();
        allUsers = users;

        registeredUsersDiv.innerHTML = "";

        users.forEach(user => {
            const userEl = document.createElement("div");
            userEl.classList.add("registered-user");

            const isOnline = currentOnlineUsers.includes(user.username);

            userEl.innerHTML = `
                <b>${user.username}</b>
                <small>${isOnline ? "Online" : formatLastSeen(user.lastSeen)}</small>
            `;

            // Private Chat Console
            userEl.addEventListener("click", () => {
                if (user.username === name) return;
                openPrivateChat(user);
            });

            registeredUsersDiv.appendChild(userEl);
        });

    } catch (error) {
        console.error("Error loading registered users:", error);
    }
}

let registeredVisible = false;

toggleRegisteredUsersBtn.addEventListener("click", () => {
    registeredVisible = !registeredVisible;

    if (registeredVisible) {
        registeredUsersDiv.style.display = "flex";
        registeredUsersDiv.style.flexDirection = "column";
        loadRegisteredUsers();
    } else {
        registeredUsersDiv.style.display = "none";
    }
});

// User LastSeen
let currentOnlineUsers = [];
function formatLastSeen(lastSeen) {
    if (!lastSeen) return "Not seen yet";

    const diff = Date.now() - new Date(lastSeen).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "Last seen just now";
    if (minutes < 60) return `Last seen ${minutes} min ago`;
    if (hours < 24) return `Last seen ${hours} hr ago`;

    return `Last seen ${days} day ago`;
}

function refreshSelectedUserStatus() {
    if (chatMode !== "private" || !selectedUser) return;

    const selectedUserData = allUsers.find(u => u.username === selectedUser);
    const isOnline = currentOnlineUsers.includes(selectedUser);

    const statusText = isOnline
        ? "Online"
        : formatLastSeen(selectedUserData?.lastSeen);

    document.getElementById("chatStatus").innerText = statusText;
    document.getElementById("mobileChatStatus").innerText = statusText;
}

async function getUserDetails(username) {
    try {
        const res = await fetch(`${BASE_URL}/api/auth/users`);
        const users = await res.json();

        return users.find(user => user.username === username);
    } catch (err) {
        console.error("User details fetch error:", err);
        return null;
    }
}

const chatUsersDiv = document.getElementById("chat-users");
const toggleChatsBtn = document.getElementById("toggle-chats");

// Update User
socket.on('update-users', (users) => {
    currentOnlineUsers = users.map(user => user.name);
    loadRegisteredUsers();
    refreshSelectedUserStatus();
});

let chatsVisible = false;

toggleChatsBtn.addEventListener("click", () => {
    chatsVisible = !chatsVisible;

    if (chatsVisible) {
        chatUsersDiv.style.display = "flex";
        chatUsersDiv.style.flexDirection = "column";
        loadChatUsers();
    } else {
        chatUsersDiv.style.display = "none";
    }
});

// Private Chat  
let chatMode = "group";
let selectedUser = null;

async function openPrivateChat(user) {
    chatMode = "private";
    selectedUser = user.username;

    const menuToggle = document.getElementById("menu-toggle");
    if (menuToggle) {
        menuToggle.checked = false;
        document.body.classList.remove("no-scroll");
    }
    
    document.getElementById("groupChatBtn").style.display = "block";
    
    const isOnline = currentOnlineUsers.includes(user.username);
    const statusText = isOnline ? "Online" : formatLastSeen(user.lastSeen);
    
    document.getElementById("chatTitle").innerText = user.username;
    document.getElementById("chatStatus").innerText = statusText;
    
    document.getElementById("mobileChatTitle").innerText = user.username;
    document.getElementById("mobileChatStatus").innerText = statusText;
    
    messageContainer.innerHTML = "";
    typingIndicator.innerText = "";

    socket.emit("join-private-room", {
        sender: name,
        receiver: selectedUser
    });

    unreadCounts[user.username] = 0;
    loadChatUsers();
    await loadPrivateMessages(name, selectedUser);
}

// Private Chat User Load
async function loadChatUsers() {
    try {
        const res = await fetch(`${BASE_URL}/private/chats/${name}`);
        const chatUsers = await res.json();

        chatUsersDiv.innerHTML = "";

        if (chatUsers.length === 0) {
            chatUsersDiv.innerHTML = `<small>No private chats yet</small>`;
            return;
        }

        chatUsers.forEach(chat => {
            const userEl = document.createElement("div");
            userEl.classList.add("chat-user");

            const unread = unreadCounts[chat.username] || 0;

            userEl.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <b>${chat.username}</b>
                    ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ""}
                </div>
                <small>${chat.lastMessage}</small>
            `;

            userEl.addEventListener("click", async () => {
                const fullUser = allUsers.find(u => u.username === chat.username);

                openPrivateChat({
                    username: chat.username,
                    lastSeen: fullUser?.lastSeen || null
                });
            });

            chatUsersDiv.appendChild(userEl);
        });

    } catch (err) {
        console.error("Error loading chat users:", err);
    }
}

// Private Chat Load
async function loadPrivateMessages(sender, receiver) {
    try {
        const res = await fetch(`${BASE_URL}/private/messages/${sender}/${receiver}`);
        const messages = await res.json();

        messageContainer.innerHTML = "";

        messages.forEach(msg => {
            if (msg.sender === name) {
                append({
                    name: "You",
                    message: msg.message,
                    time: msg.time,
                    replyTo: msg.replyTo,
                    reactions: msg.reactions
                }, "right", msg._id);
            } else {
                append({
                    name: msg.sender,
                    message: msg.message,
                    time: msg.time,
                    replyTo: msg.replyTo,
                    reactions: msg.reactions
                }, "left", msg._id);
            }
        });

    } catch (err) {
        console.error("Private messages load error:", err);
    }
}

// Append msg
const append = (data, position, id) => {

    let touchStartX = 0;
    let touchEndX = 0;
    
    // Button Div
    const wrapper = document.createElement("div");
    wrapper.classList.add("message-wrapper", position);

    const messageElement = document.createElement("div");
    messageElement.classList.add("message", position);
    messageElement.setAttribute("data-id", id);

    // Button Container
    const actions = document.createElement("div");
    actions.classList.add("msg-actions");

    // Button
    const replyBtn = document.createElement("button");
    replyBtn.innerText = "↩";
    replyBtn.classList.add("reply-btn");
    replyBtn.onclick = () => {
        replyingTo = {
            id,
            sender: data.name,
            message: data.message
        };

        document.getElementById("replyPreview").style.display = "flex";

        if (chatMode === "private") {
            document.getElementById("replyText").innerText = data.message;
        } else {
            document.getElementById("replyText").innerText = `Replying to ${data.name}: ${data.message}`;
        }
    };

    const reactBtn = document.createElement("button");
    reactBtn.innerText = "😊";
    reactBtn.classList.add("react-btn");
    reactBtn.onclick = () => {
        showReactionPicker(messageElement, id);
    };

    // For delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.innerText = "🗑️";
    deleteBtn.classList.add("delete-btn");

    deleteBtn.onclick = () => {
        if (chatMode === "private") {
            socket.emit("delete-private-message", id);
        } else {
            socket.emit("delete-message", id);
        }
    };

    if (position !== "system" && id) {
        actions.appendChild(replyBtn);
        actions.appendChild(reactBtn);

        if (position === "right") {
            actions.appendChild(deleteBtn);
        }
    }

    // Logic
    if (position === "right") {
        wrapper.appendChild(actions);
        wrapper.appendChild(messageElement);
    } else {
        wrapper.appendChild(messageElement);
        wrapper.appendChild(actions);
    }

    messageContainer.appendChild(wrapper);

    // For Name Div
    const nameDiv = document.createElement('div');
    nameDiv.classList.add('msg-name');
    nameDiv.innerText = data.name;

    // For Reply msg Div
    if (data.replyTo) {
        const replyBox = document.createElement("div");
        replyBox.classList.add("reply-box");
        if (chatMode === "private") {
            replyBox.innerHTML = `
                <span>${data.replyTo.message}</span>
            `;
        } else {
            replyBox.innerHTML = `
                <b>${data.replyTo.sender}</b>
                <span>${data.replyTo.message}</span>
            `;
        }

        replyBox.addEventListener("click", () => {
            const originalMsg = document.querySelector(`[data-id="${data.replyTo.id}"]`);

            if (originalMsg) {
                originalMsg.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });

                originalMsg.classList.add("highlight-msg");

                setTimeout(() => {
                    originalMsg.classList.remove("highlight-msg");
                }, 1500);
            }
        });

        messageElement.appendChild(replyBox);
    }

    // For message text div
    const textDiv = document.createElement('div');
    textDiv.classList.add('msg-text');
    textDiv.innerText = data.message;
    
    // For Time Div
    const timeDiv = document.createElement('div');
    timeDiv.classList.add('msg-time');
    timeDiv.innerText = formatTime(data.time);
    
    messageElement.appendChild(nameDiv);
    messageElement.appendChild(textDiv);
    messageElement.appendChild(timeDiv);
    messageElement.setAttribute('data-id', id);
    
    // Auto scroll to bottom of container
    if(position=='right' || userAtBottom){
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }

    messageElement.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].screenX;
    });

    messageElement.addEventListener("touchend", (e) => {
        touchEndX = e.changedTouches[0].screenX;

        const swipeDistance = touchEndX - touchStartX;

        if (Math.abs(swipeDistance) > 70) {
            replyingTo = {
                id,
                sender: data.name,
                message: data.message
            };

            document.getElementById("replyPreview").style.display = "flex";

            if (chatMode === "private") {
                document.getElementById("replyText").innerText = data.message;
            } else {
                document.getElementById("replyText").innerText = `Replying to ${data.name}: ${data.message}`;
            }

            messageInput.focus();

            messageElement.classList.add("swipe-reply-effect");
            setTimeout(() => {
                messageElement.classList.remove("swipe-reply-effect");
            }, 250);
        }
    });

    renderReactions(messageElement, data.reactions);
};

// For Cancel Reply
document.getElementById("cancelReply").addEventListener("click", () => {
    replyingTo = null;
    document.getElementById("replyPreview").style.display = "none";
});

const anim = document.getElementById("sendAnim");

form.addEventListener('submit', (e) =>{
    e.preventDefault();
    
    const message = messageInput.value.trim();  //remove extra spaces form start and end
    
    // msg empty check
    if(message === ""){
        return;
    }
    if (socket.connected) {
        if (chatMode === "private" && selectedUser) {
            socket.emit("private-message", {
                sender: name,
                receiver: selectedUser,
                message,
                replyTo: replyingTo
            });
        } else {
            socket.emit("send", {
                message,
                replyTo: replyingTo
            });
        }

        replyingTo = null;
        document.getElementById("replyPreview").style.display = "none";

        anim.play();
    }
    socket.emit('stop-typing');
    messageInput.value= '';
});

// Receive msg
socket.on('receive', data => {
    if (chatMode !== "group") return;

    if(data.name === name){
        append({
            name: 'You',
            message: data.message,
            time: data.time || new Date(),
            replyTo: data.replyTo,
            reactions: data.reactions
        }, 'right', data.id);

        // Play sound only for msg send has interacted with the page
        if(hasUserInteracted){
            playSound(audio0);
        }
    }
    else{
        append({
            name: data.name,
            message: data.message,
            time: data.time || new Date(),
            replyTo: data.replyTo,
            reactions: data.reactions
        }, 'left', data.id);

        // Play sound only for incoming messages and if user has interacted with the page
        if(hasUserInteracted){
            playSound(audio1);
        }
    }
})

// Receive Private Chat
socket.on("receive-private-message", (data) => {

    if (data.sender !== name) {
        if (chatMode !== "private" || data.sender !== selectedUser) {
            unreadCounts[data.sender] = (unreadCounts[data.sender] || 0) + 1;
        }
    }

    if (chatMode !== "private") return;
    if (data.sender !== selectedUser && data.sender !== name) return;

    if (data.sender === name) {
        append({
            name: "You",
            message: data.message,
            time: data.time,
            replyTo: data.replyTo,
            reactions: data.reactions
        }, "right", data.id);

        // Play sound only for msg send has interacted with the page
        if(hasUserInteracted){
            playSound(audio0);
        }
    } else {
        append({
            name: data.sender,
            message: data.message,
            time: data.time,
            replyTo: data.replyTo,
            reactions: data.reactions
        }, "left", data.id);

        // Play sound only for incoming messages and if user has interacted with the page
        if(hasUserInteracted){
            playSound(audio1);
        }
    }
    loadChatUsers();
});

// Reaction Update
socket.on("message-reaction-updated", ({ id, reactions }) => {
    const msg = document.querySelector(`[data-id="${id}"]`);
    if (msg) {
        renderReactions(msg, reactions);
    }
});

socket.on("react-message", async ({ id, emoji, username, chatMode }) => {
    try {
        const Model = chatMode === "private" ? PrivateMessage : Message;

        const msg = await Model.findById(id);
        if (!msg) return;

        if (!msg.reactions) msg.reactions = new Map();

        const users = msg.reactions.get(emoji) || [];

        if (users.includes(username)) {
            msg.reactions.set(emoji, users.filter(u => u !== username));
        } else {
            msg.reactions.set(emoji, [...users, username]);
        }

        await msg.save();

        io.emit("message-reaction-updated", {
            id,
            reactions: Object.fromEntries(msg.reactions)
        });

    } catch (err) {
        console.error("Reaction error:", err);
    }
});

// Private msg delete
socket.on("private-message-deleted", id => {
    const msg = document.querySelector(`[data-id="${id}"]`);
    if (msg) {
        msg.remove();
    }

    loadChatUsers();
});

// Go to Group Chat Back btn
document.getElementById("groupChatBtn").addEventListener("click", () => {
    chatMode = "group";
    selectedUser = null;

    const menuToggle = document.getElementById("menu-toggle");
    if (menuToggle) {
        menuToggle.checked = false;
        document.body.classList.remove("no-scroll");
    }

    typingIndicator.innerText = "";

    document.getElementById("groupChatBtn").style.display = "none";

    document.getElementById("chatTitle").innerText = "Vish'sUp";
    document.getElementById("chatStatus").innerText = "Group Chat";

    document.getElementById("mobileChatTitle").innerText = "Vish'sUp";
    document.getElementById("mobileChatStatus").innerText = "Group Chat";

    messageContainer.innerHTML = "";
    loadMessages();
});

// Typing Timeout
let typingTimeout;

messageInput.addEventListener('input', () => {
    if (chatMode === "private" && selectedUser) {
        socket.emit("private-typing", {
            sender: name,
            receiver: selectedUser
        });
    } else {
        socket.emit("typing", name);
    }

    clearTimeout(typingTimeout);

    typingTimeout = setTimeout(() => {
        if (chatMode === "private" && selectedUser) {
            socket.emit("private-stop-typing", {
                sender: name,
                receiver: selectedUser
            });
        } else {
            socket.emit("stop-typing");
        }
    }, 2000);
});

// Typing indicator
const typingIndicator = document.getElementById('typing-indicator');
socket.on('user-typing', (typingname) => {
    if (chatMode !== "group") return;

    if (typingname !== name) {
        typingIndicator.innerText = `${typingname} is typing...`;
    }
});

socket.on('user-stop-typing', () => {
    if (chatMode !== "group") return;
    typingIndicator.innerText = '';
});

socket.on("private-user-typing", ({ sender }) => {
    if (chatMode !== "private") return;
    if (sender !== selectedUser) return;

    typingIndicator.innerText = `${sender} is typing...`;
});

socket.on("private-user-stop-typing", ({ sender }) => {
    if (chatMode !== "private") return;
    if (sender !== selectedUser) return;

    typingIndicator.innerText = "";
});

// Notify server about new user joining
socket.on('connect', () => {
    socket.emit('new-user-joined', name);
});

socket.on('user-joined', username => {
    if (chatMode !== "group") return;

    append({
        name: "",
        message: `${username} joined the chat`,
        time: new Date()
    }, 'system');

    if (hasUserInteracted) {
        playSound(audio2);
    }
});

// Notify server about user leaving
socket.on('left', username => {
    if (chatMode !== "group") return;

    if (username && username !== name) {
        append({
            name: "",
            message: `${username} left the chat`,
            time: new Date()
        }, 'system');

        if (hasUserInteracted) {
            playSound(audio3);
        }
    }
});

// Function to play sound with user interaction check
function playSound(audio){
    const sound = audio.cloneNode(); // Clone the audio element to allow overlapping sounds
    sound.play().catch(err => console.log("Audio blocked:", err));
}

//  Delete msg function
function deleteMessage(id){
    socket.emit('delete-message', id);
}
socket.on('message-deleted', id => {
    const msg = document.querySelector(`[data-id="${id}"]`);
    if(msg){
        msg.remove();
    }
});

function openChatBot() {
    window.location.href = "/chatbot.html";
}

// Logout
function logout(){
    if(confirm("Are you sure you want to logout?")){
        if(socket){
            socket.disconnect();
        }
        // clear local storage
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        socket.removeAllListeners(); // Remove all socket listeners
        // Redirect to home page
        window.location.href = "/home.html";
    }
}

// Time formate function 
function formatTime(date) {
    const d = new Date(date);
    let hours = d.getHours();
    let minutes = d.getMinutes();

    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
}

async function loadMessages(){
    try{
        const res = await fetch(`${BASE_URL}/messages`);

        const messages = await res.json();
        messageContainer.innerHTML = ""; //clear old

    messages.forEach(msg => {
        if(msg.name == name){
            append({
                name: "You",
                message: msg.message,
                time: msg.time,
                replyTo: msg.replyTo,
                reactions: msg.reactions
            }, 'right', msg._id);
        }
        else{
            append({
                name: msg.name,
                message: msg.message,
                time: msg.time,
                replyTo: msg.replyTo,
                reactions: msg.reactions
            }, 'left', msg._id);
        }
    });
    }catch(err){
        console.error("Error loading messages:", err);
    }
}

// Reaction Function
function showReactionPicker(messageElement, id) {
    const oldPicker = document.querySelector(".reaction-picker");
    if (oldPicker) oldPicker.remove();

    const picker = document.createElement("div");
    picker.classList.add("reaction-picker");

    ["👍", "❤️", "😂", "😮", "😢"].forEach(emoji => {
        const btn = document.createElement("button");
        btn.innerText = emoji;

        btn.onclick = () => {
            socket.emit("react-message", {
                id,
                emoji,
                username: name,
                chatMode
            });

            picker.remove();
        };

        picker.appendChild(btn);
    });

    document.body.appendChild(picker);

    const rect = messageElement.getBoundingClientRect();
    picker.style.top = `${rect.top - 45}px`;

    let left = rect.left;
    if (chatMode === "private" || messageElement.classList.contains("right")) {
        left = rect.right - 190;
    }

    picker.style.left = `${Math.max(10, left)}px`;

    setTimeout(() => {
        document.addEventListener("click", closeReactionPicker);
    }, 0);
}

function renderReactions(messageElement, reactions = {}) {
    let reactionDiv = messageElement.querySelector(".reaction-display");

    if (!reactionDiv) {
        reactionDiv = document.createElement("div");
        reactionDiv.classList.add("reaction-display");
        messageElement.appendChild(reactionDiv);
    }

    reactionDiv.innerHTML = "";

    Object.entries(reactions).forEach(([emoji, users]) => {
        if (users.length > 0) {
            const span = document.createElement("span");
            span.innerText = `${emoji} ${users.length}`;
            reactionDiv.appendChild(span);
        }
    });
}

function closeReactionPicker(e) {
    const picker = document.querySelector(".reaction-picker");

    if (picker && !picker.contains(e.target) && !e.target.classList.contains("react-btn")) {
        picker.remove();
        document.removeEventListener("click", closeReactionPicker);
    }
}

window.addEventListener("DOMContentLoaded", () => {
    loadMessages();
    loadRegisteredUsers();
    loadChatUsers();
});
window.addEventListener("load", () => {
    socket.emit('stop-typing');
});