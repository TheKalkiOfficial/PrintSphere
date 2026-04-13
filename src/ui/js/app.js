document.addEventListener('DOMContentLoaded', () => {
    const SETTINGS_STORAGE_KEY = 'printsphere-settings';
    const PROTOCOL_STORAGE_KEY = 'printsphere-protocol';
    const protocolMeta = {
        ZPL: {
            title: 'ZPL',
            hint: 'Send ZPL to the TCP printer service or use the test window.',
            hello: '^XA\n^PW800\n^LL600\n^FT100,120\n^A0N,40,40\n^FDHello World^FS\n^XZ',
        },
        'ESC/POS': {
            title: 'ESC/POS',
            hint: 'Send ESC/POS receipt data or use the test window.',
            hello: '\u001B@\u001Ba\u0001Hello World\nThank you!\n\u001DV\u0000',
        },
        TSPL: {
            title: 'TSPL',
            hint: 'TSPL still uses the generic preview path in this app.',
            hello: 'SIZE 60,40\nCLS\nTEXT 20,40,"0",0,1,1,"Hello World"\nPRINT 1,1',
        },
        CPCL: {
            title: 'CPCL',
            hint: 'CPCL still uses the generic preview path in this app.',
            hello: '! 0 200 200 400 1\nTEXT 4 0 40 60 Hello World\nPRINT',
        },
    };

    const zplFlags = [
        { key: 'headOpen', label: 'Head Open' },
        { key: 'paperOut', label: 'Paper Out' },
        { key: 'ribbonOut', label: 'Ribbon Out' },
        { key: 'paperJam', label: 'Paper Jam' },
        { key: 'printerPaused', label: 'Printer Paused' },
        { key: 'cutterFault', label: 'Cutter Fault' },
        { key: 'headTooHot', label: 'Head Too Hot' },
        { key: 'motorOverheat', label: 'Motor Overheat' },
        { key: 'rewindFault', label: 'Rewind Fault' },
    ];

    const zplWarnings = [
        { key: 'mediaNearEnd', label: 'Media Near End' },
        { key: 'ribbonNearEnd', label: 'Ribbon Near End' },
        { key: 'replacePrinthead', label: 'Replace Printhead' },
        { key: 'cleanPrinthead', label: 'Clean Printhead' },
    ];

    const zplErrors = [
        { key: 'mediaOut', label: 'Media Out' },
        { key: 'ribbonOut', label: 'Ribbon Out' },
        { key: 'headOpen', label: 'Head Open' },
        { key: 'cutterFault', label: 'Cutter Fault' },
        { key: 'printheadOverTemp', label: 'Printhead Over Temp' },
        { key: 'motorOverTemp', label: 'Motor Over Temp' },
        { key: 'badPrintheadElement', label: 'Bad Printhead Element' },
        { key: 'printheadDetectionError', label: 'Printhead Detection Error' },
    ];

    const escposFlags = [
        { key: 'online', label: 'Online' },
        { key: 'paperFeedPressed', label: 'Paper Feed Pressed' },
        { key: 'coverOpen', label: 'Cover Open' },
        { key: 'paperBeingFed', label: 'Paper Being Fed' },
        { key: 'paperEnd', label: 'Paper End' },
        { key: 'errorOccurred', label: 'Error Occurred' },
        { key: 'recoverableError', label: 'Recoverable Error' },
        { key: 'cutterError', label: 'Auto Cutter Error' },
        { key: 'unrecoverableError', label: 'Unrecoverable Error' },
        { key: 'autoRecoverableError', label: 'Autorecoverable Error' },
        { key: 'paperLow', label: 'Paper Low' },
    ];

    const elements = {
        autoRefreshToggle: document.getElementById('autoRefreshToggle'),
        clearJobsBtn: document.getElementById('clearJobsBtn'),
        directorySuggestBtn: document.getElementById('directorySuggestBtn'),
        errorGrid: document.getElementById('errorGrid'),
        escposPreviewCanvas: document.getElementById('escposPreviewCanvas'),
        escposStatusGrid: document.getElementById('escposStatusGrid'),
        genericPreviewCanvas: document.getElementById('genericPreviewCanvas'),
        jobCountBadge: document.getElementById('jobCountBadge'),
        jobsContainer: document.getElementById('jobsContainer'),
        languageModeSwitch: document.getElementById('languageModeSwitch'),
        panelPrinterTitle: document.getElementById('panelPrinterTitle'),
        powerToggle: document.getElementById('powerToggle'),
        previewHint: document.getElementById('previewHint'),
        settingsCancelBtn: document.getElementById('settingsCancelBtn'),
        settingsCloseBtn: document.getElementById('settingsCloseBtn'),
        settingsForm: document.getElementById('settingsForm'),
        settingsModal: document.getElementById('settingsModal'),
        settingsOpenBtn: document.getElementById('settingsOpenBtn'),
        settingsTitle: document.getElementById('settingsTitle'),
        statusGrid: document.getElementById('statusGrid'),
        statusHost: document.getElementById('statusHost'),
        statusPort: document.getElementById('statusPort'),
        statusToast: document.getElementById('statusToast'),
        statusToastCloseBtn: document.getElementById('statusToastCloseBtn'),
        serverStatusText: document.getElementById('serverStatusText'),
        testCancelBtn: document.getElementById('testCancelBtn'),
        testCloseBtn: document.getElementById('testCloseBtn'),
        testData: document.getElementById('testData'),
        testForm: document.getElementById('testForm'),
        testHelloBtn: document.getElementById('testHelloBtn'),
        testModal: document.getElementById('testModal'),
        testOpenBtn: document.getElementById('testOpenBtn'),
        testPrinterTitle: document.getElementById('testPrinterTitle'),
        warningGrid: document.getElementById('warningGrid'),
        windowCloseBtn: document.getElementById('windowCloseBtn'),
        zplPreviewCanvas: document.getElementById('zplPreviewCanvas'),
    };

    let refreshInterval = null;
    let knownJobsSignature = '';
    let selectedJobId = null;
    let currentSettings = null;
    let currentStatus = { running: false, host: '0.0.0.0', tcpPort: 9100 };
    let currentProtocol = 'ZPL';
    let statusToastTimer = null;
    let knownJobIds = new Set();
    let incomingPreviewJobId = null;
    let renderedSelectionJobId = null;

    buildToggleGrid(elements.statusGrid, 'zplStatus', zplFlags);
    buildToggleGrid(elements.warningGrid, 'zplWarnings', zplWarnings, 'warning');
    buildToggleGrid(elements.errorGrid, 'zplErrors', zplErrors, 'danger');
    buildToggleGrid(elements.escposStatusGrid, 'escposStatus', escposFlags);
    bindEvents();
    initialize();

    function bindEvents() {
        elements.autoRefreshToggle.addEventListener('change', toggleAutoRefresh);
        elements.clearJobsBtn.addEventListener('click', clearJobs);
        elements.directorySuggestBtn.addEventListener('click', () => {
            elements.settingsForm.elements.directoryPath.value = 'D:\\printer\\output';
        });
        elements.settingsOpenBtn.addEventListener('click', openSettings);
        elements.settingsCloseBtn.addEventListener('click', closeSettings);
        elements.settingsCancelBtn.addEventListener('click', closeSettings);
        elements.settingsForm.addEventListener('submit', saveSettings);
        elements.statusToastCloseBtn.addEventListener('click', hideStatusToast);
        elements.testOpenBtn.addEventListener('click', openTestModal);
        elements.testCloseBtn.addEventListener('click', closeTestModal);
        elements.testCancelBtn.addEventListener('click', closeTestModal);
        elements.testForm.addEventListener('submit', submitTestPrint);
        elements.testHelloBtn.addEventListener('click', fillHelloWorld);
        elements.windowCloseBtn.addEventListener('click', () => window.close());

        elements.settingsModal.addEventListener('click', (event) => {
            if (event.target === elements.settingsModal) {
                closeSettings();
            }
        });

        elements.testModal.addEventListener('click', (event) => {
            if (event.target === elements.testModal) {
                closeTestModal();
            }
        });

        elements.languageModeSwitch.querySelectorAll('button').forEach((button) => {
            button.addEventListener('click', () => updateProtocol(button.dataset.mode));
        });

        elements.powerToggle.querySelectorAll('button').forEach((button) => {
            button.addEventListener('click', async () => {
                await setPrinterPower(button.dataset.running === 'true');
            });
        });

        document.querySelectorAll('.tab-button').forEach((button) => {
            button.addEventListener('click', () => setActiveTab(button.dataset.tab));
        });
    }

    async function initialize() {
        await Promise.all([fetchSettings(), checkServerStatus(), fetchJobs()]);
        toggleAutoRefresh();
    }

    function buildToggleGrid(container, groupName, flags, tone = '') {
        container.innerHTML = flags.map((flag) => `
            <label class="status-toggle${tone ? ` tone-${tone}` : ''}">
                <input type="checkbox" name="${groupName}.${flag.key}">
                <span class="check-mark"></span>
                <span>${flag.label}</span>
            </label>
        `).join('');
    }

    function toggleAutoRefresh() {
        clearInterval(refreshInterval);
        if (elements.autoRefreshToggle.checked) {
            refreshInterval = setInterval(fetchJobs, 2500);
        }
    }

    async function fetchSettings() {
        const res = await fetch('/api/settings');
        currentSettings = await res.json();
        mergeStoredSettings(currentSettings);
        hydrateSettingsForm(currentSettings);
        persistSettingsLocally(currentSettings);
    }

    async function checkServerStatus() {
        try {
            const res = await fetch('/api/status');
            currentStatus = await res.json();
            syncStatusUI();
            showStatusToast();
        } catch {
            currentStatus = { running: false, host: '0.0.0.0', tcpPort: 9100 };
            elements.serverStatusText.textContent = 'Printer service offline';
            elements.previewHint.textContent = 'Printer service is offline';
            showStatusToast();
        }
    }

    function syncStatusUI() {
        const running = Boolean(currentStatus.running);
        elements.statusHost.textContent = currentStatus.host;
        elements.statusPort.textContent = currentStatus.tcpPort;
        setActiveSegment(elements.powerToggle, String(running));
        elements.serverStatusText.textContent = running
            ? `Printer started on Host: ${currentStatus.host} Port: ${currentStatus.tcpPort}`
            : `Printer stopped. Turn ON to listen on Host: ${currentStatus.host} Port: ${currentStatus.tcpPort}`;
        elements.previewHint.textContent = running
            ? `Listening for printer commands on ${currentStatus.host}:${currentStatus.tcpPort}`
            : `Printer service is OFF. Use the ON button to start listening on ${currentStatus.host}:${currentStatus.tcpPort}`;
    }

    async function fetchJobs() {
        const res = await fetch('/api/jobs');
        if (!res.ok) {
            return;
        }

        const jobs = await res.json();
        renderJobs(jobs);
    }

    function renderJobs(jobs) {
        const nextSignature = JSON.stringify(jobs.map((job) => [job.jobId, job.status, job.timestamp]));
        if (
            nextSignature === knownJobsSignature &&
            selectedJobId === renderedSelectionJobId &&
            jobs.some((job) => job.jobId === selectedJobId)
        ) {
            return;
        }

        const nextJobIds = new Set(jobs.map((job) => job.jobId));
        const incomingJobs = jobs.filter((job) => !knownJobIds.has(job.jobId));
        incomingPreviewJobId = incomingJobs[0]?.jobId || null;
        knownJobIds = nextJobIds;
        knownJobsSignature = nextSignature;
        elements.jobCountBadge.textContent = `${jobs.length} jobs`;
        elements.jobsContainer.innerHTML = '';

        if (jobs.length === 0) {
            selectedJobId = null;
            incomingPreviewJobId = null;
            renderedSelectionJobId = null;
            renderPreview(null);
            return;
        }

        const nextSelected = incomingJobs[0] || jobs.find((job) => job.jobId === selectedJobId) || jobs[0];
        selectedJobId = nextSelected.jobId;
        renderedSelectionJobId = nextSelected.jobId;

        jobs.forEach((job) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = `job-card${job.jobId === selectedJobId ? ' active' : ''}`;
            if (job.jobId === incomingPreviewJobId) {
                card.classList.add('incoming');
            }
            card.innerHTML = `
                <div class="job-card-header">
                    <strong>${job.jobId}</strong>
                    <span class="status-badge ${job.status}">${job.status}</span>
                </div>
                <div class="job-card-meta">
                    <span>${job.language}</span>
                    <span>${new Date(job.timestamp).toLocaleTimeString()}</span>
                </div>
            `;
            card.addEventListener('click', () => {
                selectedJobId = job.jobId;
                renderJobs(jobs);
            });
            elements.jobsContainer.appendChild(card);
        });

        renderPreview(nextSelected);
    }

    function renderPreview(job) {
        elements.zplPreviewCanvas.innerHTML = '';
        elements.escposPreviewCanvas.innerHTML = '';
        elements.genericPreviewCanvas.innerHTML = '';

        if (!job) {
            return;
        }

        const target = getPreviewTarget(job.language);
        const previewClasses = job.jobId === incomingPreviewJobId ? 'preview-entry incoming' : 'preview-entry';
        if (job.language === 'ESC/POS' && job.html) {
            target.innerHTML = `<div class="${previewClasses}"><iframe class="escpos-frame" srcdoc="${escapeAttribute(job.html)}"></iframe></div>`;
        } else if (job.svg) {
            target.innerHTML = `<div class="${previewClasses}">${job.svg}</div>`;
        } else {
            target.innerHTML = '<div class="empty-state inline-empty"><h3>Preview unavailable</h3><p>This job did not render successfully.</p></div>';
        }
    }

    function getPreviewTarget(language) {
        if (language === 'ZPL') {
            return elements.zplPreviewCanvas;
        }
        if (language === 'ESC/POS') {
            return elements.escposPreviewCanvas;
        }
        return elements.genericPreviewCanvas;
    }

    function hydrateSettingsForm(settings) {
        const form = elements.settingsForm.elements;
        form.printDensity.value = settings.printDensity || '8 dpmm (203 dpi)';
        form.unit.value = settings.unit || 'millimeters';
        form.width.value = settings.width || 4;
        form.height.value = settings.height || 6;
        form.host.value = settings.host || '0.0.0.0';
        form.port.value = settings.port || 9100;
        form.bufferSize.value = settings.bufferSize || 4096;
        form.keepTcpAlive.checked = Boolean(settings.keepTcpAlive);
        form.saveLabels.checked = Boolean(settings.saveLabels);
        form.fileType.value = settings.fileType || 'txt';
        form.directoryPath.value = settings.directoryPath || '';

        applyFlagValues('zplStatus', settings.zplStatus, zplFlags);
        applyFlagValues('zplWarnings', settings.zplWarnings, zplWarnings);
        applyFlagValues('zplErrors', settings.zplErrors, zplErrors);
        applyFlagValues('escposStatus', settings.escposStatus, escposFlags);

        applyPreviewSheet(settings);
        updateProtocol(getStoredProtocol() || settings.languageMode || 'ZPL', false);
    }

    function applyFlagValues(group, values, flags) {
        flags.forEach((flag) => {
            const input = elements.settingsForm.elements[`${group}.${flag.key}`];
            if (input) {
                input.checked = Boolean(values?.[flag.key]);
            }
        });
    }

    function collectFlagValues(group, flags) {
        const result = {};
        flags.forEach((flag) => {
            result[flag.key] = elements.settingsForm.elements[`${group}.${flag.key}`].checked;
        });
        return result;
    }

    async function saveSettings(event) {
        event.preventDefault();
        const form = elements.settingsForm.elements;

        const payload = {
            languageMode: currentProtocol,
            printDensity: form.printDensity.value,
            unit: form.unit.value,
            width: Number.parseFloat(form.width.value),
            height: Number.parseFloat(form.height.value),
            host: form.host.value.trim(),
            port: Number.parseInt(form.port.value, 10),
            bufferSize: Number.parseInt(form.bufferSize.value, 10),
            keepTcpAlive: form.keepTcpAlive.checked,
            saveLabels: form.saveLabels.checked,
            fileType: form.fileType.value,
            directoryPath: form.directoryPath.value.trim(),
            zplStatus: collectFlagValues('zplStatus', zplFlags),
            zplWarnings: collectFlagValues('zplWarnings', zplWarnings),
            zplErrors: collectFlagValues('zplErrors', zplErrors),
            escposStatus: collectFlagValues('escposStatus', escposFlags),
        };

        const res = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            window.alert(data.error || 'Failed to save settings');
            return;
        }

        currentSettings = await res.json();
        persistSettingsLocally(currentSettings);
        hydrateSettingsForm(currentSettings);
        await checkServerStatus();
        closeSettings();
    }

    async function setPrinterPower(shouldRun) {
        const res = await fetch('/api/power', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ running: shouldRun }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            window.alert(data.error || 'Failed to change printer power state');
            await checkServerStatus();
            return;
        }

        currentStatus = await res.json();
        syncStatusUI();
        showStatusToast();
    }

    async function clearJobs() {
        if (!window.confirm('Are you sure you want to clear all rendered labels?')) {
            return;
        }

        const res = await fetch('/api/jobs', { method: 'DELETE' });
        if (res.ok) {
            selectedJobId = null;
            knownJobsSignature = '';
            await fetchJobs();
        }
    }

    async function submitTestPrint(event) {
        event.preventDefault();
        const rawData = elements.testData.value;

        const res = await fetch('/api/test-print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                protocol: currentProtocol,
                rawData,
            }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            window.alert(data.error || 'Failed to test print');
            return;
        }

        await fetchJobs();
        closeTestModal();
        showTransientMessage(`${currentProtocol} test print rendered`);
    }

    function fillHelloWorld() {
        elements.testData.value = protocolMeta[currentProtocol]?.hello || '';
    }

    function updateProtocol(protocol, syncSettings = true) {
        currentProtocol = protocol;
        localStorage.setItem(PROTOCOL_STORAGE_KEY, protocol);
        setActiveSegment(elements.languageModeSwitch, protocol);
        elements.panelPrinterTitle.textContent = protocol;
        elements.settingsTitle.textContent = `${protocol} Printer Settings`;
        elements.testPrinterTitle.textContent = protocol;

        document.querySelectorAll('.protocol-panel').forEach((panel) => {
            const panelProtocol = panel.dataset.protocol;
            const isGeneric = ['TSPL', 'CPCL'].includes(protocol) && panelProtocol === 'GENERIC';
            panel.classList.toggle('active', panelProtocol === protocol || isGeneric);
        });

        document.querySelectorAll('.zpl-only').forEach((node) => {
            node.classList.toggle('hidden', protocol !== 'ZPL');
        });
        document.querySelectorAll('.esc-only').forEach((node) => {
            node.classList.toggle('hidden', protocol !== 'ESC/POS');
        });

        if (syncSettings && currentSettings) {
            currentSettings.languageMode = protocol;
            persistSettingsLocally(currentSettings);
        }

        const runningText = currentStatus.running
            ? `Listening for printer commands on ${currentStatus.host}:${currentStatus.tcpPort}`
            : `Printer service is OFF. Use the ON button to start listening on ${currentStatus.host}:${currentStatus.tcpPort}`;
        elements.previewHint.textContent = `${runningText} • ${protocolMeta[protocol]?.hint || ''}`.trim();
    }

    function applyPreviewSheet(settings) {
        const width = Number.parseFloat(settings?.width) || 58;
        const height = Number.parseFloat(settings?.height) || 100;
        const unitMap = {
            inches: 'in',
            centimeters: 'cm',
            millimeters: 'mm',
            pixels: 'px',
        };
        const unit = unitMap[settings?.unit] || 'mm';
        document.documentElement.style.setProperty('--preview-sheet-width', `${Math.max(width, 1)}${unit}`);
        document.documentElement.style.setProperty('--preview-sheet-height', `${Math.max(height, 1)}${unit}`);
    }

    function mergeStoredSettings(settings) {
        try {
            const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (!raw) {
                return;
            }

            Object.assign(settings, JSON.parse(raw));
        } catch {
            localStorage.removeItem(SETTINGS_STORAGE_KEY);
        }
    }

    function persistSettingsLocally(settings) {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }

    function getStoredProtocol() {
        return localStorage.getItem(PROTOCOL_STORAGE_KEY);
    }

    function setActiveTab(tabName) {
        document.querySelectorAll('.tab-button').forEach((button) => {
            const active = button.dataset.tab === tabName;
            button.classList.toggle('active', active);
        });

        document.querySelectorAll('.tab-panel').forEach((panel) => {
            panel.classList.toggle('active', panel.dataset.panel === tabName);
        });
    }

    function setActiveSegment(container, value) {
        container.querySelectorAll('button').forEach((button) => {
            const candidate = button.dataset.mode ?? button.dataset.running;
            button.classList.toggle('active', candidate === value);
        });
    }

    function openSettings() {
        elements.settingsModal.classList.remove('hidden');
    }

    function closeSettings() {
        elements.settingsModal.classList.add('hidden');
        if (currentSettings) {
            hydrateSettingsForm(currentSettings);
        }
    }

    function openTestModal() {
        elements.testModal.classList.remove('hidden');
        fillHelloWorld();
    }

    function closeTestModal() {
        elements.testModal.classList.add('hidden');
    }

    function showStatusToast() {
        elements.statusToast.classList.remove('hidden');
        clearTimeout(statusToastTimer);
        statusToastTimer = window.setTimeout(hideStatusToast, 5000);
    }

    function hideStatusToast() {
        elements.statusToast.classList.add('hidden');
        clearTimeout(statusToastTimer);
    }

    function showTransientMessage(text) {
        elements.serverStatusText.textContent = text;
        showStatusToast();
        window.setTimeout(syncStatusUI, 1400);
    }

    function escapeAttribute(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
});
