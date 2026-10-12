const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('highlighted fonts preview even when the native select only contains the committed font', () => {
    const source = fs.readFileSync('script.js', 'utf8');
    const start = source.indexOf('function previewTimerFont(value)');
    const end = source.indexOf("if (typeof TomSelect", start);
    const timer = { style: { fontFamily: '"Open Sans"' } };
    const timerFontInput = {
        value: 'Open Sans', options: [{ value: 'Open Sans' }],
        tomselect: { options: { 'Open Sans': {}, Roboto: {}, Lato: {} } }
    };
    const context = vm.createContext({ timer, timerFontInput });
    vm.runInContext(source.slice(start, end), context);
    for (const font of ['Roboto', 'Lato', 'Roboto', 'Open Sans']) {
        context.previewTimerFont(font);
        assert.equal(timer.style.fontFamily, `"${font}"`);
        assert.equal(timerFontInput.value, 'Open Sans');
    }
    context.previewTimerFont('Unknown');
    assert.equal(timer.style.fontFamily, '"Open Sans"');
    delete timerFontInput.tomselect;
    context.previewTimerFont('Open Sans');
    assert.equal(timer.style.fontFamily, '"Open Sans"');
});
