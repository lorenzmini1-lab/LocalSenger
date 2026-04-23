let db;
const request = indexedDB.open("LocalsengerDB", 1);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("messages")) db.createObjectStore("messages", { keyPath: "id", autoIncrement: true });
    if (!db.objectStoreNames.contains("userProfile")) db.createObjectStore("userProfile", { keyPath: "setting" });
};

request.onsuccess = (e) => {
    db = e.target.result;
    checkUserProfile();
    loadMessages();
};

function checkUserProfile() {
    const store = db.transaction("userProfile", "readonly").objectStore("userProfile");
    store.get("username").onsuccess = (e) => {
        if (e.target.result) document.getElementById('userName').textContent = e.target.result.value;
        else document.getElementById('loginModal').style.display = 'flex';
    };
    store.get("avatar").onsuccess = (e) => {
        if (e.target.result) document.getElementById('userAvatar').src = e.target.result.value;
    };
}

document.getElementById('savePseudoBtn').addEventListener('click', () => {
    const val = document.getElementById('pseudoInput').value;
    if (val) {
        saveSetting("username", val);
        document.getElementById('userName').textContent = val;
        document.getElementById('loginModal').style.display = 'none';
    }
});

function saveSetting(key, val) {
    db.transaction("userProfile", "readwrite").objectStore("userProfile").put({ setting: key, value: val });
}

// Envoi de messages
const chatBox = document.getElementById('chatBox');
const messageInput = document.getElementById('messageInput');

function appendToUI(msg) {
    const div = document.createElement('div');
    div.className = `message ${msg.type}`;
    let content = msg.text ? `<p>${msg.text}</p>` : "";
    if (msg.image) content += `<img src="${msg.image}">`;
    div.innerHTML = `${content}<span class="message-time">${msg.time}</span>`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function saveAndSend(text, image = null) {
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const msg = { text, image, type: 'sent', time };
    db.transaction("messages", "readwrite").objectStore("messages").add(msg).onsuccess = () => appendToUI(msg);
}

document.getElementById('sendBtn').addEventListener('click', () => {
    if (messageInput.value.trim()) {
        saveAndSend(messageInput.value);
        messageInput.value = "";
    }
});

// Gestion des images
document.getElementById('attachBtn').addEventListener('click', () => document.getElementById('imageInput').click());
document.getElementById('imageInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => saveAndSend(null, reader.result);
    reader.readAsDataURL(file);
});

function loadMessages() {
    chatBox.innerHTML = "";
    db.transaction("messages", "readonly").objectStore("messages").getAll().onsuccess = (e) => {
        e.target.result.forEach(m => appendToUI(m));
    };
}

document.getElementById('clearBtn').addEventListener('click', () => {
    if(confirm("Tout effacer ?")) {
        db.transaction("messages", "readwrite").objectStore("messages").clear().onsuccess = () => chatBox.innerHTML = "";
    }
});

messageInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') document.getElementById('sendBtn').click(); });
