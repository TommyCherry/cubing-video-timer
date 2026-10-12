// Restore controls before timer/export initialization so their first render uses saved values.
(() => {
    const key = 'cubing-video-timer.settings.v1';
    const controls = [...document.querySelectorAll('#controls input[id]:not(.slider-value), #controls select[id], #video-export input[id]:not(.slider-value), #video-export select[id]')];
    const toggles = ['bold-toggle', 'italic-toggle'];
    const stateReaders = new Map();
    let loadingPreset = false;
    let stored = {};
    const notice = document.getElementById('settings-status');
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || '{}');
        if (parsed && typeof parsed === 'object') stored = parsed;
    } catch {
        notice.textContent = 'Saved settings could not be loaded. Browser storage may be unavailable.';
    }
    for (const input of controls) {
        const value = stored.controls?.[input.id];
        if (input.type === 'checkbox') {
            if (typeof value === 'boolean') input.checked = value;
        } else if (typeof value === 'string') {
            if (input.tagName === 'SELECT' && ![...input.options].some(option => option.value === value)) continue;
            if (input.type === 'color' && !/^#[\da-f]{6}$/i.test(value)) continue;
            if (input.type === 'range' || input.type === 'number') {
                if (!value.trim() || !Number.isFinite(Number(value))) continue;
                if (input.min !== '' && Number(value) < Number(input.min)) continue;
                if (input.max !== '' && Number(value) > Number(input.max)) continue;
            }
            input.value = value;
        }
    }
    for (const id of toggles) {
        const toggle = document.getElementById(id);
        if (typeof stored.toggles?.[id] === 'boolean') toggle.classList.toggle('active', stored.toggles[id]);
        toggle.setAttribute('aria-pressed', String(toggle.classList.contains('active')));
    }
    window.TimerSettings = {
        state: stored.state && typeof stored.state === 'object' ? stored.state : {},
        registerState(name, read) { stateReaders.set(name, read); },
        snapshot,
        resetDefaults() {
            // An empty snapshot restores the HTML defaults on the next initialization.
            this.loadSnapshot({});
        },
        loadSnapshot(settings) {
            localStorage.setItem(key, JSON.stringify(settings));
            // Do not let pagehide overwrite the incoming preset with the outgoing setup.
            loadingPreset = true;
            window.location.reload();
        }
    };
    function snapshot() {
        const values = { ...stored.controls };
        for (const input of controls) {
            if (input.type === 'checkbox') values[input.id] = input.checked;
            else if (input.value !== '' && input.validity.valid) values[input.id] = input.value;
        }
        const toggleValues = Object.fromEntries(toggles.map(id => {
            const toggle = document.getElementById(id);
            const active = toggle.classList.contains('active');
            toggle.setAttribute('aria-pressed', String(active));
            return [id, active];
        }));
        return { controls: values, toggles: toggleValues, state: Object.fromEntries([...stateReaders].map(([name, read]) => [name, read()])) };
    }
    function save() {
        if (loadingPreset) return;
        stored = snapshot();
        try {
            localStorage.setItem(key, JSON.stringify(stored));
            notice.textContent = 'Settings saved automatically in this browser.';
        } catch {
            notice.textContent = 'Settings could not be saved. Allow browser storage to keep them after refreshing.';
        }
    }
    for (const event of ['input', 'change', 'click']) {
        document.addEventListener(event, e => {
            if (e.target.closest('#controls, #video-export')) save();
        });
    }
    window.addEventListener('pagehide', save);
})();
