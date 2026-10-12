/* Transparent PNG samples in a QuickTime MOV container. No server or encoder download.
 * Layout: https://developer.apple.com/documentation/quicktime-file-format
 */
const TimerVideo = (() => {
    const bytes = (...parts) => {
        const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
        let offset = 0;
        for (const part of parts) { result.set(part, offset); offset += part.length; }
        return result;
    };
    const text = value => new TextEncoder().encode(value);
    const u32 = value => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, value); return b; };
    const u16 = value => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, value); return b; };
    const u32Table = values => {
        const result = new Uint8Array(values.length * 4);
        const view = new DataView(result.buffer);
        values.forEach((value, index) => view.setUint32(index * 4, value));
        return result;
    };
    const zeros = length => new Uint8Array(length);
    const atom = (name, ...parts) => {
        const data = bytes(...parts);
        return bytes(u32(data.length + 8), text(name), data);
    };
    const full = (name, ...parts) => atom(name, u32(0), ...parts);
    const matrix = bytes(u32(65536), u32(0), u32(0), u32(0), u32(65536), u32(0), u32(0), u32(0), u32(1073741824));

    function frameRate(value) {
        const fractional = { '23.976': [24000, 1001], '29.97': [30000, 1001], '59.94': [60000, 1001] };
        const [numerator, denominator] = fractional[String(value)] || [Number(value), 1];
        if (![24, 25, 30, 48, 50, 60, 120].includes(numerator) && denominator === 1) throw new Error('Choose a supported frame rate.');
        return { numerator, denominator, fps: numerator / denominator };
    }

    function makeMov(frames, width, height, fps = 30) {
        const { numerator, denominator } = frameRate(fps);
        const sizes = frames.map(frame => frame.size);
        const total = sizes.reduce((a, b) => a + b, 0);
        if (!frames.length || total > 256 * 1024 * 1024) throw new Error('Export is too large. Reduce font size or video duration.');
        const ftyp = atom('ftyp', text('qt  '), u32(0), text('qt  '));
        const mvhd = full('mvhd', u32(0), u32(0), u32(numerator), u32(frames.length * denominator), u32(65536), u16(256), zeros(10), matrix, zeros(24), u32(2));
        const tkhd = atom('tkhd', u32(7), u32(0), u32(0), u32(1), u32(0), u32(frames.length * denominator), zeros(8), zeros(8), matrix, u32(width * 65536), u32(height * 65536));
        const mdhd = full('mdhd', u32(0), u32(0), u32(numerator), u32(frames.length * denominator), u16(0), u16(0));
        const hdlr = full('hdlr', text('mhlr'), text('vide'), zeros(12), new Uint8Array([5]), text('Video'));
        const compressor = bytes(new Uint8Array([3]), text('PNG'), zeros(28));
        const sample = atom('png ', zeros(6), u16(1), zeros(16), u16(width), u16(height), u32(72 * 65536), u32(72 * 65536), u32(0), u16(1), compressor, u16(32), u16(65535));
        let offset = ftyp.length + 8;
        const offsets = sizes.map(size => { const current = offset; offset += size; return current; });
        const stbl = atom('stbl',
            full('stsd', u32(1), sample),
            full('stts', u32(1), u32(frames.length), u32(denominator)),
            full('stsc', u32(1), u32(1), u32(1), u32(1)),
            full('stsz', u32(0), u32(frames.length), u32Table(sizes)),
            full('stco', u32(frames.length), u32Table(offsets)));
        const dinf = atom('dinf', full('dref', u32(1), atom('url ', u32(1))));
        const minf = atom('minf', atom('vmhd', u32(1), zeros(8)), dinf, stbl);
        const moov = atom('moov', mvhd, atom('trak', tkhd, atom('mdia', mdhd, hdlr, minf)));
        return new Blob([ftyp, u32(total + 8), text('mdat'), ...frames, moov], { type: 'video/quicktime' });
    }

    // Match the selected minimum format, expanding at 10 s / 1 min / 10 min / 1 h.
    function formatTime(milliseconds, formatIndex) {
        const ms = Math.max(0, Math.floor(milliseconds + 1e-7));
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor(ms / 60000) % 60;
        const seconds = Math.floor(ms / 1000) % 60;
        const minimum = Math.floor(formatIndex / 4);
        const precision = formatIndex % 4;
        let result;
        if (minimum >= 4 || hours > 0) {
            result = String(hours).padStart(minimum === 5 ? 2 : 1, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
        } else if (minimum >= 2 || minutes > 0) {
            result = String(minutes).padStart(minimum === 3 ? 2 : 1, '0') + ':' + String(seconds).padStart(2, '0');
        } else {
            result = String(seconds).padStart(minimum >= 1 ? 2 : 1, '0');
        }
        return result + (precision ? '.' + String(ms % 1000).padStart(3, '0').slice(0, precision) : '');
    }

    function frameTime(frame, fps, delay, stop, speed) {
        return Math.min(stop, Math.max(0, frame / fps - delay) * speed * 1000);
    }

    function exportTiming(delay, stop, speed, hold, fps) {
        const running = delay + stop / (speed * 1000);
        // Always include the exact final time, even when the hold is zero.
        const finalFrame = Math.ceil(running * fps);
        const count = finalFrame + Math.max(1, Math.ceil(hold * fps));
        return { duration: count / fps, count };
    }

    function lockedFrameSize(width, ratio) {
        const limited = Math.min(Math.min(4096, 4096 * ratio), Math.max(Math.max(64, 64 * ratio), width));
        return { width: Math.round(limited), height: Math.round(limited / ratio) };
    }

    // One renderer drives both the on-page frame preview and every exported frame.
    const textLayers = new WeakMap();
    function digitOffset(metrics, cellWidth) {
        return (cellWidth - metrics.actualBoundingBoxLeft - metrics.actualBoundingBoxRight) / 2 + metrics.actualBoundingBoxLeft;
    }
    function alignedDigitOffset(ctx, char, cellWidth, font) {
        // Center visible ink inside a fixed-width cell, including seven-segment 1.
        // Never shift the whole string: neighbouring digits and separators stay put.
        return digitOffset(ctx.measureText(char), cellWidth);
    }
    function splitTimeLabels(splits, elapsed, live, stop = Infinity) {
        const now = Math.min(elapsed, stop);
        return splits.map((split, index) => {
            const end = Math.min(splits[index + 1]?.time ?? stop, stop);
            if (now < split.time || split.time > stop) return '—';
            if (!live && now < end) return '—';
            return formatTime(Math.max(0, Math.min(now, end) - split.time), 2);
        });
    }

    function drawFrame(canvas, textValue, settings) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = settings.font;
        const digitWidth = ctx.measureText('0').width;
        const advance = char => /[0-9]/.test(char) ? digitWidth : ctx.measureText(char).width;
        const textWidth = [...textValue].reduce((sum, char) => sum + advance(char), 0);
        const metrics = ctx.measureText('0123456789:.');
        const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent;
        const descent = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent;
        const lineHeight = settings.lineHeight || ascent + descent;
        const p = settings.padding;
        const border = settings.borderStyle === 'none' ? 0 : settings.borderWidth;
        const width = settings.custom ? settings.shapeWidth : textWidth + p.left + p.right + border * 2;
        const height = settings.custom ? settings.shapeHeight : lineHeight + p.top + p.bottom + border * 2;
        const splits = settings.splits || [];
        const splitSize = settings.splitText?.size ?? Math.max(14, Math.min(32, settings.size * .2));
        const splitRowHeight = Math.ceil(splitSize * 1.8);
        const splitGap = splits.length ? Math.ceil(splitSize * .7) : 0;
        const splitHeight = splits.length ? splitRowHeight * splits.length + 20 : 0;
        const splitWidth = Math.max(width, splitSize * 17);
        const left = (canvas.width - width) / 2;
        const top = (canvas.height - height - splitGap - splitHeight) / 2;
        function path(inset) {
            const w = Math.max(0, width - inset * 2);
            const h = Math.max(0, height - inset * 2);
            ctx.beginPath();
            if (settings.oval) ctx.ellipse(left + width / 2, top + height / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
            else ctx.roundRect(left + inset, top + inset, w, h, Math.max(0, Math.min(settings.radius, width / 2, height / 2) - inset));
        }
        if (settings.includeShape) {
            path(0);
            ctx.fillStyle = settings.background;
            ctx.fill();
            if (border > 0) {
                ctx.strokeStyle = settings.borderColour;
                ctx.lineWidth = Math.min(border, width / 2, height / 2);
                const b = ctx.lineWidth;
                ctx.setLineDash(settings.borderStyle === 'dashed' ? [b * 3, b * 3] : settings.borderStyle === 'dotted' ? [0, b * 2] : []);
                ctx.lineCap = settings.borderStyle === 'dotted' ? 'round' : 'butt';
                if (settings.borderStyle === 'double' && b >= 3) {
                    ctx.lineWidth = b / 3;
                    path(b / 6); ctx.stroke();
                    path(b * 5 / 6); ctx.stroke();
                } else { path(b / 2); ctx.stroke(); }
                ctx.setLineDash([]);
            }
        }
        const textLeft = left + (width - textWidth + p.left - p.right) / 2;
        const baseline = top + (height - lineHeight + p.top - p.bottom) / 2 + (lineHeight - ascent - descent) / 2 + ascent;
        let x = textLeft;
        const opacity = settings.textOpacity ?? 1;
        let textContext = ctx;
        let layer;
        if (opacity < 1 || settings.reverse) {
            layer = textLayers.get(canvas);
            if (!layer) {
                layer = typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(canvas.width, canvas.height);
                textLayers.set(canvas, layer);
            }
            if (layer.width !== canvas.width) layer.width = canvas.width;
            if (layer.height !== canvas.height) layer.height = canvas.height;
            textContext = layer.getContext('2d');
            textContext.clearRect(0, 0, layer.width, layer.height);
            textContext.font = settings.font;
        }
        textContext.fillStyle = settings.colour;
        textContext.strokeStyle = settings.strokeColour;
        textContext.lineWidth = settings.stroke || 1;
        textContext.lineJoin = 'round';
        textContext.textBaseline = 'alphabetic';
        for (const char of textValue) {
            const offset = settings.balanceDigits && /[0-9]/.test(char) ? alignedDigitOffset(ctx, char, digitWidth, settings.font) : 0;
            textContext.fillText(char, x + offset, baseline);
            if (settings.stroke > 0) textContext.strokeText(char, x + offset, baseline);
            x += advance(char);
        }
        if (layer) {
            ctx.save();
            ctx.globalAlpha = opacity;
            if (settings.reverse) ctx.globalCompositeOperation = 'destination-out';
            ctx.drawImage(layer, 0, 0);
            ctx.restore();
        }
        if (splits.length) {
            const panelLeft = (canvas.width - splitWidth) / 2;
            const panelTop = top + height + splitGap;
            ctx.save();
            if (settings.splitsBackground) {
                ctx.beginPath();
                ctx.roundRect(panelLeft, panelTop, splitWidth, splitHeight, Math.min(12, splitSize / 2));
                ctx.fillStyle = settings.background;
                ctx.fill();
            }
            ctx.font = settings.splitText?.font || `500 ${splitSize}px Arial, sans-serif`;
            ctx.textBaseline = 'middle';
            ctx.fillStyle = settings.splitText?.colour || settings.colour;
            const labels = splitTimeLabels(splits, settings.elapsed ?? 0, settings.splitsLive, settings.stopTime);
            splits.forEach((split, index) => {
                const y = panelTop + 10 + splitRowHeight * (index + .5);
                ctx.globalAlpha = settings.splitText?.opacity ?? opacity;
                ctx.textAlign = 'left';
                ctx.fillText(split.name, panelLeft + 16, y, splitWidth * .58 - 24);
                ctx.textAlign = 'right';
                ctx.fillText(labels[index], panelLeft + splitWidth - 16, y, splitWidth * .4 - 16);
            });
            ctx.restore();
        }
        const inkMargin = settings.size * 0.3 + settings.stroke;
        const bounds = {
            width: Math.max(settings.includeShape ? width : 0, textWidth + Math.abs(p.left - p.right) + inkMargin * 2),
            height: Math.max(settings.includeShape ? height : 0, lineHeight + Math.abs(p.top - p.bottom) + inkMargin * 2)
        };
        if (splits.length) {
            bounds.width = Math.max(bounds.width, splitWidth);
            bounds.height += splitGap + splitHeight;
        }
        return bounds;
    }

    function mp4MimeType() {
        if (typeof MediaRecorder === 'undefined') return null;
        return ['video/mp4;codecs=avc1', 'video/mp4;codecs=avc1.420034', 'video/mp4;codecs=avc1.42E01E'].find(type => MediaRecorder.isTypeSupported(type)) || null;
    }

    function recordMp4(canvas, { fps, duration, draw, isCancelled, onProgress }) {
        return new Promise((resolve, reject) => {
            const mimeType = mp4MimeType();
            if (!mimeType || !canvas.captureStream) {
                reject(new Error('H.264 MP4 recording is not supported by this browser. Choose MOV or try another browser.'));
                return;
            }
            let stream, recorder, timer, settled = false;
            const chunks = [];
            let total = 0;
            const cleanup = () => {
                clearTimeout(timer);
                if (recorder && recorder.state !== 'inactive') recorder.stop();
                stream?.getTracks().forEach(track => track.stop());
            };
            const fail = error => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(error);
            };
            try {
                draw(0);
                stream = canvas.captureStream(fps);
                recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12000000 });
                recorder.ondataavailable = event => {
                    if (settled || !event.data.size) return;
                    chunks.push(event.data);
                    total += event.data.size;
                    if (total > 256 * 1024 * 1024) fail(new Error('Export exceeds 256 MB. Reduce video duration or dimensions.'));
                };
                recorder.onerror = () => fail(new Error('MP4 encoding failed. Try smaller, even-numbered dimensions or choose MOV.'));
                recorder.onstop = () => {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    if (!total) reject(new Error('The browser produced an empty MP4. Choose MOV or try another browser.'));
                    else resolve(new Blob(chunks, { type: 'video/mp4' }));
                };
                recorder.start(1000);
                const start = performance.now();
                const tick = () => {
                    if (settled) return;
                    if (isCancelled()) return fail(new Error('Export cancelled.'));
                    if (typeof document !== 'undefined' && document.hidden) return fail(new Error('MP4 recording stopped because the tab was hidden. Keep this tab visible while exporting, or use MOV.'));
                    const elapsed = (performance.now() - start) / 1000;
                    try {
                        draw(Math.floor(Math.min(elapsed, duration) * fps));
                        onProgress(Math.min(elapsed / duration, 1));
                        if (elapsed >= duration) { recorder.stop(); return; }
                        timer = setTimeout(tick, Math.max(1, 1000 / fps));
                    } catch (error) { fail(error); }
                };
                tick();
            } catch (error) { fail(error); }
        });
    }

    async function convertMov(intermediate, signal, request = fetch) {
        // Send contiguous bytes rather than a composite Blob backed by hundreds of
        // canvas blobs. This also gives retries an identical, reusable request body.
        const body = await intermediate.arrayBuffer();
        for (let attempt = 0; attempt < 2; attempt++) {
            if (signal.aborted) throw new Error('Export cancelled.');
            try {
                const response = await request('/api/mov', {
                    method: 'POST', headers: { 'Content-Type': 'video/quicktime' },
                    body, signal, cache: 'no-store'
                });
                if (!response.ok) {
                    const detail = await response.json().catch(() => ({}));
                    throw new Error(detail.error || `MOV conversion failed (HTTP ${response.status}). Check the server.py terminal.`);
                }
                const movie = await response.blob();
                if (!movie.size || !movie.type.startsWith('video/quicktime')) {
                    throw new Error('The server did not return a MOV video. Restart server.py and refresh this page.');
                }
                return movie;
            } catch (error) {
                if (signal.aborted) throw new Error('Export cancelled.');
                if (!(error instanceof TypeError)) throw error;
                if (attempt === 1) throw new Error('The connection to the MOV converter was interrupted. Keep server.py running, then retry. If it happens again, check its terminal for an error.');
            }
        }
    }

    return { splitTimeLabels, exportTiming, convertMov, makeMov, formatTime, frameTime, drawFrame, frameRate, mp4MimeType, recordMp4, lockedFrameSize, digitOffset, alignedDigitOffset };
})();

