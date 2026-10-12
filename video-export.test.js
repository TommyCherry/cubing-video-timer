const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeMov, formatTime, frameTime, drawFrame, frameRate, mp4MimeType, recordMp4 } = require('./video-export.js');

test('optical digit placement centers narrow and overhanging glyphs without changing cell width', () => {
    const { digitOffset } = require('./video-export.js');
    for (const metrics of [
        { actualBoundingBoxLeft: -70, actualBoundingBoxRight: 84 },
        { actualBoundingBoxLeft: 4, actualBoundingBoxRight: 90 },
        { actualBoundingBoxLeft: 0, actualBoundingBoxRight: 84 }
    ]) {
        const offset = digitOffset(metrics, 84);
        const left = offset - metrics.actualBoundingBoxLeft;
        const right = offset + metrics.actualBoundingBoxRight;
        assert.equal((left + right) / 2, 42);
    }
});

test('every numeral is optically centered in a stable cell for all font families', () => {
    const { alignedDigitOffset } = require('./video-export.js');
    const ctx = { measureText(char) {
        return char === '1'
            ? { width: 100, actualBoundingBoxLeft: -80, actualBoundingBoxRight: 100 }
            : { width: 100, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 100 };
    } };
    for (const font of ['7-Segment Display', '7-Segment Display Mini Light', 'Arial']) {
        for (const text of ['1', '11', '10', '01', '1.11', '11:11:11.111']) {
            [...text].forEach((char, index) => {
                if (!/[0-9]/.test(char)) return;
                const metrics = ctx.measureText(char);
                const offset = alignedDigitOffset(ctx, char, 100, font);
                const inkCenter = index * 100 + offset +
                    (metrics.actualBoundingBoxRight - metrics.actualBoundingBoxLeft) / 2;
                assert.equal(inkCenter, index * 100 + 50, `${font}: ${text}`);
            });
        }
    }
});

test('all 24 minimum formats and rollover boundaries', () => {
    const whole = ['0', '00', '0:00', '00:00', '0:00:00', '00:00:00'];
    for (let format = 0; format < 24; format++) {
        const precision = format % 4;
        assert.equal(formatTime(0, format), whole[Math.floor(format / 4)] + (precision ? '.' + '0'.repeat(precision) : ''));
    }
    assert.equal(formatTime(9999, 2), '9.99');
    assert.equal(formatTime(10000, 2), '10.00');
    assert.equal(formatTime(60000, 2), '1:00.00');
    assert.equal(formatTime(3600000, 2), '1:00:00.00');
    assert.equal(formatTime(6250, 3), '6.250');
});

test('export includes delay, speed and exact stop time', () => {
    assert.equal(frameTime(29, 30, 1, 6250, 2), 0);
    assert.equal(frameTime(60, 30, 1, 6250, 2), 2000);
    assert.equal(frameTime(200, 30, 1, 6250, 2), 6250);
});

function atoms(buffer, start = 0, end = buffer.length) {
    const result = [];
    while (start < end) {
        const length = buffer.readUInt32BE(start);
        assert.ok(length >= 8 && start + length <= end);
        result.push({ name: buffer.toString('ascii', start + 4, start + 8), start, end: start + length });
        start += length;
    }
    assert.equal(start, end);
    return result;
}

test('MOV sample offsets, dimensions, timing and RGBA sample description', async () => {
    const frames = [new Blob(['frame-one']), new Blob(['second-frame'])];
    const movie = makeMov(frames, 320, 180, 30);
    const buffer = Buffer.from(await movie.arrayBuffer());
    const top = atoms(buffer);
    assert.deepEqual(top.map(a => a.name), ['ftyp', 'mdat', 'moov']);
    const descend = (parent, name) => atoms(buffer, parent.start + 8, parent.end).find(a => a.name === name);
    const moov = top[2];
    const mvhd = descend(moov, 'mvhd');
    assert.equal(buffer.readUInt32BE(mvhd.start + 20), 30);
    assert.equal(buffer.readUInt32BE(mvhd.start + 24), 2);
    const stbl = descend(descend(descend(descend(moov, 'trak'), 'mdia'), 'minf'), 'stbl');
    const stco = descend(stbl, 'stco');
    assert.equal(buffer.readUInt32BE(stco.start + 16), top[1].start + 8);
    assert.equal(buffer.readUInt32BE(stco.start + 20), top[1].start + 8 + frames[0].size);
    const stsd = descend(stbl, 'stsd');
    const sample = stsd.start + 16;
    assert.equal(buffer.toString('ascii', sample + 4, sample + 8), 'png ');
    assert.equal(buffer.readUInt16BE(sample + 32), 320);
    assert.equal(buffer.readUInt16BE(sample + 34), 180);
    assert.equal(buffer.readUInt16BE(sample + 82), 32);
    assert.equal(buffer.toString('ascii', top[1].start + 8, top[1].end), 'frame-onesecond-frame');
});

