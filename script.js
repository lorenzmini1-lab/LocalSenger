let db;
const request = indexedDB.open("LocalsengerDB", 1);
let allMessages = []; // Cache pour la recherche rapide

request.onsuccess = (e) => {
    db = e.target.result;
    checkUserProfile();
    loadMessages();
    loadTheme();
};

// RECHERCHE EN TEMPS RÉEL
document.getElementById('searchInput').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allMessages.filter(m => m.text && m.text.toLowerCase().includes(term));
    renderMessages(filtered);
});

// GESTION DES EMOJIS
const emojiBtn = document.getElementById('emojiBtn');
const emojiPicker = document.getElementById('emojiPicker');
const messageInput = document.getElementById('messageInput');

emojiBtn.addEventListener('click', () => {
    emojiPicker.style.display = emojiPicker.style.display === 'grid' ? 'none' : 'grid';
});

emojiPicker.querySelectorAll('span').forEach(emoji => {
    emoji.addEventListener('click', () => {
        messageInput.value += emoji.textContent;
        emojiPicker.style.display = 'none';
        messageInput.focus();
    });
});

// LOGIQUE DE BASE
function saveAndSend(text, image = null) {
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const msg = { text, image, type: 'sent', time };
    db.transaction("messages", "readwrite").objectStore("messages").add(msg).onsuccess = () => {
        allMessages.push(msg);
        appendToUI(msg);
        document.getElementById('lastMsgPreview').textContent = text || "Image envoyée";
    };
}

function loadMessages() {
    db.transaction("messages", "readonly").objectStore("messages").getAll().onsuccess = (e) => {
        allMessages = e.target.result;
        renderMessages(allMessages);
    };
}

function renderMessages(list) {
    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML = "";
    list.forEach(m => appendToUI(m));
}

function appendToUI(msg) {
    const chatBox = document.getElementById('chatBox');
    const div = document.createElement('div');
    div.className = `message ${msg.type}`;
    let content = msg.text ? `<p>${msg.text}</p>` : "";
    if (msg.image) content += `<img src="${msg.image}">`;
    div.innerHTML = `${content}<span class="message-time">${msg.time}</span>`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Les fonctions de thème, profil et export restent identiques aux versions précédentes...
// [Insérer ici les fonctions checkUserProfile, setTheme, loadTheme de la v1.9]

document.getElementById('sendBtn').addEventListener('click', () => {
    if (messageInput.value.trim()) {
        saveAndSend(messageInput.value);
        messageInput.value = "";
    }
});

document.getElementById('attachBtn').addEventListener('click', () => document.getElementById('imageInput').click());
document.getElementById('imageInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => saveAndSend(null, reader.result);
        reader.readAsDataURL(file);
    }
});

function saveSetting(key, val) {
    db.transaction("userProfile", "readwrite").objectStore("userProfile").put({ setting: key, value: val });
}

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

function loadTheme() {
    db.transaction("userProfile", "readonly").objectStore("userProfile").get("theme").onsuccess = (e) => {
        if (e.target.result && e.target.result.value === "dark") {
            document.getElementById('appBody').classList.replace('light-theme', 'dark-theme');
            document.getElementById('themeBtn').textContent = "☀️";
        }
    };
}

document.getElementById('themeBtn').addEventListener('click', () => {
    const body = document.getElementById('appBody');
    const isDark = body.classList.contains('dark-theme');
    if (!isDark) {
        body.classList.replace('light-theme', 'dark-theme');
        document.getElementById('themeBtn').textContent = "☀️";
        saveSetting("theme", "dark");
    } else {
        body.classList.replace('dark-theme', 'light-theme');
        document.getElementById('themeBtn').textContent = "🌙";
        saveSetting("theme", "light");
    }
});

document.getElementById('savePseudoBtn').addEventListener('click', () => {
    const val = document.getElementById('pseudoInput').value;
    if (val) {
        saveSetting("username", val);
        document.getElementById('userName').textContent = val;
        document.getElementById('loginModal').style.display = 'none';
    }
});

document.getElementById('clearBtn').addEventListener('click', () => {
    if(confirm("Tout effacer ?")) {
        db.transaction("messages", "readwrite").objectStore("messages").clear().onsuccess = () => {
            allMessages = [];
            document.getElementById('chatBox').innerHTML = "";
        }
    }
});