if (typeof module !== 'undefined') module.exports = TimerVideo;

if (typeof document !== 'undefined') {
    const button = document.getElementById('download-video');
    const cancel = document.getElementById('cancel-export');
    const progress = document.getElementById('export-progress');
    const status = document.getElementById('export-status');
    const download = document.getElementById('export-download');
    const preview = document.getElementById('video-preview');
    const reverseInput = document.getElementById('reverse-text');
    function syncReverseMode() {
        const include = document.getElementById('include-shape');
        if (reverseInput.checked) include.checked = true;
        include.disabled = reverseInput.checked;
    }
    reverseInput.addEventListener('change', syncReverseMode);
    syncReverseMode();
    const number = id => Number(document.getElementById(id).value);
    const videoWidthInput = document.getElementById('video-width');
    const videoHeightInput = document.getElementById('video-height');
    const videoRatioLock = document.getElementById('lock-video-ratio');
    let videoRatio = Number(window.TimerSettings?.state.videoRatio) || number('video-width') / number('video-height');
    window.TimerSettings?.registerState('videoRatio', () => videoRatio);
    videoRatioLock.addEventListener('change', () => {
        videoRatio = number('video-width') / number('video-height');
    });
    for (const input of [videoWidthInput, videoHeightInput]) {
        input.addEventListener('input', () => {
            if (videoRatioLock.checked) {
                const width = input === videoWidthInput ? Number(input.value) : Number(input.value) * videoRatio;
                const size = TimerVideo.lockedFrameSize(width, videoRatio);
                videoWidthInput.value = size.width;
                videoHeightInput.value = size.height;
            }
            schedulePreview();
        });
    }
    const stopTime = () => (number('stopTimerHours') * 3600 + number('stopTimerMinutes') * 60 + number('stopTimerSeconds')) * 1000;
    function snapshot() {
        const timer = document.getElementById('timer');
        const style = getComputedStyle(timer);
        // Layout dimensions exclude the sticky preview’s visual scale.
        const rect = { width: timer.offsetWidth, height: timer.offsetHeight };
        const oval = document.getElementById('background-shape').value === 'oval';
        return {
            font: `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
            size: parseFloat(style.fontSize), colour: style.color,
            lineHeight: timer.querySelector('#sec2').offsetHeight,
            stroke: number('text-stroke-width'), strokeColour: document.getElementById('text-stroke-colour').value,
            textOpacity: number('text-opacity') / 100,
            reverse: reverseInput.checked,
            splits: window.TimerSplits?.snapshot() || [],
            splitText: window.TimerSplits?.textStyle(),
            splitsBackground: document.getElementById('splits-background').checked,
            splitsLive: document.getElementById('splits-live').checked,
            elapsed: Number(timer.dataset.elapsed) || 0,
            stopTime: stopTime(),
            balanceDigits: document.getElementById('balance-digits').checked,
            includeShape: reverseInput.checked || document.getElementById('include-shape').checked,
            background: style.backgroundColor, oval,
            custom: oval || document.getElementById('custom-dimensions').checked,
            shapeWidth: rect.width, shapeHeight: rect.height,
            radius: number('corner-radius'), borderWidth: number('border-width'),
            borderStyle: document.getElementById('border-style').value,
            borderColour: document.getElementById('border-colour').value,
            padding: Object.fromEntries(['top', 'right', 'bottom', 'left'].map(side => [side, oval ? 0 : number(`padding-${side}`)]))
        };
    }
    function updatePreview() {
        preview.width = number('video-width');
        preview.height = number('video-height');
        for (const dimension of ['width', 'height']) updateNumberField(`video-${dimension}`, preview[dimension]);
        updateNumberField('end-hold', number('end-hold'));
        const settings = snapshot();
        // Shift glyphs inside fixed-width cells rather than resizing the cells.
        const measure = preview.getContext('2d');
        measure.font = settings.font;
        const cellWidth = measure.measureText('0').width;
        const spans = [...document.querySelectorAll('#timer > span')];
        const currentText = spans.filter(span => span.style.display !== 'none').map(span => span.textContent).join('');
        const shift = '0px';
        for (const span of spans) {
            if (span.style.position !== 'relative') span.style.position = 'relative';
            if (span.style.left !== shift) span.style.left = shift;
        }
        for (const digit of document.querySelectorAll('#timer > .digit')) {
            const offset = settings.balanceDigits ? TimerVideo.alignedDigitOffset(measure, digit.textContent, cellWidth, settings.font) : 0;
            const indent = `${offset}px`;
            const align = settings.balanceDigits ? 'left' : '';
            if (digit.style.textIndent !== indent) digit.style.textIndent = indent;
            if (digit.style.textAlign !== align) digit.style.textAlign = align;
        }
        const endText = TimerVideo.formatTime(Math.max(0, stopTime()), document.getElementById('timeformat').selectedIndex);
        const endBounds = TimerVideo.drawFrame(preview, endText, settings);
        const bounds = TimerVideo.drawFrame(preview, currentText, settings);
        const reversePreview = document.getElementById('reverse-preview');
        const canvasPreview = settings.reverse || settings.splits.length > 0;
        document.getElementById('timer-stage').classList.toggle('reverse-active', canvasPreview);
        reversePreview.hidden = !canvasPreview;
        if (canvasPreview) {
            reversePreview.width = Math.max(1, Math.ceil(settings.splits.length ? bounds.width : settings.shapeWidth));
            reversePreview.height = Math.max(1, Math.ceil(settings.splits.length ? bounds.height : settings.shapeHeight));
            TimerVideo.drawFrame(reversePreview, currentText, { ...settings, custom: true, includeShape: true });
            reversePreview.setAttribute('aria-label', `Timer ${currentText}${settings.reverse ? ", cut-out text" : ""}${settings.splits.length ? ", with splits" : ""}`);
        }
        document.getElementById('frame-warning').textContent = Math.max(bounds.width, endBounds.width) > preview.width || Math.max(bounds.height, endBounds.height) > preview.height
            ? 'The timer may be cropped by the video frame. Increase the video dimensions or choose Fit frame to timer.' : '';
    }
    let previewPending = false;
    function schedulePreview() {
        if (previewPending) return;
        previewPending = true;
        requestAnimationFrame(() => { previewPending = false; updatePreview(); });
    }
    document.addEventListener('splitstylechange', schedulePreview);
    document.addEventListener('input', schedulePreview);
    document.addEventListener('change', schedulePreview);
    document.addEventListener('click', schedulePreview);
    new MutationObserver(schedulePreview).observe(document.getElementById('timer'), { childList: true, subtree: true, attributes: true, characterData: true });
    document.fonts.ready.then(schedulePreview);
    document.fonts.addEventListener('loadingdone', schedulePreview);
    window.addEventListener('resize', schedulePreview);
    document.getElementById('fit-video').addEventListener('click', () => {
        const bounds = TimerVideo.drawFrame(preview, TimerVideo.formatTime(Math.max(0, stopTime()), document.getElementById('timeformat').selectedIndex), snapshot());
        const size = videoRatioLock.checked
            ? TimerVideo.lockedFrameSize(Math.max(bounds.width + 16, (bounds.height + 16) * videoRatio), videoRatio)
            : { width: Math.min(4096, Math.max(64, Math.ceil(bounds.width + 16))), height: Math.min(4096, Math.max(64, Math.ceil(bounds.height + 16))) };
        videoWidthInput.value = size.width;
        videoHeightInput.value = size.height;
        updatePreview();
    });
    schedulePreview();
    let cancelled = false;
    let conversionController;
    let downloadURL;
    cancel.addEventListener('click', () => { cancelled = true; conversionController?.abort(); });
    function updateFormatHelp() {
        const mp4 = document.getElementById('video-format').value === 'mp4';
        button.textContent = mp4 ? 'Download MP4' : 'Download MOV';
        document.getElementById('video-format-help').textContent = mp4
            ? (TimerVideo.mp4MimeType()
                ? 'H.264 MP4 does not support a transparent background; transparent areas become black. Recording takes the video’s duration: keep this tab visible. FPS is a target; the browser may drop frames. Use MOV for exact frame timing and a transparent background.'
                : 'This browser does not support H.264 MP4 recording. Choose MOV or try another browser.')
            : 'MOV exports ProRes 4444 with a transparent background and exact frame timing for QuickTime and video editors. Requires the local server: python3 server.py (with FFmpeg installed).';
    }
    document.getElementById('video-format').addEventListener('change', updateFormatHelp);
    updateFormatHelp();


    button.addEventListener('click', async () => {
        if (!window.TimerSplits?.validate()) {
            status.textContent = 'Enter a valid elapsed time for each split.';
            return;
        }
        const delay = number('delay');
        const hold = number('end-hold');
        const stop = (number('stopTimerHours') * 3600 + number('stopTimerMinutes') * 60 + number('stopTimerSeconds')) * 1000;
        const speed = number('speedmult');
        if (reverseInput.checked && document.getElementById('video-format').value === 'mp4') {
            status.textContent = 'Choose MOV for cut-out text. H.264 MP4 cannot preserve the transparent holes needed to show the video underneath.';
            return;
        }
        const requestedDuration = delay + stop / (speed * 1000) + hold;
        if (![delay, stop, speed, hold, requestedDuration].every(Number.isFinite) || delay < 0 || stop < 0 || speed <= 0 || hold < 0 || hold > 60 || requestedDuration > 600) {
            status.textContent = 'Choose a positive speed and nonnegative start delay, stop time and end hold, with a total video duration of at most 10 minutes.';
            return;
        }

        button.disabled = true;
        cancel.hidden = false;
        progress.hidden = false;
        progress.value = 0;
        cancelled = false;
        status.textContent = 'Loading the selected font…';
        download.hidden = true;
        if (downloadURL) { URL.revokeObjectURL(downloadURL); downloadURL = undefined; }
        try {
            // Snapshot styles so editing the page during export cannot change the video.
            const settings = snapshot();
            const videoWidth = number('video-width');
            const videoHeight = number('video-height');
            const formatIndex = document.getElementById('timeformat').selectedIndex;
            const fileFormat = document.getElementById('video-format').value;
            const rateValue = document.getElementById('video-fps').value;
            const { fps } = TimerVideo.frameRate(rateValue);
            const { duration, count } = TimerVideo.exportTiming(delay, stop, speed, hold, fps);
            if (fileFormat === 'mov') {
                let available = false;
                try {
                    const response = await fetch('/api/mov');
                    available = response.ok && (await response.json()).prores;
                } catch (_) { /* Static servers do not provide the converter. */ }
                if (!available) throw new Error('QuickTime MOV export requires the local converter. Run python3 server.py instead of python3 -m http.server, with FFmpeg or imageio-ffmpeg installed. See README for setup.');
            }
            if (cancelled) throw new Error('Export cancelled.');
            await document.fonts.load(settings.font, '0123456789:.');
            if (settings.splits.length) await document.fonts.load(settings.splitText.font, settings.splits.map(split => split.name).join(' ') + '0123456789:.');
            const canvas = document.createElement('canvas');
            canvas.width = videoWidth;
            canvas.height = videoHeight;
            let movie;
            if (fileFormat === 'mp4') {
                movie = await TimerVideo.recordMp4(canvas, {
                    fps, duration,
                    draw: frame => TimerVideo.drawFrame(canvas,
                        TimerVideo.formatTime(TimerVideo.frameTime(frame, fps, delay, stop, speed), formatIndex), { ...settings, elapsed: TimerVideo.frameTime(frame, fps, delay, stop, speed) }),
                    isCancelled: () => cancelled,
                    onProgress: value => {
                        progress.value = value;
                        status.textContent = `Recording MP4: ${Math.round(value * 100)}% — keep this tab visible`;
                    }
                });
            } else {
                const frames = [];
                let totalBytes = 0;
                let previousText;
                let png;
                for (let i = 0; i < count; i++) {
                    if (cancelled) throw new Error('Export cancelled.');
                    const elapsed = TimerVideo.frameTime(i, fps, delay, stop, speed);
                    const current = TimerVideo.formatTime(elapsed, formatIndex);
                    const frameKey = current + ':' + TimerVideo.splitTimeLabels(settings.splits, elapsed, settings.splitsLive, settings.stopTime).join('|');
                    if (frameKey !== previousText) {
                        TimerVideo.drawFrame(canvas, current, { ...settings, elapsed });
                        png = await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not render video frame.')), 'image/png'));
                        previousText = frameKey;
                    }
                    frames.push(png);
                    totalBytes += png.size;
                    if (totalBytes > 256 * 1024 * 1024) throw new Error('Export exceeds 256 MB. Reduce font size or duration.');
                    if (i % 15 === 0) {
                        progress.value = (i + 1) / count;
                        status.textContent = `Rendering video: ${Math.round(progress.value * 100)}%`;
                        await new Promise(resolve => setTimeout(resolve, 0));
                    }
                }
                if (cancelled) throw new Error('Export cancelled.');
                const intermediate = TimerVideo.makeMov(frames, canvas.width, canvas.height, rateValue);
                status.textContent = 'Encoding QuickTime MOV (ProRes 4444)…';
                progress.removeAttribute('value');
                conversionController = new AbortController();
                movie = await TimerVideo.convertMov(intermediate, conversionController.signal);
                if (cancelled) throw new Error('Export cancelled.');
            }
            downloadURL = URL.createObjectURL(movie);
            download.href = downloadURL;
            download.download = `timer.${fileFormat}`;
            download.textContent = `Save timer.${fileFormat}`;
            download.hidden = false;
            download.click();
            progress.value = 1;
            status.textContent = `Video ready (${(movie.size / 1024 / 1024).toFixed(1)} MB). If the download did not start, use Save timer.${fileFormat}.`;
        } catch (error) {
            status.textContent = cancelled ? 'Export cancelled.' : error.message || 'Video export failed. Please try again.';
        } finally {
            progress.hidden = true;
            conversionController = undefined;
            button.disabled = false;
            cancel.hidden = true;
        }
    });
}
