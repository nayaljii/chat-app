const name = localStorage.getItem("username");
if(!name)
    {
        window.location.href = "/home.html";
    }
    const token = localStorage.getItem("token");
    
    if(!token){
        window.location.href = "/home.html";
    }
    const socket = io();
    
    const form = document.getElementById('send-container');
    const messageInput = document.getElementById('messageInp');
    const messageCountainer = document.querySelector('.container');
    
    var audio = new Audio('astute.mp3');
    var audio2 = new Audio('another_1.mp3');
    audio.preload = "auto";
    audio.volume = 1;
    audio2.preload = "auto";
    audio2.volume = 1;
    
    document.addEventListener('click', () => {
        hasUserInteracted = true;
    });
    
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

const typingDiv = document.getElementById('typing-indicator');

const append = (message, position, id) => {
    const messageElement = document.createElement('div');
    messageElement.innerText = message;
    messageElement.classList.add('message', position);
    if(id){
        messageElement.dataset.id = id;
    }
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
    if(position=='right'){
        messageCountainer.scrollTop = messageCountainer.scrollHeight;
    }
    else if(userAtBottom){
        messageCountainer.scrollTop = messageCountainer.scrollHeight;
    }
    
    if(position == 'left' && hasUserInteracted){
        audio.currentTime = 0;
        audio.play().catch(err => console.log("Audio blocked:", err));
    }
    messageCountainer.appendChild(typingIndicator);
};
form.addEventListener('submit', (e) =>{
    e.preventDefault();
    
    const message = messageInput.value.trim();
    
    // empty check
    if(message === ""){
        return;
    }
    socket.emit('send', message);
    socket.emit('stop-typing');
    messageInput.value= '';
});

let typingTimeout;
messageInput.addEventListener('input', () => {
    socket.emit('typing', name);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('stop-typing');
    }, 2000);
});

socket.on('user-stop-typing', () => {
    typingIndicator.innerText = '';
});

const typingIndicator = document.getElementById('typing-indicator');
socket.on('user-typing', (name) => {
    typingIndicator.innerText = `${name} is typing...`;
});

socket.on('user-typing', (typingName) => {
    if(typingName !== name){
        typingIndicator.innerText = `${typingName} is typing...`;
    }
});

socket.on('user-stop-typing', () => {
    typingIndicator.innerText = '';
});

const toggleUsersBtn = document.getElementById('toggle-users');
const onlineUsersList = document.getElementById('online-users');
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

socket.on('connect', () => {
    socket.emit('new-user-joined', name);
});
socket.on('user-joined', name => {
    append(`${name} joined the chat`,'left');
    audio.currentTime = 0;
    audio2.play().catch(err => console.log("Audio blocked:", err));
});
socket.on('receive', data => {
    if(data.name === name){
        append(`You: ${data.message}`,'right', data.id);
    }
    else{
        append(`${data.name}: ${data.message}`,'left',data.id);
    }
})
socket.on('left', name => {
    append(`${name} left the chat`,'left')
})
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

function deleteMessage(id){
    socket.emit('delete-message', id);
}

window.addEventListener("DOMContentLoaded",loadMessages);
window.addEventListener("load", () => {
    socket.emit('stop-typing');
});

// page load pe call
loadMessages();