let currentDomain = "";
let debugMode = false;

document.addEventListener('DOMContentLoaded', async () => {
    // Debug toggle removed for security
    renderLoading();

    setTimeout(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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
    qrModal.classList.remove('hidden');
    qrModal.style.display = 'flex'; // Some extensions still use flex specifically, but hidden class will override if present.
    // Actually better to just toggle class.
    resetQrResult();
});

qrModalClose?.addEventListener('click', () => {
    qrModal.classList.add('hidden');
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
                qrModal.classList.add('hidden');
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
        qrResult.classList.add('hidden');
        qrResult.className = 'qr-result hidden';
        qrResult.textContent = '';
    }
}

function showQrResult(message, type) {
    if (qrResult) {
        qrResult.classList.remove('hidden');
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
                try {
                    console.log('Image loaded:', img.width, 'x', img.height);

                    // Try to find QR code using jsQR library
                    if (typeof jsQR !== 'undefined') {
                        console.log('jsQR library found, scanning...');

                        // Try multiple strategies
                        const strategies = [
                            { scale: 1, invert: false, enhance: false, name: 'Original' },
                            { scale: 1, invert: false, enhance: true, name: 'Enhanced' },
                            { scale: 1, invert: true, enhance: false, name: 'Inverted' },
                            { scale: 1.5, invert: false, enhance: false, name: '1.5x Scale' },
                            { scale: 0.75, invert: false, enhance: false, name: '0.75x Scale' },
                        ];

                        for (const strategy of strategies) {
                            console.log(`Trying strategy: ${strategy.name}...`);
                            const result = tryDecodeQR(img, strategy.scale, strategy.invert, strategy.enhance);
                            if (result) {
                                console.log(`✅ QR code found with strategy: ${strategy.name}`, result);
                                resolve(result);
                                return;
                            }
                        }

                        console.log('❌ No QR code found with any strategy');
                        resolve(null);
                    } else {
                        console.error('jsQR library not loaded!');
                        // If jsQR is not available, send image data to desktop app for processing
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(img, 0, 0);
                            const dataUrl = canvas.toDataURL('image/png');
                            sendNative('PROCESS_QR_IMAGE', { imageData: dataUrl });
                        }
                        resolve(null);
                    }
                } catch (error) {
                    console.error('Error processing image:', error);
                    resolve(null);
                }
            };

            img.onerror = () => {
                console.error('Failed to load image');
                resolve(null);
            };

            img.src = e.target.result;
        };

        reader.onerror = () => {
            console.error('Failed to read file');
            resolve(null);
        };

        reader.readAsDataURL(file);
    });
}

function tryDecodeQR(img, scale, invert, enhance) {
    try {
        const canvas = document.createElement('canvas');
        const width = Math.floor(img.width * scale);
        const height = Math.floor(img.height * scale);
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) return null;

        // Draw scaled image
        ctx.drawImage(img, 0, 0, width, height);

        // Get image data
        let imageData = ctx.getImageData(0, 0, width, height);

        if (invert) {
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                data[i] = 255 - data[i];
                data[i + 1] = 255 - data[i + 1];
                data[i + 2] = 255 - data[i + 2];
            }
        }

        // Enhance contrast only if requested
        if (enhance) {
            imageData = enhanceContrast(imageData);
        }

        // Try to decode
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth",
        });

        return code ? code.data : null;
    } catch (error) {
        console.error('Error in tryDecodeQR:', error);
        return null;
    }
}

function enhanceContrast(imageData) {
    const data = imageData.data;
    const factor = 1.5; // Contrast factor

    for (let i = 0; i < data.length; i += 4) {
        // Convert to grayscale and enhance
        const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const enhanced = ((gray - 128) * factor) + 128;
        const clamped = Math.max(0, Math.min(255, enhanced));

        data[i] = clamped;     // R
        data[i + 1] = clamped; // G
        data[i + 2] = clamped; // B
    }

    return imageData;
}


function log(msg) {
    // Debug logging disabled for security
    console.log(msg);
}

function sendNative(type, payload = {}) {
    log(`Sending ${type}...`);
    chrome.runtime.sendMessage({
        type: 'SEND_NATIVE',
        payload: { id: Date.now(), type, ...payload }
    }, (response) => {
        if (chrome.runtime.lastError) {
            log("Runtime Error: " + chrome.runtime.lastError.message);
            renderError("Connection Failed: " + chrome.runtime.lastError.message);
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

chrome.runtime.onMessage.addListener((msg) => {
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
            log("Credentials received, triggering fillInPage");
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
    path.setAttribute('d', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z');
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
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: (user, pass) => {
                    console.log("[Aegis] Autofill started...");
                    const passInputs = Array.from(document.querySelectorAll('input[type="password"]'));

                    if (passInputs.length === 0) {
                        console.warn("[Aegis] No password fields found.");
                        return;
                    }

                    passInputs.forEach((passInput, index) => {
                        function simulateType(element, value) {
                            if (!element) return;
                            element.focus();
                            element.click();

                            // Set value directly
                            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                            if (nativeInputValueSetter) {
                                nativeInputValueSetter.call(element, value);
                            } else {
                                element.value = value;
                            }

                            const events = ['keydown', 'keypress', 'textInput', 'input', 'keyup', 'change', 'blur'];
                            events.forEach(eventType => {
                                const event = new Event(eventType, { bubbles: true, cancelable: true });
                                element.dispatchEvent(event);
                            });
                        }

                        // Fill Password
                        simulateType(passInput, pass);
                        console.log(`[Aegis] Password field ${index + 1} filled.`);

                        if (!user) return;

                        // Try to find the associated username field
                        let userInput = null;
                        const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])'));
                        const passIndex = allInputs.indexOf(passInput);

                        // Look strictly backwards from password field
                        for (let i = passIndex - 1; i >= 0; i--) {
                            const inp = allInputs[i];
                            // If it's a visible text/email/tel field, it's likely our username field
                            if (inp.offsetParent !== null && (inp.type === 'text' || inp.type === 'email' || inp.type === 'tel')) {
                                userInput = inp;
                                break;
                            }
                        }

                        if (userInput) {
                            simulateType(userInput, user);
                            console.log("[Aegis] Username candidate filled.");
                        }
                    });
                },
                args: [cred.username || "", cred.password]
            });
            window.close();
        }
    });
}