test('preview/export renderer centers shapes, uses borders and supports text-only output', () => {
    const calls = [];
    const ctx = {
        measureText: () => ({ width: 10, fontBoundingBoxAscent: 15, fontBoundingBoxDescent: 5 }),
        clearRect() {}, beginPath() {}, setLineDash() {}, fillText() {}, strokeText() {},
        ellipse: (...args) => calls.push(['ellipse', ...args]),
        roundRect: (...args) => calls.push(['rect', ...args]),
        fill: () => calls.push(['fill']), stroke: () => calls.push(['stroke'])
    };
    const canvas = { width: 640, height: 480, getContext: () => ctx };
    const settings = {
        font: '20px sans-serif', size: 20, lineHeight: 24,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        includeShape: true, custom: true, oval: true, shapeWidth: 200, shapeHeight: 100,
        radius: 12, borderWidth: 4, borderStyle: 'solid', borderColour: '#fff', background: '#000',
        colour: '#f00', stroke: 0, strokeColour: '#fff'
    };
    drawFrame(canvas, '0.00', settings);
    assert.deepEqual(calls[0].slice(0, 5), ['ellipse', 320, 240, 100, 50]);
    assert.ok(calls.some(c => c[0] === 'stroke'));
    calls.length = 0;
    drawFrame(canvas, '0.00', { ...settings, oval: false });
    assert.deepEqual(calls[0], ['rect', 220, 190, 200, 100, 12]);
    calls.length = 0;
    drawFrame(canvas, '0.00', { ...settings, includeShape: false });
    assert.deepEqual(calls, []);
    const bounds = drawFrame(canvas, '0.00', { ...settings, shapeWidth: 1000 });
    assert.ok(bounds.width > canvas.width, 'oversize shapes are reported for cropping warnings');
});

test('common FPS values include exact fractional MOV time bases', async () => {
    for (const value of ['23.976', '24', '25', '29.97', '30', '48', '50', '59.94', '60', '120']) {
        const rate = frameRate(value);
        const data = Buffer.from(await makeMov([new Blob(['sample'])], 64, 64, value).arrayBuffer());
        const mvhd = data.indexOf('mvhd') - 4;
        const stts = data.indexOf('stts') - 4;
        assert.equal(data.readUInt32BE(mvhd + 20), rate.numerator);
        assert.equal(data.readUInt32BE(mvhd + 24), rate.denominator);
        assert.equal(data.readUInt32BE(stts + 20), rate.denominator);
    }
    assert.equal(frameRate('29.97').fps, 30000 / 1001);
    assert.throws(() => frameRate('0'));
});

test('ten-minute 120 fps MOV does not overflow argument limits', () => {
    assert.ok(makeMov(Array(72001).fill(new Blob(['x'])), 64, 64, 120).size > 72001);
});

