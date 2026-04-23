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
    const getRequest = store.get("username");
    getRequest.onsuccess = () => {
        if (getRequest.result) {
            document.getElementById('userName').textContent = getRequest.result.value;
        } else {
            document.getElementById('loginModal').style.display = 'flex';
        }
    };
}

document.getElementById('savePseudoBtn').addEventListener('click', () => {
    const pseudo = document.getElementById('pseudoInput').value;
    if (pseudo.trim() !== "") {
        const transaction = db.transaction(["userProfile"], "readwrite");
        const store = transaction.objectStore("userProfile");
        store.put({ setting: "username", value: pseudo });
        transaction.oncomplete = () => {
            document.getElementById('userName').textContent = pseudo;
            document.getElementById('loginModal').style.display = 'none';
        };
    }
});

const sendBtn = document.getElementById('sendBtn');
const messageInput = document.getElementById('messageInput');
const chatBox = document.getElementById('chatBox');

function getCurrentTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
}

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
    const time = getCurrentTime();
    const newMessage = { text: text, type: 'sent', time: time };
    const transaction = db.transaction(["messages"], "readwrite");
    const store = transaction.objectStore("messages");
    store.add(newMessage);
    transaction.oncomplete = () => {
        appendMessageToUI(text, 'sent', time);
        messageInput.value = "";
    };
}

function loadMessages() {
    const transaction = db.transaction(["messages"], "readonly");
    const store = transaction.objectStore("messages");
    const requestLoad = store.getAll();
    requestLoad.onsuccess = () => {
        requestLoad.result.forEach(msg => appendMessageToUI(msg.text, msg.type, msg.time));
    };
}

// ARCHIVEUR VISUEL (Génère un fichier HTML lisible)
document.getElementById('exportBtn').addEventListener('click', () => {
    const transaction = db.transaction(["messages"], "readonly");
    const store = transaction.objectStore("messages");
    const requestExport = store.getAll();

    requestExport.onsuccess = () => {
        const messages = requestExport.result;
        let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Archive Localsenger</title>
            <style>
                body { background: #efeae2; font-family: sans-serif; padding: 20px; }
                .container { max-width: 600px; margin: auto; display: flex; flex-direction: column; }
                .msg { padding: 10px; border-radius: 8px; margin-bottom: 10px; max-width: 80%; position: relative; box-shadow: 0 1px 1px rgba(0,0,0,0.1); }
                .sent { align-self: flex-end; background: #d9fdd3; }
                .received { align-self: flex-start; background: #fff; }
                .time { font-size: 10px; color: #667; margin-left: 10px; }
                h2 { text-align: center; color: #00a884; }
            </style>
        </head>
        <body>
            <h2>Archive de mes conversations</h2>
            <div class="container">
        `;

        messages.forEach(m => {
            htmlContent += `<div class="msg ${m.type}">${m.text} <span class="time">${m.time}</span></div>`;
        });

        htmlContent += `</div></body></html>`;

        const blob = new Blob([htmlContent], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Archive_Localsenger.html";
        a.click();
    };
});

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
