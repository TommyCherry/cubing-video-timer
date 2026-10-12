const timer = document.getElementById('timer');
const startButton = document.getElementById('start');
const stopButton = document.getElementById('stop');
const resetButton = document.getElementById('reset');

// controls
const delayInput = document.getElementById('delay');
const stopInputHours = document.getElementById('stopTimerHours');
const stopInputMinutes = document.getElementById('stopTimerMinutes');
const stopInputSeconds = document.getElementById('stopTimerSeconds');
const speedInput = document.getElementById('speedmult');
const formatSelector = document.getElementById('timeformat');
const textColourInput = document.getElementById('textcolour');
const bgColourInput = document.getElementById('bgcolour');
const timerFontInput = document.getElementById('font-picker');

const backgroundShapeInput = document.getElementById('background-shape');
const customDimensionsInput = document.getElementById('custom-dimensions');
const shapeWidthInput = document.getElementById('shape-width');
const shapeHeightInput = document.getElementById('shape-height');
const lockAspectRatioInput = document.getElementById('lock-aspect-ratio');
let lockedAspectRatio = Number(window.TimerSettings?.state.shapeRatio) || Number(shapeWidthInput.value) / Number(shapeHeightInput.value);

function updateNumberField(id, value) {
    const field = document.getElementById(`${id}-value`);
    if (document.activeElement !== field) field.value = Number(Number(value).toFixed(6));
    field.disabled = document.getElementById(id).disabled;
}

