let db, currentChatId = "global", currentReplyTo = null, userPin = null, isLocked = false, allMessages = [];
let mediaRecorder, audioChunks = [];

const request = indexedDB.open("LocalsengerDB", 2);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("messages")) db.createObjectStore("messages", { keyPath: "id", autoIncrement: true });
    if (!db.objectStoreNames.contains("chats")) db.createObjectStore("chats", { keyPath: "id" });
    if (!db.objectStoreNames.contains("userProfile")) db.createObjectStore("userProfile", { keyPath: "setting" });
};

request.onsuccess = (e) => {
    db = e.target.result;
    initApp();
};

async function initApp() {
    await setupDefaultChat();
    checkUserProfile();
    loadTheme();
    loadCustomStyles();
    checkPinStatus();
    loadChatList();
}

// --- SETUP ---
async function setupDefaultChat() {
    const tx = db.transaction("chats", "readwrite");
    tx.objectStore("chats").put({ id: "global", name: "Journal Global", icon: "📓" });
}

function saveSetting(key, val) {
    db.transaction("userProfile", "readwrite").objectStore("userProfile").put({ setting: key, value: val });
}

// --- PROFIL & THEME ---
function checkUserProfile() {
    const store = db.transaction("userProfile", "readonly").objectStore("userProfile");
    store.get("username").onsuccess = (e) => {
        if (e.target.result) document.getElementById('userName').textContent = e.target.result.value;
        else document.getElementById('loginModal').style.display = 'flex';
    };
    store.get("avatar").onsuccess = (e) => { if (e.target.result) document.getElementById('userAvatar').src = e.target.result.value; };
}

function loadTheme() {
    db.transaction("userProfile", "readonly").objectStore("userProfile").get("theme").onsuccess = (e) => {
        if (e.target.result?.value === "dark") document.getElementById('appBody').classList.replace('light-theme', 'dark-theme');
    };
}

// --- ESPACES (CHATS) ---
function loadChatList() {
    const list = document.getElementById('contactsList');
    list.innerHTML = "";
    db.transaction("chats", "readonly").objectStore("chats").getAll().onsuccess = (e) => {
        e.target.result.forEach(chat => {
            const div = document.createElement('div');
            div.className = `contact-item ${chat.id === currentChatId ? 'active' : ''}`;
            div.innerHTML = `<div class="contact-avatar">${chat.icon}</div><div><h4>${chat.name}</h4></div>`;
            div.onclick = () => { currentChatId = chat.id; document.getElementById('currentChatName').textContent = chat.name; loadChatList(); };
            list.appendChild(div);
        });
        loadMessages();
    };
}

document.getElementById('addChatBtn').onclick = () => {
    const n = prompt("Nom de l'espace :");
    if (n) {
        const id = "chat_" + Date.now();
        db.transaction("chats", "readwrite").objectStore("chats").add({ id, name: n, icon: "📁" }).onsuccess = loadChatList;
    }
};

// --- MESSAGES ---
function loadMessages() {
    const box = document.getElementById('chatBox');
    box.innerHTML = "";
    db.transaction("messages", "readonly").objectStore("messages").getAll().onsuccess = (e) => {
        allMessages = e.target.result;
        allMessages.filter(m => m.chatId === currentChatId).forEach(appendToUI);
    };
}

function appendToUI(msg) {
    const box = document.getElementById('chatBox');
    const div = document.createElement('div');
    div.className = `message ${msg.type}`;
    div.ondblclick = () => { currentReplyTo = msg.text || "Média"; document.getElementById('replyText').textContent = currentReplyTo; document.getElementById('replyPreview').style.display = 'flex'; };
    div.oncontextmenu = (e) => { 
        e.preventDefault();
        const menu = document.getElementById('reactionMenu');
        menu.style.display = 'flex'; menu.style.top = e.pageY + 'px'; menu.style.left = e.pageX + 'px';
        menu.onclick = (ev) => { if(ev.target.dataset.emoji) addReaction(msg.id, ev.target.dataset.emoji); };
    };

    let html = msg.replyTo ? `<div class="quoted-box">${msg.replyTo}</div>` : "";
    if (msg.text) html += `<p>${msg.text}</p>`;
    if (msg.image) html += `<img src="${msg.image}">`;
    if (msg.audio) html += `<audio controls class="audio-msg" src="${msg.audio}"></audio>`;
    if (msg.reaction) html += `<div class="msg-reaction">${msg.reaction}</div>`;
    html += `<span style="font-size:10px; color:gray; float:right; margin-top:5px;">${msg.time}</span>`;
    
    div.innerHTML = html;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function saveAndSend(text, image = null, audio = null) {
    if (isLocked) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msg = { text, image, audio, time, type: 'sent', chatId: currentChatId, replyTo: currentReplyTo, reaction: null };
    db.transaction("messages", "readwrite").objectStore("messages").add(msg).onsuccess = () => {
        currentReplyTo = null; document.getElementById('replyPreview').style.display = 'none'; loadMessages();
    };
}

// --- ACTIONS ---
document.getElementById('sendBtn').onclick = () => {
    const inp = document.getElementById('messageInput');
    if (inp.value.trim()) { saveAndSend(inp.value); inp.value = ""; }
};

document.getElementById('attachBtn').onclick = () => document.getElementById('imageInput').click();
document.getElementById('imageInput').onchange = (e) => {
    const reader = new FileReader();
    reader.onload = () => saveAndSend(null, reader.result);
    reader.readAsDataURL(e.target.files[0]);
};

document.getElementById('voiceBtn').onclick = async () => {
    const btn = document.getElementById('voiceBtn');
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
            const reader = new FileReader();
            reader.onload = () => saveAndSend(null, null, reader.result);
            reader.readAsDataURL(new Blob(audioChunks));
            btn.classList.remove('recording');
        };
        mediaRecorder.start(); btn.classList.add('recording');
    } else { mediaRecorder.stop(); }
};

