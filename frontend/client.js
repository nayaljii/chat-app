const name = localStorage.getItem("username");
if(!name) {
    window.location.href = "/home.html";
}

const token = localStorage.getItem("token");   
if(!token) {
    window.location.href = "/home.html";
}

const socket = io();
const form = document.getElementById('send-container');
const messageCountainer = document.querySelector('.container');
const messageInput = document.getElementById('messageInp');
    
let hasUserInteracted = false;

// Receive msg notification audio
var audio1 = new Audio('astute.mp3');
audio1.preload = "auto";
audio1.volume = 1;

// user joind notification audio
var audio2 = new Audio('another_1.mp3');
audio2.preload = "auto";
audio2.volume = 1;

// User Joined or send msg
document.addEventListener('click', () => {
    hasUserInteracted = true;
});

// Scroll if user already bottom
let userAtBottom = true;
messageCountainer.addEventListener('scroll', () => {
    const threshold = 50;
    if(messageCountainer.scrollTop + messageCountainer.clientHeight >= messageCountainer.scrollHeight - threshold){
        userAtBottom = true;
    }
    else{
        userAtBottom = false;
    }
});

// Online users
const onlineUsersDiv = document.getElementById('online-users');
socket.on('update-users', (users) => {
    toggleUsersBtn.innerText = `Online (${users.length})`;
    
    // Clear existing users
    onlineUsersDiv.innerHTML = '';
    
    users.forEach(user => {
        if(user.id === socket.id){
            onlineUsersDiv.innerHTML += `<b>${user.name}(You)</b><br>`;
        }
        else{
            onlineUsersDiv.innerHTML += `<b>${user.name}</b><br>`;
        }
    });
});

// Append msg
const append = (message, position, id) => {
    const messageElement = document.createElement('div');
    messageElement.innerText = message;
    messageElement.classList.add('message', position);
    if(id){
        messageElement.dataset.id = id;
    }

    // For delete button
    const btn = document.createElement('button');
    btn.classList.add('delete-btn');
    btn.innerText = '❌';
    btn.onclick = () => {
        socket.emit('delete-message', id);
    };
    if(position === 'right'){
        messageElement.appendChild(btn);
    }
    messageElement.setAttribute('data-id', id);
    messageCountainer.append(messageElement);
    
    // Auto scroll to bottom of container
    if(position=='right' || userAtBottom){
        messageCountainer.scrollTop = messageCountainer.scrollHeight;
    }
    
    messageCountainer.appendChild(typingIndicator);
};

form.addEventListener('submit', (e) =>{
    e.preventDefault();
    
    const message = messageInput.value.trim();  //remove extra spaces form start and end
    
    // msg empty check
    if(message === ""){
        return;
    }
    socket.emit('send', message);
    socket.emit('stop-typing');
    messageInput.value= '';
});

// Receive msg
socket.on('receive', data => {
    if(data.name === name){
        append(`You: ${data.message}`,'right', data.id);
    }
    else{
        append(`${data.name}: ${data.message}`,'left',data.id);
        // Play sound only for incoming messages and if user has interacted with the page
        if(hasUserInteracted){
            playSound(audio1);
        }
    }
})

// Typing Timeout
let typingTimeout;
messageInput.addEventListener('input', () => {
    socket.emit('typing', name);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('stop-typing');
    }, 2000);
});

// For User is typing... indicator
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
const toggleUsersBtn = document.getElementById('toggle-users');
let isVisible = false;
toggleUsersBtn.addEventListener('click', () => {
    isVisible = !isVisible;
    if(isVisible){
        onlineUsersDiv.style.display = 'block';
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
    append(`${username} joined the chat`,'left');

    // Play sound only for new user joining and if user has interacted with the page
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
    if(username !== name){
        append(`${username} left the chat`,'left')
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

// Logout
function logout(){
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    window.location.href = "/home.html";
}



async function loadMessages(){
    try{
        const res = await fetch("/messages");

        const messages = await res.json();
        messageCountainer.innerHTML = ""; //clear old

    messages.forEach(msg => {
        if(msg.name == name){
            append(`You: ${msg.message}`, 'right', msg._id);
        }
        else{
        append(`${msg.name}: ${msg.message}`, 'left', msg._id);
        }
    });
    }catch(err){
        console.error("Error loading messages:", err);
    }
}

window.addEventListener("DOMContentLoaded",loadMessages);
window.addEventListener("load", () => {
    socket.emit('stop-typing');
});

// page load pe call
loadMessages();