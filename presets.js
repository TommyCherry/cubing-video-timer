function createPresetStore(storage) {
    const key = 'cubing-video-timer.presets.v1';
    const read = () => {
        const data = JSON.parse(storage.getItem(key) || '{"items":[],"selected":""}');
        if (!data || !Array.isArray(data.items)) throw new Error('Saved presets could not be read.');
        return data;
    };
    const write = data => { storage.setItem(key, JSON.stringify(data)); return data; };
    const nameFor = (name, items, id) => {
        name = name.trim();
        if (!name || name.length > 60) throw new Error('Enter a preset name of 1–60 characters.');
        if (items.some(item => item.id !== id && item.name.toLowerCase() === name.toLowerCase())) throw new Error('That name is already used. Choose another name or update the existing preset.');
        return name;
    };
    return {
        read,
        select(id) { const data = read(); data.selected = id; return write(data); },
        save(name, settings, id = null) {
            const data = read();
            name = nameFor(name, data.items, id);
            if (id && !data.items.some(item => item.id === id)) throw new Error('That preset no longer exists.');
            const item = { id: id || crypto.randomUUID(), name, settings };
            data.items = id ? data.items.map(old => old.id === id ? item : old) : [...data.items, item];
            data.selected = item.id;
            return write(data);
        },
        remove(id) {
            const data = read();
            const item = data.items.find(item => item.id === id);
            if (!item) throw new Error('Choose a saved preset first.');
            data.items = data.items.filter(item => item.id !== id);
            data.selected = '';
            write(data);
            return item;
        },
        restore(item) {
            const data = read();
            nameFor(item.name, data.items, null);
            data.items.push(item);
            data.selected = item.id;
            return write(data);
        }
    };
}

if (typeof module !== 'undefined') module.exports = { createPresetStore };

if (typeof document !== 'undefined') {
    const picker = document.getElementById('preset-picker');
    const nameInput = document.getElementById('preset-name');
    const status = document.getElementById('preset-status');
    const undo = document.getElementById('undo-preset');
    let store;
    let deleted;
    function run(action) {
        try { action(); }
        catch (error) { status.textContent = error.message || 'Presets could not be saved. Check browser storage permissions.'; }
    }
    function render() {
        const data = store.read();
        picker.replaceChildren(new Option('Choose a preset', ''));
        for (const item of data.items) picker.add(new Option(item.name, item.id));
        picker.value = data.selected || '';
        const selected = data.items.find(item => item.id === picker.value);
        nameInput.value = selected?.name || '';
        for (const id of ['load-preset', 'update-preset', 'delete-preset']) document.getElementById(id).disabled = !selected;
    }
    run(() => { store = createPresetStore(localStorage); render(); });
    picker.addEventListener('change', () => run(() => { store.select(picker.value); render(); status.textContent = ''; }));
    document.getElementById('save-preset').addEventListener('click', () => run(() => {
        store.save(nameInput.value, window.TimerSettings.snapshot());
        render();
        status.textContent = `Saved “${nameInput.value}”.`;
    }));
    document.getElementById('update-preset').addEventListener('click', () => run(() => {
        if (!picker.value) throw new Error('Choose a saved preset first.');
        store.save(nameInput.value, window.TimerSettings.snapshot(), picker.value);
        render();
        status.textContent = `Updated “${nameInput.value}”.`;
    }));
    document.getElementById('load-preset').addEventListener('click', () => run(() => {
        const item = store.read().items.find(item => item.id === picker.value);
        if (!item) throw new Error('Choose a saved preset first.');
        if (document.getElementById('download-video').disabled) throw new Error('Finish or cancel the video export before loading a preset.');
        window.TimerSettings.loadSnapshot(item.settings);
    }));
    document.getElementById('reset-all-settings').addEventListener('click', () => run(() => {
        if (document.getElementById('download-video').disabled) throw new Error('Finish or cancel the video export before resetting settings.');
        // A damaged preset list must not prevent resetting the current setup.
        try { store.select(''); } catch { /* Preset contents are preserved. */ }
        window.TimerSettings.resetDefaults();
    }));
    document.getElementById('delete-preset').addEventListener('click', () => run(() => {
        deleted = store.remove(picker.value);
        render();
        undo.hidden = false;
        status.textContent = `Deleted “${deleted.name}”. Your current settings are unchanged.`;
    }));
    undo.addEventListener('click', () => run(() => {
        store.restore(deleted);
        render();
        deleted = undefined;
        undo.hidden = true;
        status.textContent = 'Preset restored.';
    }));
}