test('MP4 detects support, returns the correct MIME, and cleans up on success and cancellation', async () => {
    const original = global.MediaRecorder;
    let stoppedTracks = 0;
    let capturedFps;
    const canvas = { captureStream(fps) {
        capturedFps = fps;
        return { getTracks: () => [{ stop() { stoppedTracks++; } }] };
    } };
    try {
        global.MediaRecorder = undefined;
        assert.equal(mp4MimeType(), null);
        await assert.rejects(recordMp4(canvas, {}), /not supported/);
        global.MediaRecorder = class {
            static isTypeSupported(type) { return type === 'video/mp4' || type === 'video/mp4;codecs=avc1'; }
            state = 'inactive';
            start() { this.state = 'recording'; }
            stop() {
                this.state = 'inactive';
                queueMicrotask(() => {
                    this.ondataavailable({ data: new Blob(['test encoded bytes']) });
                    this.onstop();
                });
            }
        };
        assert.equal(mp4MimeType(), 'video/mp4;codecs=avc1');
        let draws = 0;
        const options = { fps: 60, duration: 0.001, draw: () => draws++, isCancelled: () => false, onProgress() {} };
        const movie = await recordMp4(canvas, options);
        assert.equal(movie.type, 'video/mp4');
        assert.ok(movie.size > 0);
        assert.ok(draws >= 2);
        assert.equal(capturedFps, 60);
        assert.equal(stoppedTracks, 1);
        await assert.rejects(recordMp4(canvas, { ...options, isCancelled: () => true }), /cancelled/);
        assert.equal(stoppedTracks, 2);
        global.MediaRecorder = class { static isTypeSupported(type) { return type === 'video/mp4'; } };
        assert.equal(mp4MimeType(), null, 'generic MP4 support must not silently select VP9');
        global.MediaRecorder = class {
            static isTypeSupported() { return true; }
            constructor() { throw new Error('Encoder unavailable'); }
        };
        await assert.rejects(recordMp4(canvas, options), /Encoder unavailable/);
        assert.equal(stoppedTracks, 3);
    } finally {
        global.MediaRecorder = original;
    }
});

test('MOV conversion sends contiguous bytes and retries an interrupted transfer', async () => {
    const { convertMov } = require('./video-export.js');
    const input = new Blob(['frame1', 'frame2']);
    const output = new Blob(['converted'], { type: 'video/quicktime' });
    let calls = 0;
    const result = await convertMov(input, new AbortController().signal, async (url, options) => {
        assert.equal(url, '/api/mov');
        assert.ok(options.body instanceof ArrayBuffer);
        assert.equal(new TextDecoder().decode(options.body), 'frame1frame2');
        calls++;
        if (calls === 1) throw new TypeError('Failed to fetch');
        return { ok: true, blob: async () => output };
    });
    assert.equal(calls, 2);
    assert.equal(result, output);
});

test('MOV conversion reports errors and respects cancellation', async () => {
    const { convertMov } = require('./video-export.js');
    const input = new Blob(['frames']);
    const controller = new AbortController();
    await assert.rejects(convertMov(input, controller.signal, async () => {
        throw new TypeError('Failed to fetch');
    }), /connection.*interrupted/);
    await assert.rejects(convertMov(input, controller.signal, async () => ({
        ok: false, json: async () => ({ error: 'Encoder failed' })
    })), /Encoder failed/);
    controller.abort();
    await assert.rejects(convertMov(input, controller.signal, async () => {
        assert.fail('Cancelled exports must not upload');
    }), /cancelled/);
});

test('end hold controls export length independently of timer speed', () => {
    const { exportTiming } = require('./video-export.js');
    for (const fps of [24, 30, 60, 30000 / 1001]) {
        for (const hold of [0, 0.1, 1, 5, 60]) {
            const { duration, count } = exportTiming(2, 6250, 2, hold, fps);
            const firstFinal = Math.ceil((2 + 6.25 / 2) * fps);
            assert.equal(count - firstFinal, Math.max(1, Math.ceil(hold * fps)));
            assert.equal(duration, count / fps);
            assert.equal(frameTime(count - 1, fps, 2, 6250, 2), 6250);
        }
    }
    assert.equal(exportTiming(0, 0, 1, 0, 30).count, 1);
});