function updateSliderValues() {
    for (const id of ['shape-width', 'shape-height', 'corner-radius', 'border-width',
        'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'font-size', 'text-stroke-width']) {
        const input = document.getElementById(id);
        updateNumberField(id, input.value);
    }
}

const cornerRadiusInput = document.getElementById('corner-radius');

function updateCornerRadius() {
    const value = Number(cornerRadiusInput.value);
    const radius = Number.isFinite(value) ? Math.min(2000, Math.max(0, value)) : 0;
    timer.style.borderRadius = backgroundShapeInput.value === 'oval' ? '50%' : `${radius}px`;
    updateSliderValues();
}

cornerRadiusInput.addEventListener('input', updateCornerRadius);
cornerRadiusInput.addEventListener('change', () => {
    updateCornerRadius();
    const value = Number(cornerRadiusInput.value);
    cornerRadiusInput.value = Number.isFinite(value) ? Math.min(2000, Math.max(0, value)) : 0;
});
updateCornerRadius();

const borderStyleInput = document.getElementById('border-style');
const borderColourInput = document.getElementById('border-colour');
const borderWidthInput = document.getElementById('border-width');

function updateTimerBorder() {
    const value = Number(borderWidthInput.value);
    const width = Number.isFinite(value) ? Math.min(2000, Math.max(0, value)) : 0;
    timer.style.borderStyle = borderStyleInput.value;
    timer.style.borderColor = borderColourInput.value;
    timer.style.borderWidth = `${width}px`;
    updateSliderValues();
}

borderStyleInput.addEventListener('change', updateTimerBorder);
borderColourInput.addEventListener('input', updateTimerBorder);
borderWidthInput.addEventListener('input', updateTimerBorder);
borderWidthInput.addEventListener('change', () => {
    updateTimerBorder();
    borderWidthInput.value = parseFloat(timer.style.borderWidth);
});
updateTimerBorder();

// Only visible digits occupy space; padding controls the background on each side.
const paddingInputs = Object.fromEntries(
    ['top', 'right', 'bottom', 'left'].map(side => [
        side, document.getElementById(`padding-${side}`)
    ])
);

const lockSpacingRatioInput = document.getElementById('lock-spacing-ratio');
let spacingProportions;
function captureSpacingProportions() {
    spacingProportions = Object.fromEntries(Object.entries(paddingInputs).map(([side, input]) => [side, Number(input.value)]));
    // An all-zero starting point grows equally in each direction.
    if (Object.values(spacingProportions).every(value => value === 0)) {
        for (const side in spacingProportions) spacingProportions[side] = 1;
    }
    for (const [side, input] of Object.entries(paddingInputs)) {
        input.disabled = lockSpacingRatioInput.checked && spacingProportions[side] === 0;
        updateNumberField(input.id, input.value);
    }
}
lockSpacingRatioInput.addEventListener('change', captureSpacingProportions);
captureSpacingProportions();
const savedSpacing = window.TimerSettings?.state.spacingProportions;
if (savedSpacing && Object.keys(paddingInputs).every(side => Number.isFinite(savedSpacing[side]) && savedSpacing[side] >= 0)
    && Object.values(savedSpacing).some(value => value > 0)) {
    spacingProportions = savedSpacing;
    for (const [side, input] of Object.entries(paddingInputs)) input.disabled = lockSpacingRatioInput.checked && spacingProportions[side] === 0;
}

function updateBackgroundSpacing() {
    for (const [side, input] of Object.entries(paddingInputs)) {
        const value = Number(input.value);
        const padding = Number.isFinite(value) ? Math.min(2000, Math.max(0, value)) : 0;
        timer.style.setProperty(`padding-${side}`, backgroundShapeInput.value === 'oval' ? '0px' : `${padding}px`);
    }
    updateSliderValues();
}

for (const input of Object.values(paddingInputs)) {
    input.addEventListener('input', () => {
        if (lockSpacingRatioInput.checked) {
            const side = input.id.slice(8);
            const base = spacingProportions[side];
            if (base > 0) {
                const scale = Math.min(Number(input.value) / base, 2000 / Math.max(...Object.values(spacingProportions)));
                for (const [otherSide, otherInput] of Object.entries(paddingInputs)) {
                    otherInput.value = spacingProportions[otherSide] * scale;
                }
            }
        }
        updateBackgroundSpacing();
    });
    input.addEventListener('change', () => {
        input.value = parseFloat(timer.style.getPropertyValue(`padding-${input.id.slice(8)}`));
    });
}

document.getElementById('center-time').addEventListener('click', () => {
    for (const [first, second] of [['left', 'right'], ['top', 'bottom']]) {
        const average = (parseFloat(timer.style.getPropertyValue(`padding-${first}`)) +
            parseFloat(timer.style.getPropertyValue(`padding-${second}`))) / 2;
        paddingInputs[first].value = average;
        paddingInputs[second].value = average;
    }
    captureSpacingProportions();
    updateBackgroundSpacing();
});
updateBackgroundSpacing();

function updateBackgroundShape() {
    const oval = backgroundShapeInput.value === 'oval';
    timer.classList.toggle('oval', oval);
    const customSize = oval || customDimensionsInput.checked;
    customDimensionsInput.disabled = oval;
    timer.classList.toggle('custom-size', customSize);
    document.getElementById('background-spacing').disabled = oval;
    cornerRadiusInput.disabled = oval;
    for (const [dimension, input] of [['width', shapeWidthInput], ['height', shapeHeightInput]]) {
        const value = Number(input.value);
        const size = Number.isFinite(value) ? Math.min(4000, Math.max(1, value)) : 1;
        timer.style[dimension] = customSize ? `${size}px` : '';
    }
    updateCornerRadius();
    updateBackgroundSpacing();
}

backgroundShapeInput.addEventListener('change', updateBackgroundShape);
// Keep the settings in place while the timer above them changes height.
function updateDimensionsWithoutMovingControls() {
    const anchorTop = customDimensionsInput.getBoundingClientRect().top;
    document.body.style.paddingTop = '0px';
    updateBackgroundShape();

    let targetScroll = window.scrollY +
        customDimensionsInput.getBoundingClientRect().top - anchorTop;
    if (targetScroll < 0) {
        // At the top of the page, retain room above the timer so shrinking it
        // can still leave the controls at their previous viewport position.
        document.body.style.paddingTop = `${-targetScroll}px`;
        targetScroll = 0;
    }
    window.scrollTo({ top: targetScroll, left: window.scrollX, behavior: 'instant' });
}

customDimensionsInput.addEventListener('change', updateDimensionsWithoutMovingControls);
function clampDimension(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(4000, Math.max(1, number)) : 1;
}

lockAspectRatioInput.addEventListener('change', () => {
    if (lockAspectRatioInput.checked) {
        shapeWidthInput.value = clampDimension(shapeWidthInput.value);
        shapeHeightInput.value = clampDimension(shapeHeightInput.value);
        lockedAspectRatio = Number(shapeWidthInput.value) / Number(shapeHeightInput.value);
    }
});

function resizeBackground(input) {
    customDimensionsInput.checked = true;
    if (lockAspectRatioInput.checked) {
        // Clamp the pair together so neither limit breaks the captured ratio.
        const width = input === shapeWidthInput
            ? clampDimension(input.value)
            : clampDimension(input.value) * lockedAspectRatio;
        const limitedWidth = Math.min(Math.min(4000, 4000 * lockedAspectRatio),
            Math.max(Math.max(1, lockedAspectRatio), width));
        shapeWidthInput.value = limitedWidth;
        shapeHeightInput.value = limitedWidth / lockedAspectRatio;
    }
    updateBackgroundShape();
}

for (const input of [shapeWidthInput, shapeHeightInput]) {
    input.addEventListener('input', () => {
        // Allow an empty field while typing; normalize it when editing finishes.
        if (input.value !== '' && Number.isFinite(Number(input.value))) {
            resizeBackground(input);
        }
    });
    input.addEventListener('change', () => {
        input.value = clampDimension(input.value);
        resizeBackground(input);
    });
}
updateBackgroundShape();

// timer digits/separators
const hour1 = document.getElementById('hour1');
const hour2 = document.getElementById('hour2');
const hmSep = document.getElementById('hmSep');
const min1 = document.getElementById('min1');
const min2 = document.getElementById('min2');
const msSep = document.getElementById('msSep');
const sec1 = document.getElementById('sec1');
const sec2 = document.getElementById('sec2');
const secDecimalSep = document.getElementById('secDecimalSep');
const ds = document.getElementById('ds');
const cs = document.getElementById('cs');
const ms = document.getElementById('ms');

let delayTimerInterval;
let timerInterval;

let hours = 0;
let minutes = 0;
let seconds = 0;
let mseconds = 0;

let startDelayTime = 0;
let elapsedDelayTime = 0;
let startTime = 0;
let elapsedTime = 0;

// milliseconds at which more timer digits will need to be shown, given current format chosen
let increaseDigitThreshold = 60 * 1000;

let format;
updateTimeFormat();     // set initial format from selector value

let delayTime;
updateDelay();     // set initial delay time from input value

let stopTime;
updateStopTime();     // set initial stop time from input values

let speedMultiplier;
updateSpeed();     // set initial speed multiplier from input value

function updateDelay(){
    resetTimer();
    delayTime = delayInput.value * 1000;
}

function updateStopTime(){
    resetTimer();
    stopTime = 
        stopInputHours.value * 60 * 60 * 1000 +
        stopInputMinutes.value * 60 * 1000 +
        stopInputSeconds.value * 1000;
}

function updateSpeed(){
    resetTimer();
    speedMultiplier = speedInput.value;
}

function updateTimeFormat(){
    format = formatSelector.selectedIndex;

    switch (format) {
        case 0:
            hour1.style.display = "none";
            hour2.style.display = "none";
            hmSep.style.display = "none";
            min1.style.display = "none";
            min2.style.display = "none";
            msSep.style.display = "none";
            sec1.style.display = "none";
            sec2.style.display = "block";
            secDecimalSep.style.display = "none";
            ds.style.display = "none";
            cs.style.display = "none";
            ms.style.display = "none";

            increaseDigitThreshold = 10 * 1000;
            break;
        
        case 1:
            hour1.style.display = "none";
            hour2.style.display = "none";
            hmSep.style.display = "none";
            min1.style.display = "none";
            min2.style.display = "none";
            msSep.style.display = "none";
            sec1.style.display = "none";
            sec2.style.display = "block";
            secDecimalSep.style.display = "block";
            ds.style.display = "block";
            cs.style.display = "none";
            ms.style.display = "none";

            increaseDigitThreshold = 10 * 1000;
            break;
        
        case 2:
            hour1.style.display = "none";
            hour2.style.display = "none";
            hmSep.style.display = "none";
            min1.style.display = "none";
            min2.style.display = "none";
            msSep.style.display = "none";
            sec1.style.display = "none";
            sec2.style.display = "block";
            secDecimalSep.style.display = "block";
            ds.style.display = "block";
            cs.style.display = "block";
            ms.style.display = "none";

            increaseDigitThreshold = 10 * 1000;
            break;
        
        case 3:
            hour1.style.display = "none";
            hour2.style.display = "none";
            hmSep.style.display = "none";
            min1.style.display = "none";
            min2.style.display = "none";
            msSep.style.display = "none";
            sec1.style.display = "none";
            sec2.style.display = "block";
            secDecimalSep.style.display = "block";
            ds.style.display = "block";
            cs.style.display = "block";
            ms.style.display = "block";

            increaseDigitThreshold = 10 * 1000;
            break;
        
        case 4:
            hour1.style.display = "none";
            hour2.style.display = "none";
            hmSep.style.display = "none";
            min1.style.display = "none";
            min2.style.display = "none";
            msSep.style.display = "none";
            sec1.style.display = "block";
            sec2.style.display = "block";
            secDecimalSep.style.display = "none";
            ds.style.display = "none";
            cs.style.display = "none";
            ms.style.display = "none";

            increaseDigitThreshold = 60 * 1000;
            break;
        
        case 5:
            hour1.style.display = "none";
            hour2.style.display = "none";
            hmSep.style.display = "none";
            min1.style.display = "none";
            min2.style.display = "none";
            msSep.style.display = "none";
            sec1.style.display = "block";
            sec2.style.display = "block";
            secDecimalSep.style.display = "block";
            ds.style.display = "block";
            cs.style.display = "none";
            ms.style.display = "none";

            increaseDigitThreshold = 60 * 1000;
            break;
        
        case 6:
            hour1.style.display = "none";
            hour2.style.display = "none";
            hmSep.style.display = "none";
            min1.style.display = "none";
            min2.style.display = "none";
            msSep.style.display = "none";
            sec1.style.display = "block";
            sec2.style.display = "block";
            secDecimalSep.style.display = "block";
            ds.style.display = "block";
            cs.style.display = "block";
            ms.style.display = "none";

            increaseDigitThreshold = 60 * 1000;
            break;
        
        case 7:
            hour1.style.display = "none";
            hour2.style.display = "none";
            hmSep.style.display = "none";
            min1.style.display = "none";
            min2.style.display = "none";
            msSep.style.display = "none";
            sec1.style.display = "block";
            sec2.style.display = "block";
            secDecimalSep.style.display = "block";
            ds.style.display = "block";
            cs.style.display = "block";
            ms.style.display = "block";

            increaseDigitThreshold = 60 * 1000;
            break;

        case 8:
            hour1.style.display = "none";
            hour2.style.display = "none";
            hmSep.style.display = "none";
            min1.style.display = "none";
            min2.style.display = "block";
            msSep.style.display = "block";
            sec1.style.display = "block";
            sec2.style.display = "block";
            secDecimalSep.style.display = "none";
            ds.style.display = "none";
            cs.style.display = "none";
            ms.style.display = "none";

            increaseDigitThreshold = 10 * 60 * 1000;
            break;
        
        case 9:
            hour1.style.display = "none";
            hour2.style.display = "none";
            hmSep.style.display = "none";
            min1.style.display = "none";
            min2.style.display = "block";
            msSep.style.display = "block";
            sec1.style.display = "block";
            sec2.style.display = "block";
            secDecimalSep.style.display = "block";
            ds.style.display = "block";
            cs.style.display = "none";
            ms.style.display = "none";

            increaseDigitThreshold = 10 * 60 * 1000;
            break;
        
        case 10:
            hour1.style.display = "none";
            hour2.style.display = "none";
            hmSep.style.display = "none";
            min1.style.display = "none";
            min2.style.display = "block";
            msSep.style.display = "block";
            sec1.style.display = "block";
            sec2.style.display = "block";
            secDecimalSep.style.display = "block";
            ds.style.display = "block";
            cs.style.display = "block";
            ms.style.display = "none";

            increaseDigitThreshold = 10 * 60 * 1000;
            break;
        
        case 11:
            hour1.style.display = "none";
            hour2.style.display = "none";
            hmSep.style.display = "none";
            min1.style.display = "none";
            min2.style.display = "block";
            msSep.style.display = "block";
            sec1.style.display = "block";
            sec2.style.display = "block";
            secDecimalSep.style.display = "block";
            ds.style.display = "block";
            cs.style.display = "block";
            ms.style.display = "block";

            increaseDigitThreshold = 10 * 60 * 1000;
            break;

        case 12:
            hour1.style.display = "none";
            hour2.style.display = "none";
            hmSep.style.display = "none";
            min1.style.display = "block";
            min2.style.display = "block";
            msSep.style.display = "block";
            sec1.style.display = "block";
            sec2.style.display = "block";
            secDecimalSep.style.display = "none";
            ds.style.display = "none";
            cs.style.display = "none";
            ms.style.display = "none";

            increaseDigitThreshold = 60 * 60 * 1000;
            break;
        
        case 13:
            hour1.style.display = "none";
            hour2.style.display = "none";
            hmSep.style.display = "none";
            min1.style.display = "block";
            min2.style.display = "block";
            msSep.style.display = "block";
            sec1.style.display = "block";
            sec2.style.display = "block";
            secDecimalSep.style.display = "block";
            ds.style.display = "block";
            cs.style.display = "none";
            ms.style.display = "none";

            increaseDigitThreshold = 60 * 60 * 1000;
            break;
        
        case 14:
            hour1.style.display = "none";
            hour2.style.display = "none";
            hmSep.style.display = "none";
            min1.style.display = "block";
            min2.style.display = "block";
            msSep.style.display = "block";
            sec1.style.display = "block";
            sec2.style.display = "block";
            secDecimalSep.style.display = "block";
            ds.style.display = "block";
            cs.style.display = "block";
            ms.style.display = "none";

            increaseDigitThreshold = 60 * 60 * 1000;
            break;
        
        case 15:
            hour1.style.display = "none";
            hour2.style.display = "none";
            hmSep.style.display = "none";
            min1.style.display = "block";
            min2.style.display = "block";
            msSep.style.display = "block";
            sec1.style.display = "block";
            sec2.style.display = "block";
            secDecimalSep.style.display = "block";
            ds.style.display = "block";
            cs.style.display = "block";
            ms.style.display = "block";

            increaseDigitThreshold = 60 * 60 * 1000;
            break;

        case 16:
            hour1.style.display = "none";
            hour2.style.display = "block";
            hmSep.style.display = "block";
            min1.style.display = "block";
            min2.style.display = "block";
            msSep.style.display = "block";
            sec1.style.display = "block";
            sec2.style.display = "block";
            secDecimalSep.style.display = "none";
            ds.style.display = "none";
            cs.style.display = "none";
            ms.style.display = "none";

            increaseDigitThreshold = 10 * 60 * 60 * 1000;
            break;
        
        case 17:
            hour1.style.display = "none";
            hour2.style.display = "block";
            hmSep.style.display = "block";
            min1.style.display = "block";
            min2.style.display = "block";
            msSep.style.display = "block";
            sec1.style.display = "block";
            sec2.style.display = "block";
            secDecimalSep.style.display = "block";
            ds.style.display = "block";
            cs.style.display = "none";
            ms.style.display = "none";

            increaseDigitThreshold = 10 * 60 * 60 * 1000;
            break;
        
        case 18:
            hour1.style.display = "none";
            hour2.style.display = "block";
            hmSep.style.display = "block";
            min1.style.display = "block";
            min2.style.display = "block";
            msSep.style.display = "block";
            sec1.style.display = "block";
            sec2.style.display = "block";
            secDecimalSep.style.display = "block";
            ds.style.display = "block";
            cs.style.display = "block";
            ms.style.display = "none";

            increaseDigitThreshold = 10 * 60 * 60 * 1000;
            break;
        
        case 19:
            hour1.style.display = "none";
            hour2.style.display = "block";
            hmSep.style.display = "block";
            min1.style.display = "block";
            min2.style.display = "block";
            msSep.style.display = "block";
            sec1.style.display = "block";
            sec2.style.display = "block";
            secDecimalSep.style.display = "block";
            ds.style.display = "block";
            cs.style.display = "block";
            ms.style.display = "block";

            increaseDigitThreshold = 10 * 60 * 60 * 1000;
            break;

        case 20:
            hour1.style.display = "block";
            hour2.style.display = "block";
            hmSep.style.display = "block";
            min1.style.display = "block";
            min2.style.display = "block";
            msSep.style.display = "block";
            sec1.style.display = "block";
            sec2.style.display = "block";
            secDecimalSep.style.display = "none";
            ds.style.display = "none";
            cs.style.display = "none";
            ms.style.display = "none";

            increaseDigitThreshold = Infinity;
            break;
        
        case 21:
            hour1.style.display = "block";
            hour2.style.display = "block";
            hmSep.style.display = "block";
            min1.style.display = "block";
            min2.style.display = "block";
            msSep.style.display = "block";
            sec1.style.display = "block";
            sec2.style.display = "block";
            secDecimalSep.style.display = "block";
            ds.style.display = "block";
            cs.style.display = "none";
            ms.style.display = "none";

            increaseDigitThreshold = Infinity;
            break;
        
        case 22:
            hour1.style.display = "block";
            hour2.style.display = "block";
            hmSep.style.display = "block";
            min1.style.display = "block";
            min2.style.display = "block";
            msSep.style.display = "block";
            sec1.style.display = "block";
            sec2.style.display = "block";
            secDecimalSep.style.display = "block";
            ds.style.display = "block";
            cs.style.display = "block";
            ms.style.display = "none";

            increaseDigitThreshold = Infinity;
            break;
        
        case 23:
            hour1.style.display = "block";
            hour2.style.display = "block";
            hmSep.style.display = "block";
            min1.style.display = "block";
            min2.style.display = "block";
            msSep.style.display = "block";
            sec1.style.display = "block";
            sec2.style.display = "block";
            secDecimalSep.style.display = "block";
            ds.style.display = "block";
            cs.style.display = "block";
            ms.style.display = "block";

            increaseDigitThreshold = Infinity;
            break;
    }
}

function startDelay(){
    startDelayTime = Date.now();

    delayTimerInterval = setInterval( ()=> {
        elapsedDelayTime = Date.now() - startDelayTime;
        if (elapsedDelayTime > delayTime) {
            clearInterval(delayTimerInterval);
            startTimer();
        }
    }, 10);

}

function startTimer(){
    startTime = Date.now() - elapsedTime;

    timerInterval = setInterval( ()=> {
        elapsedTime = (Date.now() - startTime) * speedMultiplier; 
        if (elapsedTime >= stopTime) {
            stopTimer();
            updateTimer(stopTime);
            startButton.disabled = true;
        } else {
            updateTimer(elapsedTime);
        }
    }, 1);

    startButton.disabled = true;
    stopButton.disabled = false;
}

function stopTimer(){
    clearInterval(timerInterval);
    startButton.disabled = false;
    stopButton.disabled = true;
}

function resetTimer(){
    clearInterval(timerInterval);

    elapsedTime = 0;
    timer.dataset.elapsed = "0";

    hour1.textContent = "0";
    hour2.textContent = "0";
    min1.textContent = "0";
    min2.textContent = "0";
    sec1.textContent = "0";
    sec2.textContent = "0";
    ds.textContent = "0";
    cs.textContent = "0";
    ms.textContent = "0";

    startButton.disabled = false;
    stopButton.disabled = false;

    updateTimeFormat();     // reset format in the case that extra digits have appeared as time increases
}

function updateTimer(elapsedTime){
    timer.dataset.elapsed = String(elapsedTime);
    hours = Math.floor(elapsedTime / (1000 * 60 * 60));
    minutes = Math.floor((elapsedTime % (1000 * 60 * 60)) / (1000 * 60));
    seconds = Math.floor((elapsedTime % (1000 * 60)) / 1000);
    mseconds = Math.floor((elapsedTime % 1000));

    // update values of each digit
    hour1.textContent = Math.floor(hours / 10);
    hour2.textContent = hours % 10;
    min1.textContent = Math.floor(minutes / 10);
    min2.textContent = minutes % 10;
    sec1.textContent = Math.floor(seconds / 10);
    sec2.textContent = seconds % 10;
    ds.textContent = Math.floor(mseconds / 100);
    cs.textContent = Math.floor((mseconds % 100) / 10);
    ms.textContent = mseconds % 10;

    // display extra digits/separators if certain thresholds passed
    if (elapsedTime >= increaseDigitThreshold) {
        switch (increaseDigitThreshold) {
            case 10 * 1000:
                increaseDigitThreshold = 60 * 1000;
                sec1.style.display = "block";
                break;

            case 60 * 1000:
                increaseDigitThreshold = 10 * 60 * 1000;
                msSep.style.display = "block";
                min2.style.display = "block";
                break;
            
            case 10 * 60 * 1000:
                increaseDigitThreshold = 60 * 60 * 1000;
                min1.style.display = "block";
                break;

            case 60 * 60 * 1000:
                increaseDigitThreshold = 10 * 60 * 60 * 1000;
                hmSep.style.display = "block";
                hour2.style.display = "block";
                break;
            
            case 10 * 60 * 60 * 1000:
                increaseDigitThreshold = Infinity;
                hour1.style.display = "block";
                break;
        }
    }
}

startButton.addEventListener('click', startDelay);
stopButton.addEventListener('click', stopTimer);
resetButton.addEventListener('click', resetTimer);
delayInput.addEventListener('change', updateDelay);
stopInputHours.addEventListener('change', updateStopTime);
stopInputMinutes.addEventListener('change', updateStopTime);
stopInputSeconds.addEventListener('change', updateStopTime);
speedInput.addEventListener('change', updateSpeed);
formatSelector.addEventListener('change', updateTimeFormat);
textColourInput.addEventListener('input', () => {
    updateOpacity();
});
bgColourInput.addEventListener('input', () => {
    updateOpacity();
});
timerFontInput.addEventListener('input', () => {
    timer.style.fontFamily = `"${timerFontInput.value}"`;
});

// If the time format selector is changed to a TomSelect dropdown, the updateTimeFormat function will need to be updated to get the selected index/value from TomSelect instead of a regular select element. The event listener for the format selector will also need to be updated to listen for the 'change' event from TomSelect.
// new TomSelect('#timeformat', {});

function previewTimerFont(value) {
    // Tom Select may keep only the committed option in the native select.
    // Highlighted options must be checked against its complete font registry.
    const knownFont = timerFontInput.tomselect
        ? Object.prototype.hasOwnProperty.call(timerFontInput.tomselect.options, value)
        : [...timerFontInput.options].some(option => option.value === value);
    if (value && knownFont) {
        timer.style.fontFamily = `"${value}"`;
    }
}

if (typeof TomSelect !== 'undefined') new TomSelect('#font-picker', {
    onInitialize: function() {
        this.hook('after', 'setActiveOption', () => {
            if (this.isOpen) previewTimerFont(this.activeOption?.dataset.value || this.getValue());
        });
    },
    onDropdownOpen: function() {
        previewTimerFont(this.activeOption?.dataset.value || this.getValue());
    },
    onDropdownClose: function() {
        // Escape or dismiss returns to the committed font; Enter/click keeps the new one.
        previewTimerFont(this.getValue());
    },
    onChange: function(value) {
        previewTimerFont(value);
    },
    render: {
        option: function(data, escape) {
            return `
                <div style="display:flex; justify-content:space-between;">
                    <span>${escape(data.text)}</span>
                    <span style="font-family: '${escape(data.font)}';">12:34:56.7890</span>
                </div>
            `;
        },
        item: function(data, escape) {
            return `
                <div>
                ${escape(data.text)}
                </div>
            `;
        }
    }
});

// Font style toggles (bold/italic)
const boldToggle = document.getElementById('bold-toggle');
const italicToggle = document.getElementById('italic-toggle');

let isBold = boldToggle.classList.contains('active');
let isItalic = italicToggle.classList.contains('active');

boldToggle.addEventListener('click', () => {
    isBold = !isBold;
    boldToggle.classList.toggle('active');
    updateFontStyle();
});

italicToggle.addEventListener('click', () => {
    isItalic = !isItalic;
    italicToggle.classList.toggle('active');
    updateFontStyle();
});

function updateFontStyle() {
    timer.style.fontWeight = isBold ? 'bold' : 'normal';
    timer.style.fontStyle = isItalic ? 'italic' : 'normal';
}

// @bycapwan
const fontSizeInput = document.getElementById('font-size');
const textStrokeWidthInput = document.getElementById('text-stroke-width');
const textStrokeColourInput = document.getElementById('text-stroke-colour');
function updateTextAppearance() {
    timer.style.fontSize = `${fontSizeInput.value}px`;
    timer.style.webkitTextStroke = `${textStrokeWidthInput.value}px ${textStrokeColourInput.value}`;
    updateSliderValues();
}
for (const input of [fontSizeInput, textStrokeWidthInput, textStrokeColourInput]) {
    input.addEventListener('input', updateTextAppearance);
}
updateTextAppearance();

// Apply saved appearance without dispatching input events that resize linked controls.
updateOpacity();
timer.style.fontFamily = `"${timerFontInput.value}"`;
updateFontStyle();
window.TimerSettings?.registerState('shapeRatio', () => lockedAspectRatio);
window.TimerSettings?.registerState('spacingProportions', () => spacingProportions);

function updateOpacity() {
    const backgroundOpacity = document.getElementById('background-opacity').value;
    const textOpacity = document.getElementById('text-opacity').value;
    const hex = bgColourInput.value;
    const channels = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
    timer.style.backgroundColor = `rgba(${channels.join(', ')}, ${Number(backgroundOpacity) / 100})`;
    timer.style.color = textColourInput.value;
    timer.style.setProperty('--text-opacity', Number(textOpacity) / 100);
    updateNumberField('background-opacity', backgroundOpacity);
    updateNumberField('text-opacity', textOpacity);
}
for (const id of ['background-opacity', 'text-opacity']) {
    document.getElementById(id).addEventListener('input', updateOpacity);
}
updateOpacity();
