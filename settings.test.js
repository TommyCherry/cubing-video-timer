const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('settings.js', 'utf8');

function page(storage) {
    const controls = [
        { id: 'font-size', type: 'range', value: '112', min: '16', max: '400' },
        { id: 'custom-dimensions', type: 'checkbox', checked: false },
        { id: 'padding-top', type: 'range', value: '32', min: '0', max: '2000', disabled: true },
        { id: 'textcolour', type: 'color', value: '#ff0000' },
        { id: 'video-format', tagName: 'SELECT', value: 'mov', options: [{ value: 'mov' }, { value: 'mp4' }] }
    ].map(c => ({ tagName: 'INPUT', validity: { valid: true }, closest: () => true, ...c }));
    const elements = Object.fromEntries(controls.map(c => [c.id, c]));
    for (const id of ['bold-toggle', 'italic-toggle']) {
        let active = id === 'italic-toggle';
        elements[id] = { setAttribute() {}, classList: { contains: () => active, toggle: (_, value) => { active = value; } } };
    }
    elements['settings-status'] = {};
    const events = {};
    const window = { addEventListener(type, callback) { events[type] = callback; } };
    const document = {
        querySelectorAll: () => controls,
        getElementById: id => elements[id],
        addEventListener(type, callback) { events[type] = callback; }
    };
    vm.runInNewContext(source, { document, window, localStorage: storage });
    return { elements, events, window, controls };
}

test('settings round-trip includes disabled fields, toggles and hidden lock ratios', () => {
    let saved;
    const storage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
    const first = page(storage);
    first.elements['font-size'].value = '200';
    first.elements['custom-dimensions'].checked = true;
    first.elements['padding-top'].value = '75.5';
    first.elements.textcolour.value = '#123456';
    first.elements['video-format'].value = 'mp4';
    first.elements['bold-toggle'].classList.toggle('active', true);
    first.elements['italic-toggle'].classList.toggle('active', false);
    first.window.TimerSettings.registerState('videoRatio', () => 16 / 9);
    first.events.input({ target: first.controls[0] });
    const next = page(storage);
    for (const control of first.controls) {
        assert.equal(next.elements[control.id][control.type === 'checkbox' ? 'checked' : 'value'], control[control.type === 'checkbox' ? 'checked' : 'value']);
    }
    assert.equal(next.elements['bold-toggle'].classList.contains('active'), true);
    assert.equal(next.elements['italic-toggle'].classList.contains('active'), false);
    assert.equal(next.window.TimerSettings.state.videoRatio, 16 / 9);
});

test('corrupt or unavailable storage leaves usable defaults', () => {
    const broken = page({ getItem: () => '{broken', setItem() { throw new Error('blocked'); } });
    assert.equal(broken.elements['font-size'].value, '112');
    assert.doesNotThrow(() => broken.events.pagehide());
    assert.match(broken.elements['settings-status'].textContent, /could not be saved/);
    const invalid = page({ getItem: () => JSON.stringify({ controls: { 'font-size': '-1', 'video-format': 'invalid', textcolour: 'invalid' } }) });
    assert.equal(invalid.elements['font-size'].value, '112');
    assert.equal(invalid.elements['video-format'].value, 'mov');
    assert.equal(invalid.elements.textcolour.value, '#ff0000');
});

test('loading a preset survives pagehide and restores its values on reload', () => {
    let saved;
    const storage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
    const current = page(storage);
    let reloaded = false;
    current.window.location = { reload() { reloaded = true; } };
    current.window.TimerSettings.loadSnapshot({ controls: { 'font-size': '240' }, toggles: { 'bold-toggle': true }, state: { videoRatio: 1 } });
    current.events.pagehide();
    assert.equal(reloaded, true);
    const next = page(storage);
    assert.equal(next.elements['font-size'].value, '240');
    assert.equal(next.elements['bold-toggle'].classList.contains('active'), true);
    assert.equal(next.window.TimerSettings.state.videoRatio, 1);
});

test('reset restores standard defaults and clears saved lock state without touching presets', () => {
    const data = new Map([
        ['cubing-video-timer.settings.v1', JSON.stringify({ controls: { 'font-size': '300', 'custom-dimensions': true }, toggles: { 'bold-toggle': true, 'italic-toggle': false }, state: { videoRatio: 2 } })],
        ['cubing-video-timer.presets.v1', 'named presets remain here']
    ]);
    const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
    const current = page(storage);
    current.window.location = { reload() {} };
    current.window.TimerSettings.resetDefaults();
    current.events.pagehide();
    const next = page(storage);
    assert.equal(next.elements['font-size'].value, '112');
    assert.equal(next.elements['custom-dimensions'].checked, false);
    assert.equal(next.elements['bold-toggle'].classList.contains('active'), false);
    assert.equal(next.elements['italic-toggle'].classList.contains('active'), true);
    assert.equal(Object.keys(next.window.TimerSettings.state).length, 0);
    assert.equal(data.get('cubing-video-timer.presets.v1'), 'named presets remain here');
});