test('splits reveal at elapsed milestones and reserve stable space below the main timer', () => {
    const calls = [];
    const ctx = {
        measureText: () => ({ width: 10, fontBoundingBoxAscent: 15, fontBoundingBoxDescent: 5 }),
        clearRect() {}, beginPath() {}, setLineDash() {}, strokeText() {}, save() {}, restore() {},
        roundRect: (...args) => calls.push(['rect', ...args]),
        fill() {}, fillText: (...args) => calls.push(['text', ...args])
    };
    const canvas = { width: 640, height: 480, getContext: () => ctx };
    const settings = {
        font: '20px sans-serif', size: 20, lineHeight: 24, padding: { top: 0, right: 0, bottom: 0, left: 0 },
        includeShape: true, custom: true, shapeWidth: 200, shapeHeight: 100, radius: 12,
        borderStyle: 'none', background: '#000', colour: '#f00', stroke: 0,
        splits: [{ name: 'Cross', time: 0 }, { name: 'F2L', time: 1500 }], stopTime: 5500, splitsBackground: true
    };
    const before = drawFrame(canvas, '1', { ...settings, elapsed: 1499 });
    const geometry = calls.filter(c => c[0] === 'rect');
    assert.equal(calls.filter(c => c[1] === '—').length, 2);
    calls.length = 0;
    const after = drawFrame(canvas, '1', { ...settings, elapsed: 1500 });
    assert.deepEqual(before, after);
    assert.deepEqual(calls.filter(c => c[0] === 'rect'), geometry);
    assert.ok(calls.some(c => c[1] === '1.50'));
    assert.equal(calls.filter(c => c[1] === '—').length, 1);
    assert.ok(geometry[1][2] > geometry[0][2] + geometry[0][4]);
    calls.length = 0;
    drawFrame(canvas, '4', { ...settings, elapsed: 5500, splitsBackground: false });
    assert.equal(calls.filter(c => c[0] === 'rect').length, 1);
    assert.ok(calls.some(c => c[1] === '4.00'));
    const styled = [];
    ctx.fillText = function(text) { styled.push({ text, font: this.font, colour: this.fillStyle, opacity: this.globalAlpha }); };
    const larger = drawFrame(canvas, '4', { ...settings, elapsed: 4000,
        splitText: { size: 40, font: 'italic 700 40px Georgia', colour: '#00ff00', opacity: .6 }
    });
    assert.deepEqual(styled.find(item => item.text === 'Cross'), {
        text: 'Cross', font: 'italic 700 40px Georgia', colour: '#00ff00', opacity: .6
    });
    assert.ok(larger.height > after.height, 'split font size expands the panel and fit bounds');
    for (const elapsed of [0, 1500, 4000]) {
        for (const opacity of [1, .4, 0]) {
            styled.length = 0;
            drawFrame(canvas, '0', { ...settings, elapsed,
                splitText: { size: 22, font: '22px Arial', colour: '#000000', opacity }
            });
            for (const name of ['Cross', 'F2L']) {
                const label = styled.find(item => item.text === name);
                assert.equal(label.colour, '#000000');
                assert.equal(label.opacity, opacity, 'pending and completed splits respect selected opacity');
            }
        }
    }
});

test('split timestamps are starts, with per-segment durations and a final stop boundary', () => {
    const { splitTimeLabels } = require('./video-export.js');
    const splits = [{ time: 0 }, { time: 9370 }];
    assert.deepEqual(splitTimeLabels(splits, 0, true, 15000), ['0.00', '—']);
    assert.deepEqual(splitTimeLabels(splits, 1234, true, 15000), ['1.23', '—']);
    assert.deepEqual(splitTimeLabels(splits, 9370, true, 15000), ['9.37', '0.00']);
    assert.deepEqual(splitTimeLabels(splits, 10000, true, 15000), ['9.37', '0.63']);
    assert.deepEqual(splitTimeLabels(splits, 18000, true, 15000), ['9.37', '5.63']);
    assert.deepEqual(splitTimeLabels(splits, 9000, false, 15000), ['—', '—']);
    assert.deepEqual(splitTimeLabels(splits, 10000, false, 15000), ['9.37', '—']);
    assert.deepEqual(splitTimeLabels(splits, 15000, false, 15000), ['9.37', '5.63']);
    assert.deepEqual(splitTimeLabels([{ time: 2000 }, { time: 8000 }], 1000, true, 6000), ['—', '—']);
    assert.deepEqual(splitTimeLabels([{ time: 2000 }, { time: 8000 }], 6000, true, 6000), ['4.00', '—']);
    assert.deepEqual(splitTimeLabels([{ time: 0 }, { time: 0 }], 0, true, 6000), ['0.00', '0.00']);
    assert.notDeepEqual(splitTimeLabels(splits, 1100, true, 15000), splitTimeLabels(splits, 1200, true, 15000));
});
