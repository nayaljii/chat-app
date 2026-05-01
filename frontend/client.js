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

// Register users
const registeredUsersDiv = document.getElementById("registered-users");
const toggleRegisteredUsersBtn = document.getElementById("toggle-registered-users");
async function loadRegisteredUsers() {
    try {
        const res = await fetch(`${BASE_URL}/api/auth/users`);
        const users = await res.json();

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

// Online users
const onlineUsersDiv = document.getElementById('online-users');
const toggleUsersBtn = document.getElementById('toggle-users');
socket.on('update-users', (users) => {
    toggleUsersBtn.innerText = `Online(${users.length})`;
    
    // Clear existing users
    onlineUsersDiv.innerHTML = '';
    
    users.forEach(user => {
        const el = document.createElement('div');

        el.innerHTML = `<b>${user.name}${user.id === socket.id ? '(You)' : ''}</b>`;

        el.addEventListener("click", () => {
            if (user.name === name) return;

            openPrivateChat({
                username: user.name,
                lastSeen: null
            });
        });

        onlineUsersDiv.appendChild(el);
    });
    
    currentOnlineUsers = users.map(user => user.name);
    loadRegisteredUsers();
});

// Private Chat  
let chatMode = "group";
let selectedUser = null;

async function openPrivateChat(user) {
    chatMode = "private";
    selectedUser = user.username;

    document.getElementById("groupChatBtn").style.display = "block";

    const isOnline = currentOnlineUsers.includes(user.username);
    const statusText = isOnline ? "Online" : formatLastSeen(user.lastSeen);

    document.getElementById("chatTitle").innerText = user.username;
    document.getElementById("chatStatus").innerText = statusText;

    document.getElementById("mobileChatTitle").innerText = user.username;
    document.getElementById("mobileChatStatus").innerText = statusText;

    messageContainer.innerHTML = "";

    socket.emit("join-private-room", {
        sender: name,
        receiver: selectedUser
    });

    await loadPrivateMessages(name, selectedUser);
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
                    time: msg.time
                }, "right", msg._id);
            } else {
                append({
                    name: msg.sender,
                    message: msg.message,
                    time: msg.time
                }, "left", msg._id);
            }
        });

    } catch (err) {
        console.error("Private messages load error:", err);
    }
}

// Append msg
const append = (data, position, id) => {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', position);
    if(id){
        messageElement.dataset.id = id;
    }

    // For Name Div
    const nameDiv = document.createElement('div');
    nameDiv.classList.add('msg-name');
    nameDiv.innerText = data.name;

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
    messageContainer.append(messageElement);
    messageElement.appendChild(timeDiv);
    messageElement.setAttribute('data-id', id);

    // For delete button
    const btn = document.createElement('button');
    btn.classList.add('delete-btn');
    btn.innerText = '🗑️';
    btn.onclick = () => {
        socket.emit('delete-message', id);
    };
    if(position === 'right'){
        messageElement.appendChild(btn);
    }

    
    // Auto scroll to bottom of container
    if(position=='right' || userAtBottom){
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }
};

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
                message
            });
        } else {
            socket.emit("send", message);
        }

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
            time: new Date()
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
            time: new Date()
        }, 'left', data.id);

        // Play sound only for incoming messages and if user has interacted with the page
        if(hasUserInteracted){
            playSound(audio1);
        }
    }
})

// Receive Private Chat
socket.on("receive-private-message", (data) => {
    if (chatMode !== "private") return;
    if (data.sender !== selectedUser && data.sender !== name) return;

    if (data.sender === name) {
        append({
            name: "You",
            message: data.message,
            time: data.time
        }, "right", data.id);

        // Play sound only for msg send has interacted with the page
        if(hasUserInteracted){
            playSound(audio0);
        }
    } else {
        append({
            name: data.sender,
            message: data.message,
            time: data.time
        }, "left", data.id);

        // Play sound only for incoming messages and if user has interacted with the page
        if(hasUserInteracted){
            playSound(audio1);
        }
    }
});

// Go to Group Chat Back btn
document.getElementById("groupChatBtn").addEventListener("click", () => {
    chatMode = "group";
    selectedUser = null;

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
    socket.emit('typing', name);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('stop-typing');
    }, 2000);
});

// Typing indicator
const typingIndicator = document.getElementById('typing-indicator');
socket.on('user-typing', (typingname) => {
    if(typingname !== name){
        typingIndicator.innerText = `${typingname} is typing...`;
    }
});
// For stop typing... indicator
socket.on('user-stop-typing', () => {
    typingIndicator.innerText = '';
});

// Toggle online users list
let isVisible = false;
toggleUsersBtn.addEventListener('click', () => {
    isVisible = !isVisible;
    if(isVisible){
        onlineUsersDiv.style.display = 'flex';
        onlineUsersDiv.style.flexDirection = 'column';
    }
    else{
        onlineUsersDiv.style.display = 'none';
    }
});

// Notify server about new user joining
socket.on('connect', () => {
    socket.emit('new-user-joined', name);
});
socket.on('user-joined', username => {
    append({
        name: "",
        message: `${username} joined the chat`,
        time: new Date()
    }, 'center');

    // Play sound only for new user joining the page
    if(hasUserInteracted){
        playSound(audio2);
    }
});

// Function to play sound with user interaction check
function playSound(audio){
    const sound = audio.cloneNode(); // Clone the audio element to allow overlapping sounds
    sound.play().catch(err => console.log("Audio blocked:", err));
}

// Notify server about user leaving
socket.on('left', username => {
    if(username && username !== name){
        append({
            name: "",
            message: `${username} left the chat`,
            time: new Date()
        }, 'center');

        // Play sound only for user leave the page
        if(hasUserInteracted){
            playSound(audio3);
        }
    }
});

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
                time: msg.time
            }, 'right', msg._id);
        }
        else{
        append({
            name: msg.name,
            message: msg.message,
            time: msg.time
        }, 'left', msg._id);
        }
    });
    }catch(err){
        console.error("Error loading messages:", err);
    }
}

window.addEventListener("DOMContentLoaded", () => {
    loadMessages();
    loadRegisteredUsers();
});
window.addEventListener("load", () => {
    socket.emit('stop-typing');
});