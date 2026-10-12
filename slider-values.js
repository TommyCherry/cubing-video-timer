// The range remains the source of truth, including linked dimensions and saved settings.
document.querySelectorAll('.slider-value').forEach(field => {
    const slider = document.getElementById(field.dataset.slider);
    let edited = false;
    function sync() {
        if (document.activeElement !== field) field.value = Number(Number(slider.value).toFixed(6));
        field.disabled = slider.disabled;
    }
    // Keep every slider pair synchronized, including restored and newly added controls.
    slider.addEventListener('input', sync);
    slider.addEventListener('change', sync);
    sync();
    function apply() {
        slider.value = field.value;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
    }
    field.addEventListener('focus', () => { edited = false; field.select(); });
    field.addEventListener('input', () => {
        edited = true;
        // Keep incomplete or out-of-range typing intact until the user finishes.
        if (field.value !== '' && field.validity.valid) apply();
    });
    field.addEventListener('blur', () => {
        if (edited && field.value !== '' && Number.isFinite(Number(field.value))) apply();
        // The range clamps limits and snaps to its step. Reflect the resulting value.
        field.value = Number(Number(slider.value).toFixed(6));
        edited = false;
    });
    field.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            field.blur();
        }
    });
});
