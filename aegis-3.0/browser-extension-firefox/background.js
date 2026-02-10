// Connect to the Native Messaging Host
const HOST_NAME = "com.aegis.vault";
let port = null;

function connect() {
    const hostName = "com.aegis.vault";
    // Append --native-messaging-host flag implicitly handled by Chrome launch but good for debug
    console.log("Connecting to native host:", hostName);
    port = chrome.runtime.connectNative(hostName);

    port.onMessage.addListener((msg) => {
        console.log("Received from native:", msg);
        // Broadcast to popup
        try { chrome.runtime.sendMessage({ type: 'NATIVE_RESPONSE', data: msg }); } catch (e) { }

        // Broadcast to active tab (Content Script)
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'NATIVE_RESPONSE', data: msg });
            }
        });
    });

    port.onDisconnect.addListener(() => {
        console.log("Disconnected", chrome.runtime.lastError);
        port = null;
    });
}

connect();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'CONNECT_HOST') {
        if (!port) connect();
        sendResponse({ status: 'connecting' });
    }
    else if (request.type === 'SEND_NATIVE') {
        if (port) {
            console.log("Sending to native:", request.payload);
            port.postMessage(request.payload);
            sendResponse({ status: 'sent' });
        } else {
            sendResponse({ status: 'disconnected', error: 'No connection to host' });
        }
    }
});
