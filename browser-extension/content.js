const ICON_URL = chrome.runtime.getURL('icon.png');
let activeInput = null;
let aegisBtn = null;
let dropdown = null;

// Tarayıcıdaki şifre alanlarını bul ve işaretle
function scanInputs() {
    const inputs = document.querySelectorAll('input[type="password"]');
    inputs.forEach(input => {
        if (input.dataset.aegisTagged) return;
        input.dataset.aegisTagged = "true";

        input.addEventListener('focus', showIcon);
        input.addEventListener('blur', (e) => {
            // Dropdown veya butona tıklanıyorsa gizleme
            setTimeout(() => {
                if (document.activeElement !== input) hideIcon();
            }, 200);
        });
    });
}

function createAegisButton() {
    if (aegisBtn) return;
    aegisBtn = document.createElement('div');
    aegisBtn.id = 'aegis-autofill-btn';
    aegisBtn.style.cssText = `
    position: absolute;
    width: 24px;
    height: 24px;
    background-image: url('${ICON_URL}');
    background-size: contain;
    background-repeat: no-repeat;
    cursor: pointer;
    z-index: 2147483647;
    display: none;
    opacity: 0.8;
    transition: opacity 0.2s;
  `;
    aegisBtn.onmouseover = () => aegisBtn.style.opacity = '1';
    aegisBtn.onmouseout = () => aegisBtn.style.opacity = '0.8';
    aegisBtn.onmousedown = (e) => {
        e.preventDefault(); // Focus kaybını önle
        handleAegisClick();
    };
    document.body.appendChild(aegisBtn);
}

function createDropdown() {
    if (dropdown) return;
    dropdown = document.createElement('div');
    dropdown.id = 'aegis-autofill-dropdown';
    dropdown.style.cssText = `
    position: absolute;
    min-width: 200px;
    background: #1a1a1a;
    color: white;
    border: 1px solid #333;
    border-radius: 6px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    z-index: 2147483647;
    display: none;
    font-family: sans-serif;
    font-size: 13px;
    overflow: hidden;
  `;
    document.body.appendChild(dropdown);
}

function showIcon(e) {
    if (!aegisBtn) createAegisButton();
    if (!dropdown) createDropdown();

    activeInput = e.target;
    const rect = activeInput.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    aegisBtn.style.display = 'block';
    // Inputun sağ tarafının biraz içi
    aegisBtn.style.left = (rect.right + scrollX - 30) + 'px';
    aegisBtn.style.top = (rect.top + scrollY + (rect.height - 24) / 2) + 'px';
}

function hideIcon() {
    // Eğer dropdown açıksa gizleme
    if (dropdown && dropdown.style.display === 'block') return;
    if (aegisBtn) aegisBtn.style.display = 'none';
}

function handleAegisClick() {
    if (!activeInput) return;

    // Basit yükleniyor mesajı
    dropdown.textContent = '';
    const loadingDiv = document.createElement('div');
    loadingDiv.style.padding = '10px';
    loadingDiv.style.color = '#aaa';
    loadingDiv.textContent = 'Searching vault...';
    dropdown.appendChild(loadingDiv);
    showDropdownUI();

    const domain = window.location.hostname;

    chrome.runtime.sendMessage({
        type: 'SEND_NATIVE',
        payload: {
            id: Date.now(),
            type: 'SEARCH',
            query: domain
        }
    });
}

function showDropdownUI() {
    if (!aegisBtn || !dropdown) return;
    const rect = aegisBtn.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    dropdown.style.display = 'block';
    dropdown.style.left = (rect.left + scrollX) + 'px';
    dropdown.style.top = (rect.bottom + scrollY + 5) + 'px';
}

// Background'dan gelen mesajları dinle
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'NATIVE_RESPONSE') {
        const payload = msg.data;
        // Search sonucu
        if (Array.isArray(payload.data)) {
            renderSearchResults(payload.data);
        }
        // Credential sonucu
        else if (payload.data && payload.data.password) {
            fillPassword(payload.data);
        }
        else if (payload.error) {
            dropdown.textContent = '';
            const errorDiv = document.createElement('div');
            errorDiv.style.padding = '10px';
            errorDiv.style.color = '#ef4444';
            errorDiv.textContent = `Error: ${payload.error}`;
            dropdown.appendChild(errorDiv);
        }
    }
});

function renderSearchResults(results) {
    if (!dropdown) return;

    if (results.length === 0) {
        dropdown.textContent = '';
        const emptyDiv = document.createElement('div');
        emptyDiv.style.padding = '10px';
        emptyDiv.style.color = '#aaa';
        emptyDiv.textContent = 'No entries found for this domain.';
        dropdown.appendChild(emptyDiv);
        setTimeout(() => { dropdown.style.display = 'none'; }, 2000);
        return;
    }

    dropdown.textContent = '';
    results.forEach(entry => {
        const item = document.createElement('div');
        item.style.cssText = `
            padding: 10px;
            border-bottom: 1px solid #333;
            cursor: pointer;
            display: flex;
            flex-direction: column;
        `;
        item.onmouseover = () => item.style.background = '#333';
        item.onmouseout = () => item.style.background = 'transparent';

        const title = document.createElement('div');
        title.innerText = entry.title;
        title.style.fontWeight = 'bold';

        const user = document.createElement('div');
        user.innerText = entry.username || 'No Username';
        user.style.fontSize = '11px';
        user.style.color = '#aaa';

        item.appendChild(title);
        item.appendChild(user);

        item.onmousedown = (e) => { // prevent blur
            e.preventDefault();
            requestCredential(entry.id);
        };

        dropdown.appendChild(item);
    });
}

function requestCredential(entryId) {
    dropdown.textContent = '';
    const decryptDiv = document.createElement('div');
    decryptDiv.style.padding = '10px';
    decryptDiv.style.color = '#aaa';
    decryptDiv.textContent = 'Decrypting...';
    dropdown.appendChild(decryptDiv);
    chrome.runtime.sendMessage({
        type: 'SEND_NATIVE',
        payload: {
            id: Date.now(),
            type: 'GET_CREDENTIALS',
            entryId: entryId
        }
    });
}

function fillPassword(cred) {
    if (activeInput) {
        activeInput.value = cred.password;
        activeInput.dispatchEvent(new Event('input', { bubbles: true })); // Trigger React/Angular changes
        activeInput.dispatchEvent(new Event('change', { bubbles: true }));

        // Kullanıcı adını da bulup doldurmayı dene (input type=text/email ve activeInput'tan önce gelen)
        if (cred.username) {
            // Basit bir yaklaşım: aynı formdaki önceki input
            const form = activeInput.form;
            if (form) {
                const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"]):not([type="submit"])'));
                const passIndex = inputs.indexOf(activeInput);
                if (passIndex > 0) {
                    const userInput = inputs[passIndex - 1];
                    userInput.value = cred.username;
                    userInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        }
    }
    dropdown.style.display = 'none';
}

// Başlarken tara
setInterval(scanInputs, 1000);
