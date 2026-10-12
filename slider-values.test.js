const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('split gap stays synchronized on restoration, slider moves, and numeric edits', () => {
    function control(value) {
        const listeners = {};
        return {
            value, disabled: false, validity: { valid: true },
            addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
            dispatchEvent(event) { for (const fn of listeners[event.type] || []) fn(event); },
            select() {}
        };
    }
    const slider = control('55');
    const field = control('24');
    field.dataset = { slider: 'split-column-gap' };
    const document = {
        activeElement: null,
        querySelectorAll: () => [field],
        getElementById: () => slider
    };
    vm.runInNewContext(fs.readFileSync('slider-values.js', 'utf8'), { document, Event });
    assert.equal(Number(field.value), 55, 'restored value replaces HTML default');
    slider.value = '80';
    slider.dispatchEvent(new Event('input'));
    assert.equal(Number(field.value), 80);
    document.activeElement = field;
    field.dispatchEvent(new Event('focus'));
    field.value = '0';
    field.dispatchEvent(new Event('input'));
    assert.equal(Number(slider.value), 0, 'zero applies immediately from the number field');
    field.value = '';
    field.dispatchEvent(new Event('input'));
    assert.equal(Number(slider.value), 0, 'incomplete typing preserves the previous gap');
    document.activeElement = null;
    field.dispatchEvent(new Event('blur'));
    assert.equal(Number(field.value), 0);
    slider.value = '400';
    slider.dispatchEvent(new Event('change'));
    assert.equal(Number(field.value), 400);
});
