// Scale only the on-page view. The timer's layout dimensions remain available to export.
(() => {
    const timer = document.getElementById('timer');
    const stage = document.getElementById('timer-stage');
    let pending = false;
    function fit() {
        pending = false;
        const canvas = document.getElementById('reverse-preview');
        const width = canvas.hidden ? timer.offsetWidth : canvas.width;
        const height = canvas.hidden ? timer.offsetHeight : canvas.height;
        if (!width || !height) return;
        const availableWidth = Math.max(1, stage.clientWidth - 32);
        const availableHeight = Math.max(48, Math.min(260, window.innerHeight * 0.28));
        const scale = Math.min(1, availableWidth / width, availableHeight / height);
        stage.style.setProperty('--preview-scale', String(scale));
        stage.style.height = `${Math.ceil(height * scale)}px`;
    }
    function schedule() {
        if (pending) return;
        pending = true;
        requestAnimationFrame(fit);
    }
    new ResizeObserver(schedule).observe(timer);
    new MutationObserver(schedule).observe(document.getElementById('reverse-preview'), { attributes: true });
    window.addEventListener('resize', schedule);
    document.fonts.ready.then(schedule);
    fit();
})();
