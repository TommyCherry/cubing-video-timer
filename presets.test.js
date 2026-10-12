const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPresetStore } = require('./presets.js');

test('named presets persist, update, rename, delete and undo without mixing settings', () => {
    let saved;
    const storage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
    const store = createPresetStore(storage);
    const settings = { controls: { 'font-size': '200' }, toggles: { 'bold-toggle': true }, state: { videoRatio: 16 / 9 } };
    const first = store.save(' Competition ', settings).items[0];
    assert.equal(first.name, 'Competition');
    const reopened = createPresetStore(storage);
    assert.deepEqual(reopened.read().items[0].settings, settings);
    assert.throws(() => store.save('competition', {}), /already used/);
    assert.throws(() => store.save('   ', {}), /name/);
    store.save('Practice', { controls: { 'font-size': '80' } });
    store.save('Competition large', { ...settings, controls: { 'font-size': '300' } }, first.id);
    assert.equal(store.read().items.length, 2);
    assert.equal(store.read().items[0].settings.controls['font-size'], '300');
    const deleted = store.remove(first.id);
    assert.equal(store.read().items.length, 1);
    store.restore(deleted);
    assert.equal(store.read().selected, first.id);
    assert.equal(store.read().items.length, 2);
    assert.equal(store.read().items[0].settings.controls['font-size'], '80');
});

test('storage failures do not claim successful saves', () => {
    const store = createPresetStore({ getItem: () => null, setItem() { throw new Error('Storage blocked'); } });
    assert.throws(() => store.save('Example', {}), /Storage blocked/);
});
