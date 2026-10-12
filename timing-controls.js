// Numeric timing fields remain canonical so existing settings and presets still work.
(() => {
    document.querySelectorAll('[data-timing]').forEach(slider => {
        const field = document.getElementById(slider.dataset.timing);
        const initialMax = Number(slider.max);
        function sync() {
            const value = Number(field.value);
            if (!Number.isFinite(value)) return;
            // Manual values can extend the slider's range without losing precision.
            slider.max = Math.max(initialMax, Math.ceil(value));
            slider.value = value;
            slider.setAttribute('aria-valuetext', `${value}${slider.dataset.timing === 'delay' ? ' seconds' : ' times'}`);
        }
        slider.addEventListener('input', () => {
            field.value = slider.value;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
        });
        field.addEventListener('input', sync);
        field.addEventListener('change', sync);
        sync();
    });
})();
