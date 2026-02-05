// Firefox Manifest V2 Compatible Background Script
// Connect to the Native Messaging Host
const HOST_NAME = "com.aegis.vault";
let port = null;

// Use browser API for Firefox compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

function connect() {
    const hostName = "com.aegis.vault";
    console.log("Connecting to native host:", hostName);

    try {
        port = browserAPI.runtime.connectNative(hostName);

        port.onMessage.addListener((msg) => {
            console.log("Received from native:", msg);

            // Broadcast to popup
            try {
                browserAPI.runtime.sendMessage({ type: 'NATIVE_RESPONSE', data: msg }).catch(() => { });
            } catch (e) { }

            // Broadcast to active tab (Content Script)
            browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].id) {
                    browserAPI.tabs.sendMessage(tabs[0].id, { type: 'NATIVE_RESPONSE', data: msg }).catch(() => { });
                }
            });
        });

        port.onDisconnect.addListener(() => {
            console.log("Disconnected", browserAPI.runtime.lastError);
            port = null;
        });
    } catch (error) {
        console.error("Failed to connect to native host:", error);
        port = null;
    }
}

connect();

browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'CONNECT_HOST') {
        if (!port) connect();
        sendResponse({ status: port ? 'connected' : 'connecting' });
    }
    else if (request.type === 'SEND_NATIVE') {
        if (port) {
            console.log("Sending to native:", request.payload);
            try {
                port.postMessage(request.payload);
                sendResponse({ status: 'sent' });
            } catch (error) {
                console.error("Failed to send message:", error);
                sendResponse({ status: 'error', error: error.message });
            }
        } else {
            sendResponse({ status: 'disconnected', error: 'No connection to host' });
        }
    }
    return true; // Keep the message channel open for async response
});
