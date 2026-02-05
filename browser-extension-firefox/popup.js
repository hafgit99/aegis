// Firefox Manifest V2 Compatible
// Use browser API for Firefox compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

let currentDomain = "";
let debugMode = false;

document.addEventListener('DOMContentLoaded', async () => {
    // Debug toggle removed for security
    renderLoading();

    setTimeout(async () => {
        const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url) {
            try {
                const url = new URL(tab.url);
                if (url.protocol.startsWith('http')) {
                    currentDomain = url.hostname.replace(/^www\./, '');
                    search(currentDomain);
                } else {
                    search("");
                }
            } catch (e) {
                search("");
            }
        } else {
            search("");
        }
    }, 100);
});

const searchInput = document.getElementById('searchInput');
searchInput.addEventListener('input', (e) => search(e.target.value));

document.getElementById('refreshBtn').addEventListener('click', () => search(searchInput.value || currentDomain));
document.getElementById('openAppBtn').addEventListener('click', () => sendNative('OPEN_POPUP'));

// QR Scan functionality
const qrScanBtn = document.getElementById('qrScanBtn');
const qrModal = document.getElementById('qrModal');
const qrModalClose = document.getElementById('qrModalClose');
const qrUploadArea = document.getElementById('qrUploadArea');
const qrFileInput = document.getElementById('qrFileInput');
const qrResult = document.getElementById('qrResult');

qrScanBtn?.addEventListener('click', () => {
    qrModal.style.display = 'flex';
    resetQrResult();
});

qrModalClose?.addEventListener('click', () => {
    qrModal.style.display = 'none';
});

qrUploadArea?.addEventListener('click', () => {
    qrFileInput.click();
});

qrFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    showQrResult('Scanning QR code...', 'info');

    try {
        const qrData = await scanQrFromFile(file);
        if (qrData) {
            // Send QR data to desktop app
            sendNative('SCAN_QR_RESULT', { qrData });
            showQrResult('QR code sent to desktop app!', 'success');
            setTimeout(() => {
                qrModal.style.display = 'none';
            }, 1500);
        } else {
            showQrResult('No QR code found in image', 'error');
        }
    } catch (error) {
        showQrResult('Failed to scan QR code', 'error');
    }

    // Reset file input
    qrFileInput.value = '';
});

function resetQrResult() {
    if (qrResult) {
        qrResult.style.display = 'none';
        qrResult.className = 'qr-result';
        qrResult.textContent = '';
    }
}

function showQrResult(message, type) {
    if (qrResult) {
        qrResult.style.display = 'block';
        qrResult.className = `qr-result ${type}`;
        qrResult.textContent = message;
    }
}

async function scanQrFromFile(file) {
    return new Promise((resolve) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.onload = () => {
                // Create canvas to read image data
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    resolve(null);
                    return;
                }

                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                // Try to find QR code using jsQR library if available
                if (typeof jsQR !== 'undefined') {
                    const code = jsQR(imageData.data, imageData.width, imageData.height);
                    resolve(code ? code.data : null);
                } else {
                    // If jsQR is not available, send image data to desktop app for processing
                    const dataUrl = canvas.toDataURL('image/png');
                    sendNative('PROCESS_QR_IMAGE', { imageData: dataUrl });
                    resolve(null); // Desktop app will handle it
                }
            };

            img.onerror = () => {
                resolve(null);
            };

            img.src = e.target.result;
        };

        reader.onerror = () => {
            resolve(null);
        };

        reader.readAsDataURL(file);
    });
}

function log(msg) {
    // Debug logging disabled for security
    console.log(msg);
}

function sendNative(type, payload = {}) {
    log(`Sending ${type}...`);
    browserAPI.runtime.sendMessage({
        type: 'SEND_NATIVE',
        payload: { id: Date.now(), type, ...payload }
    }, (response) => {
        if (browserAPI.runtime.lastError) {
            log("Runtime Error: " + browserAPI.runtime.lastError.message);
            renderError("Connection Failed: " + browserAPI.runtime.lastError.message);
        } else if (response && response.error) {
            log("Response Error: " + response.error);
            renderError(response.error);
        } else {
            log("Sent OK");
        }
    });

    // Timeout Check after 4 seconds
    setTimeout(() => {
        const container = document.getElementById('listContainer');
        // Only trigger timeout if we are still showing the loading spinner/text
        if (container.querySelector('.empty-text') && container.querySelector('.empty-text').textContent.includes('Connecting')) {
            renderError("Timeout: No response from Aegis.");
        }
    }, 4000);
}

function search(query) {
    sendNative('SEARCH', { query: query || "" });
}

