(() => {
    const enabled = document.getElementById('splits-enabled');
    const editor = document.getElementById('splits-editor');
    const container = document.getElementById('split-rows');
    const add = document.getElementById('add-split');
    const font = document.getElementById('split-font');
    let previewFont = font.value;
    function refreshStyle(value = font.value) {
        previewFont = value;
        for (const id of ['split-size', 'split-opacity']) updateNumberField(id, document.getElementById(id).value);
        const style = textStyle();
        document.fonts.load(style.font, 'Split 0123456789:.').catch(() => {});
        document.dispatchEvent(new Event('splitstylechange'));
    }
    function textStyle() {
        const size = Number(document.getElementById('split-size').value);
        return {
            size, font: `${document.getElementById('split-italic').checked ? 'italic' : 'normal'} ${document.getElementById('split-bold').checked ? '700' : '400'} ${size}px "${previewFont}", sans-serif`,
            colour: document.getElementById('split-colour').value,
            opacity: Number(document.getElementById('split-opacity').value) / 100
        };
    }
    if (typeof TomSelect !== 'undefined') new TomSelect(font, {
        onInitialize() { this.hook('after', 'setActiveOption', () => {
            if (this.isOpen) refreshStyle(this.activeOption?.dataset.value || this.getValue());
        }); },
        onDropdownOpen() { refreshStyle(this.activeOption?.dataset.value || this.getValue()); },
        onDropdownClose() { refreshStyle(this.getValue()); },
        onChange(value) { refreshStyle(value); },
        render: { option(data, escape) {
            return `<div style="font-family:'${escape(data.value)}',sans-serif">${escape(data.text)} <span>12.34</span></div>`;
        } }
    });
    for (const id of ['split-font', 'split-size', 'split-colour', 'split-opacity', 'split-bold', 'split-italic']) {
        document.getElementById(id).addEventListener('input', () => refreshStyle());
    }
    refreshStyle();
    const stored = window.TimerSettings?.state.splits;
    let rows = Array.isArray(stored) ? stored.slice(0, 8).map(row => ({
        name: String(row?.name || '').slice(0, 32),
        seconds: Number.isFinite(Number(row?.seconds)) ? Math.max(0, Math.min(359999.999, Number(row.seconds))) : 0
    })) : [{ name: 'Split 1', seconds: 0 }, { name: 'Split 2', seconds: 4 }];
    window.TimerSettings?.registerState('splits', () => rows.map(row => ({ ...row })));
    window.TimerSplits = {
        textStyle,
        snapshot: () => enabled.checked ? rows.map((row, index) => ({
            name: row.name.trim() || `Split ${index + 1}`, time: row.seconds * 1000
        })).sort((a, b) => a.time - b.time) : [],
        validate: () => !enabled.checked || [...container.querySelectorAll('input')].every(input => input.checkValidity())
    };
    function notice() {
        editor.hidden = !enabled.checked;
        add.disabled = rows.length >= 8;
        const stop = ['stopTimerHours', 'stopTimerMinutes', 'stopTimerSeconds'].reduce((sum, id, i) => sum + Number(document.getElementById(id).value) * [3600, 60, 1][i], 0);
        document.getElementById('splits-notice').textContent = rows.some(row => row.seconds > stop)
            ? 'Some splits are after the stop time and will remain pending. Increase the stop time or edit those splits.'
            : `${rows.length} of 8 splits. Use Fit frame to timer after adding splits to include the whole panel.`;
    }
    function render() {
        container.replaceChildren();
        rows.forEach((row, index) => {
            const line = document.createElement('div'); line.className = 'split-editor-row';
            const nameLabel = document.createElement('label'); nameLabel.textContent = 'Name';
            const name = document.createElement('input'); name.type = 'text'; name.maxLength = 32; name.value = row.name; name.placeholder = `Split ${index + 1}`;
            name.setAttribute('aria-label', `Split ${index + 1} name`);
            const timeLabel = document.createElement('label'); timeLabel.textContent = 'Starts at (seconds)';
            const time = document.createElement('input'); time.type = 'number'; time.min = 0; time.max = 359999.999; time.step = .001; time.required = true; time.value = row.seconds;
            time.setAttribute('aria-label', `Split ${index + 1} start time in seconds`);
            name.addEventListener('input', () => { row.name = name.value; });
            time.addEventListener('input', () => { if (time.validity.valid) row.seconds = Number(time.value); notice(); });
            const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove split ${index + 1}`);
            remove.addEventListener('click', () => { rows.splice(index, 1); render(); enabled.dispatchEvent(new Event('input', { bubbles: true })); });
            nameLabel.append(name); timeLabel.append(time); line.append(nameLabel, timeLabel, remove); container.append(line);
        });
        notice();
    }
    add.addEventListener('click', () => {
        if (rows.length >= 8) return;
        rows.push({ name: `Split ${rows.length + 1}`, seconds: Math.max(0, ...rows.map(row => row.seconds)) + 1 });
        render();
        enabled.dispatchEvent(new Event('input', { bubbles: true }));
    });
    enabled.addEventListener('change', notice);
    for (const id of ['stopTimerHours', 'stopTimerMinutes', 'stopTimerSeconds']) document.getElementById(id).addEventListener('input', notice);
    render();
})();