// --- PIN & LOCK ---
function checkPinStatus() {
    db.transaction("userProfile", "readonly").objectStore("userProfile").get("pin").onsuccess = (e) => {
        if (e.target.result) { userPin = e.target.result.value; lockApp(); }
    };
}

function lockApp() { isLocked = true; document.querySelector('.app-container').classList.add('locked-blur'); document.getElementById('pinModal').style.display = 'flex'; }

document.getElementById('unlockBtn').onclick = () => {
    if (document.getElementById('pinInput').value === userPin) {
        isLocked = false; document.querySelector('.app-container').classList.remove('locked-blur'); document.getElementById('pinModal').style.display = 'none';
    } else { document.getElementById('pinError').textContent = "Incorrect"; }
};

document.getElementById('lockBtn').onclick = () => {
    if (!userPin) {
        const p = prompt("Nouveau PIN (4 chiffres) :");
        if (p?.length === 4) { userPin = p; saveSetting("pin", p); lockApp(); }
    } else lockApp();
};

// --- FINITIONS (Emoji, Thème, Recherche) ---
document.getElementById('emojiBtn').onclick = () => { const p = document.getElementById('emojiPicker'); p.style.display = p.style.display === 'grid' ? 'none' : 'grid'; };
document.getElementById('emojiPicker').onclick = (e) => { if (e.target.tagName === 'SPAN') { document.getElementById('messageInput').value += e.target.textContent; } };
document.getElementById('themeBtn').onclick = () => {
    const b = document.getElementById('appBody');
    const isDark = b.classList.contains('dark-theme');
    b.classList.toggle('dark-theme'); b.classList.toggle('light-theme');
    saveSetting("theme", isDark ? "light" : "dark");
};

document.getElementById('searchInput').oninput = (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allMessages.filter(m => m.chatId === currentChatId && m.text?.toLowerCase().includes(term));
    document.getElementById('chatBox').innerHTML = ""; filtered.forEach(appendToUI);
};

function addReaction(id, emoji) {
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    store.get(id).onsuccess = (e) => { const m = e.target.result; m.reaction = emoji; store.put(m).onsuccess = loadMessages; };
}

// Nettoyage des menus au clic
window.onclick = (e) => {
    if (!e.target.closest('#emojiBtn') && !e.target.closest('#emojiPicker')) document.getElementById('emojiPicker').style.display = 'none';
    if (!e.target.closest('.message')) document.getElementById('reactionMenu').style.display = 'none';
};

// Login
document.getElementById('savePseudoBtn').onclick = () => {
    const p = document.getElementById('pseudoInput').value;
    if (p) { saveSetting("username", p); document.getElementById('userName').textContent = p; document.getElementById('loginModal').style.display = 'none'; }
};

// Export & Clear
document.getElementById('clearBtn').onclick = () => { if(confirm("Vider cet espace ?")) { /* Logique de filtre pour supprimer */ loadMessages(); } };

// Custom Styles Settings
document.getElementById('settingsBtn').onclick = () => document.getElementById('settingsModal').style.display = 'flex';
document.getElementById('closeSettingsBtn').onclick = () => document.getElementById('settingsModal').style.display = 'none';
document.getElementById('saveSettingsBtn').onclick = () => {
    const c = document.getElementById('accentColorPicker').value;
    const w = document.getElementById('wallpaperInput').value;
    saveSetting("accentColor", c); saveSetting("wallpaper", w);
    document.documentElement.style.setProperty('--wa-green', c);
    document.getElementById('chatWindow').style.backgroundImage = `url(${w})`;
    document.getElementById('settingsModal').style.display = 'none';
};
function loadCustomStyles() {
    const store = db.transaction("userProfile", "readonly").objectStore("userProfile");
    store.get("accentColor").onsuccess = (e) => { if(e.target.result) document.documentElement.style.setProperty('--wa-green', e.target.result.value); };
    store.get("wallpaper").onsuccess = (e) => { if(e.target.result) document.getElementById('chatWindow').style.backgroundImage = `url(${e.target.result.value})`; };
}
