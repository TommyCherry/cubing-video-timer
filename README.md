# Cubing video timer

Customisable stopwatch for displaying the solve time in speedcubing videos. Preview it on the page or download a transparent timer video to overlay in your editor.

## Run locally

For QuickTime-compatible MOV downloads, run these commands in this folder:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install imageio-ffmpeg
.venv/bin/python server.py
```

Open http://localhost:8000. Stop any old `python3 -m http.server` process first (Ctrl+C in its terminal).
If FFmpeg is already on your PATH, you can simply run `python3 server.py`.
Use the same port as before to retain saved settings and presets.
A plain static server still supports the timer and MP4, but MOV requires this local converter.

Settings save automatically in browser local storage and restore on refresh, including timing,
appearance, dimensions, ratio locks and export options. Use the same browser and site address/port
to access those settings. Refresh resets playback to zero; it does not resume a running timer or export.

Use **Presets** to name a setup and **Save as new**. Select a saved preset and choose **Load** to
restore it (the page reloads and playback resets). **Update** replaces that preset with the current
settings and name. **Delete** removes it, with an **Undo delete** action available until the page reloads.
Presets are stored locally in the same browser and include all timing, appearance and export settings.

## Named splits

Enable **Include named splits** to add up to eight named segments. **Starts at (seconds)** is the
elapsed main-timer time when that segment begins. For example, Cube at 0 and Drink at 9.37 makes
Cube last 9.37 seconds; Drink starts counting from zero at 9.37. Each segment ends at the next start,
and the last ends at the main stop time. Existing saved timestamps are now treated as start times.
Rows display in start-time order and reserve space so playback stays stable. With **Live split times**,
the active segment counts up from zero; completed durations freeze and future segments show a dash.
Without live updates, durations appear only when segments finish. This applies to previews and exports.
An optional separate rounded background follows the timer background colour and opacity; split text has
independent font, size, colour, opacity, bold and italic controls. Font highlighting previews live, and size
uses a slider with an editable value. These styles apply to both names and split times. Splits are included in MOV/MP4 exports,
saved settings, and named presets. Use **Fit frame to timer** to include the full panel in your video.
Splits after the stop time remain pending and show a warning in the editor.

## Transparent video export

Set the delay, stop time, speed and text appearance, choose a frame rate and format, then click **Download MOV** or **Download MP4**.
Choose the video width and height using the sliders. The outlined checkerboard preview shows the exact exported composition,
scaled to fit the page; the checkerboard and outline are not exported. **Fit frame to timer** leaves room for the final time.
The selected timer shape, background colour, border and text are included by default, with transparency outside the shape.
Uncheck **Include timer background shape and border** for a text-only overlay. A warning appears when the frame may crop the timer.
Frame-rate choices are 23.976, 24, 25, 29.97, 30 (default), 48, 50, 59.94, 60 and 120 fps.
MOV uses exact frame timing, including rational rates (24000/1001, 30000/1001 and 60000/1001).
Exports include the start delay and an adjustable **End hold** (0–60 seconds, default 1). The slider and editable value control how long the final time stays visible in MOV and MP4. A zero hold still includes one final frame. This setting is saved with your settings and presets.
Font size, font family, bold/italic, text colour and text stroke are captured when export starts.

Frames render in the browser, then the local server encodes MOV as ProRes 4444 with an alpha channel.
Videos stay on your computer. The server uses FFmpeg (installed directly or through imageio-ffmpeg).
Unlike the previous PNG-in-MOV output, ProRes 4444 can be decoded by QuickTime Player.
Exports are limited to 10 minutes and 256 MB of intermediate PNG frames; ProRes files can be larger.
Cancel prevents the download; an in-progress server conversion may finish before its temporary files are removed.
MP4 explicitly requests H.264 from the browser's MediaRecorder for QuickTime compatibility; generic MP4 support alone is not sufficient. It records in real time; keep the tab visible.
The selected FPS is a target for MP4 and frames may be dropped under load. H.264 does not preserve transparency; transparent areas become black;
use MOV when transparency or precise frame timing matters. Unsupported browsers show a message instead of downloading a mislabeled file.
Online fonts still require an internet connection to load. The timer is centered in the chosen video frame, without scaling it.

Run `node --test video-export.test.js` to check formatting, frame timing and MOV structure.

Features:
- Choose when the timer stops so that it finishes on exactly your solve time
- Adjust the speed at which the timer updates - useful for time lapse and (especially for) slow-motion videos
- Display the time in the desired format, and it will update when necessary (e.g. if the format is set to S.XX, the timer will only show one seconds digit up to 9.99, and then update to show two digits for 10.00 onwards)
- Customisable timer and background colours, fonts, font size and text stroke
- Adjustable background shape, dimensions, spacing, border and corner roundness
- Download transparent MOV videos

Planned features:
- Improve display on mobile

Potential future features:
- More visual customisation of timer
- Option to display frames rather than deciseconds/centiseconds/milliseconds
- Multi-phase mode to have timer run at different speeds (e.g. 5 seconds normal speed, 59 minutes of 100x speed, then 20 seconds of normal speed for a multiBLD attempt)
- Add different types of counters, e.g. number counter, counting from one time/date to another
