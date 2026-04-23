let db;
const request = indexedDB.open("LocalsengerDB", 1);

request.onupgradeneeded = (event) => {
    db = event.target.result;
    if (!db.objectStoreNames.contains("messages")) db.createObjectStore("messages", { keyPath: "id", autoIncrement: true });
    if (!db.objectStoreNames.contains("userProfile")) db.createObjectStore("userProfile", { keyPath: "setting" });
};

request.onsuccess = (event) => {
    db = event.target.result;
    checkUserProfile();
    loadMessages();
};

function checkUserProfile() {
    const transaction = db.transaction(["userProfile"], "readonly");
    const store = transaction.objectStore("userProfile");
    store.get("username").onsuccess = (e) => {
        if (e.target.result) document.getElementById('userName').textContent = e.target.result.value;
        else document.getElementById('loginModal').style.display = 'flex';
    };
    store.get("avatar").onsuccess = (e) => {
        if (e.target.result) document.getElementById('userAvatar').src = e.target.result.value;
    };
}

document.getElementById('savePseudoBtn').addEventListener('click', () => {
    const pseudo = document.getElementById('pseudoInput').value;
    if (pseudo.trim() !== "") {
        saveSetting("username", pseudo);
        document.getElementById('userName').textContent = pseudo;
        document.getElementById('loginModal').style.display = 'none';
    }
});

document.getElementById('userAvatar').addEventListener('click', () => document.getElementById('avatarInput').click());
document.getElementById('avatarInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
        const base64data = reader.result;
        document.getElementById('userAvatar').src = base64data;
        saveSetting("avatar", base64data);
    };
    if (file) reader.readAsDataURL(file);
});

function saveSetting(key, val) {
    const transaction = db.transaction(["userProfile"], "readwrite");
    transaction.objectStore("userProfile").put({ setting: key, value: val });
}

// MESSAGES
const sendBtn = document.getElementById('sendBtn');
const messageInput = document.getElementById('messageInput');
const chatBox = document.getElementById('chatBox');

function appendMessageToUI(text, type, time) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', type);
    msgDiv.innerHTML = `${text} <span class="message-time">${time}</span>`;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function sendMessage() {
    const text = messageInput.value;
    if (text.trim() === "") return;
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const newMessage = { text: text, type: 'sent', time: time };
    
    const transaction = db.transaction(["messages"], "readwrite");
    transaction.objectStore("messages").add(newMessage);
    transaction.oncomplete = () => {
        appendMessageToUI(text, 'sent', time);
        messageInput.value = "";
    };
}

function loadMessages() {
    chatBox.innerHTML = "";
    const transaction = db.transaction(["messages"], "readonly");
    transaction.objectStore("messages").getAll().onsuccess = (e) => {
        e.target.result.forEach(msg => appendMessageToUI(msg.text, msg.type, msg.time));
    };
}

// NOUVEAUTÉ : VIDER L'HISTORIQUE
document.getElementById('clearBtn').addEventListener('click', () => {
    if(confirm("Voulez-vous vraiment supprimer tous les messages ?")) {
        const transaction = db.transaction(["messages"], "readwrite");
        transaction.objectStore("messages").clear();
        transaction.oncomplete = () => {
            chatBox.innerHTML = "";
        };
    }
});

// EXPORT ARCHIVE (Adapté pour v1.7)
document.getElementById('exportBtn').addEventListener('click', () => {
    const transaction = db.transaction(["messages"], "readonly");
    transaction.objectStore("messages").getAll().onsuccess = (e) => {
        const messages = e.target.result;
        let html = `<html><body style="background:#efeae2;font-family:sans-serif;padding:20px;">
                    <h2 style="color:#00a884;text-align:center;">Localsenger - Archive de ${document.getElementById('userName').textContent}</h2>
                    <div style="max-width:600px;margin:auto;display:flex;flex-direction:column;">`;
        messages.forEach(m => {
            const side = m.type === 'sent' ? 'align-self:flex-end;background:#d9fdd3;' : 'align-self:flex-start;background:#fff;';
            html += `<div style="${side}padding:10px;border-radius:8px;margin-bottom:10px;max-width:80%;box-shadow:0 1px 1px rgba(0,0,0,0.1); position:relative;">
                     ${m.text} <span style="font-size:10px;color:#667;margin-left:10px;">${m.time}</span></div>`;
        });
        html += `</div></body></html>`;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
        a.download = "Archive_Localsenger.html";
        a.click();
    };
});

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