browserAPI.runtime.onMessage.addListener((msg) => {
    log("Received Msg: " + JSON.stringify(msg));

    if (msg.type === 'NATIVE_RESPONSE') {
        const payload = msg.data;
        log("Payload: " + JSON.stringify(payload));

        // 1. Check for nested error object (Common in Aegis responses)
        // Even if success: true, there might be data: { error: "..." }
        if (payload.data && payload.data.error) {
            if (payload.data.error === "VAULT_LOCKED") {
                renderError("Vault is locked. Please unlock the desktop app.");
            } else {
                renderError(payload.data.error);
            }
            return;
        }

        // 2. Check for explicit failure
        if (payload.success === false) {
            renderError(payload.error || "Unknown Error");
            return;
        }

        // 3. Handle Valid Data
        if (Array.isArray(payload.data)) {
            renderResults(payload.data);
        } else if (payload.data && payload.data.password) {
            fillInPage(payload.data);
        } else {
            // 4. Handle Empty/Ping responses
            // If we got here, it's a success response but maybe just PING or OPEN_POPUP result
            if (payload.success && !payload.data) return;

            // If we really don't know what this is, show empty results to clear "Connecting..."
            renderResults([]);
        }
    }
});

function renderLoading() {
    const container = document.getElementById('listContainer');
    container.textContent = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'empty-state';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.classList.add('spin');
    svg.style.width = '24px';
    svg.style.height = '24px';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-8 8 3.59 8 8 8zm-1-13h2v6h-2zm0 8h2v2h-2z');
    svg.appendChild(path);

    const text = document.createElement('div');
    text.className = 'empty-text';
    text.textContent = 'Connecting to Aegis...';

    wrapper.appendChild(svg);
    wrapper.appendChild(text);
    container.appendChild(wrapper);
}

function renderError(msg) {
    const container = document.getElementById('listContainer');
    container.textContent = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'empty-state';

    const text = document.createElement('div');
    text.className = 'empty-text';
    text.style.color = '#ef4444';
    text.textContent = msg;

    const retryBtn = document.createElement('button');
    retryBtn.id = 'retryBtn';
    retryBtn.style.cssText = 'margin-top:10px; background:#334155; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;';
    retryBtn.textContent = 'Retry';
    retryBtn.onclick = () => search(currentDomain);

    wrapper.appendChild(text);
    wrapper.appendChild(retryBtn);
    container.appendChild(wrapper);
}

function renderResults(items) {
    const container = document.getElementById('listContainer');
    container.textContent = '';

    if (!items || items.length === 0) {
        const isSearching = searchInput.value.length > 0;
        const wrapper = document.createElement('div');
        wrapper.className = 'empty-state';

        const text = document.createElement('div');
        text.className = 'empty-text';
        text.textContent = isSearching ? 'No results found.' : 'No logins for this site.';

        const subText = document.createElement('div');
        subText.style.cssText = 'font-size:11px; color:#64748b; margin-top:5px;';
        subText.textContent = 'Search to find specific items.';

        wrapper.appendChild(text);
        wrapper.appendChild(subText);
        container.appendChild(wrapper);
        return;
    }

    const title = document.createElement('div');
    title.className = 'section-title';
    title.innerText = searchInput.value ? 'Search Results' : `Matches for ${currentDomain}`;
    container.appendChild(title);

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        const initial = (item.title || "?")[0].toUpperCase();

        const cardIcon = document.createElement('div');
        cardIcon.className = 'card-icon';
        cardIcon.textContent = initial;

        const cardInfo = document.createElement('div');
        cardInfo.className = 'card-info';

        const cardTitle = document.createElement('div');
        cardTitle.className = 'card-title';
        cardTitle.textContent = item.title;

        const cardSub = document.createElement('div');
        cardSub.className = 'card-sub';
        cardSub.textContent = item.username || 'No Username';

        cardInfo.appendChild(cardTitle);
        cardInfo.appendChild(cardSub);

        card.appendChild(cardIcon);
        card.appendChild(cardInfo);

        card.onclick = () => {
            card.style.borderColor = '#3b82f6';
            card.style.background = '#1e293b';
            sendNative('GET_CREDENTIALS', { entryId: item.id });
        };
        container.appendChild(card);
    });
}

function fillInPage(cred) {
    browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
            browserAPI.tabs.executeScript(tabs[0].id, {
                code: `
                    (function(user, pass) {
                        const passInputs = document.querySelectorAll('input[type="password"]');
                        if (passInputs.length > 0) {
                            const target = passInputs[0];
                            target.value = pass;
                            target.dispatchEvent(new Event('input', { bubbles: true }));
                            target.dispatchEvent(new Event('change', { bubbles: true }));
                            if (user) {
                                const form = target.form;
                                if (form) {
                                    const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])'));
                                    const idx = inputs.indexOf(target);
                                    for (let i = idx - 1; i >= 0; i--) {
                                        const inp = inputs[i];
                                        if (inp.type === 'text' || inp.type === 'email') {
                                            inp.value = user;
                                            inp.dispatchEvent(new Event('input', { bubbles: true }));
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    })("${(cred.username || '').replace(/"/g, '\\"')}", "${cred.password.replace(/"/g, '\\"')}");
                `
            }, () => {
                window.close();
            });
        }
    });
}
