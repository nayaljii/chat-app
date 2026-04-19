const API_BASE_URL = "https://groupchat-app-fut2.onrender.com";
const chatForm = document.getElementById("bot-chatForm");
const messageInput = document.getElementById("bot-messageInput");
const chatBox = document.getElementById("bot-chatBox");

const username = localStorage.getItem("name") || localStorage.getItem("username");

function addMessage(text, sender) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("bot-message", sender);

    const bubble = document.createElement("div");
    bubble.classList.add("bot-bubble");
    bubble.textContent = text;

    messageDiv.appendChild(bubble);
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function addTypingMessage() {
    const typingDiv = document.createElement("div");
    typingDiv.classList.add("bot-message", "bot");
    typingDiv.id = "typingMessage";

    const bubble = document.createElement("div");
    bubble.classList.add("bot-bubble", "typing");
    bubble.textContent = "Typing...";

    typingDiv.appendChild(bubble);
    chatBox.appendChild(typingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function removeTypingMessage() {
    const typingMessage = document.getElementById("bot-typingMessage");
    if (typingMessage) {
        typingMessage.remove();
    }
}

function goBack() {
    window.location.href = "/"
}

async function loadHistory() {
    try {
        chatBox.innerHTML = "";

        if (!username) {
            addMessage("User not found. Please login again.", "bot");
            return;
        }

            const res = await fetch(`${API_BASE_URL}/ai/history/${encodeURIComponent(username)}`);
            const data = await res.json();


        if (!data.length) {
            addMessage("Hello! How can I help you today?", "bot");
            return;
        }

        data.forEach((chat) => {
            addMessage(chat.message, "user");
            addMessage(chat.reply, "bot");
        });
      } catch (error) {
          console.error("History load error:", error);
          addMessage("Hello! How can I help you today?", "bot");
      }
}

chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const message = messageInput.value.trim();
    if (!message) return;

    if (!username) {
        addMessage("User not found. Please login again.", "bot");
        return;
    }

    addMessage(message, "user");
    messageInput.value = "";
    addTypingMessage();

    try {
        const response = await fetch(`${API_BASE_URL}/ai/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ username, message }),
        });

        const data = await response.json();
        removeTypingMessage();

        if (data.reply) {
            addMessage(data.reply, "bot");
        } else {
            addMessage(data.error || "Something went wrong", "bot");
        }
      } catch (error) {
          removeTypingMessage();
          addMessage("Not connect to the Server.", "bot");
          console.error("Chat error:", error);
      }
});

loadHistory();