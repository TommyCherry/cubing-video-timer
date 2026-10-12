"""Local timer server with transparent ProRes 4444 export. Run: python3 server.py."""
import argparse
import json
import shutil
import subprocess
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LIMIT = 256 * 1024 * 1024


def encoder():
    executable = shutil.which('ffmpeg')
    if executable:
        return executable
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except (ImportError, RuntimeError):
        return None


def convert(executable, source, target):
    subprocess.run([
        executable, '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
        '-protocol_whitelist', 'file', '-i', str(source), '-map', '0:v:0', '-an',
        '-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le',
        '-alpha_bits', '16', '-movflags', '+faststart', str(target)
    ], check=True, capture_output=True, timeout=600)


class Handler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def reply(self, code, data):
        payload = json.dumps(data).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path == '/api/mov':
            self.reply(200, {'prores': bool(encoder())})
        else:
            super().do_GET()

    def do_POST(self):
        if self.path != '/api/mov':
            return self.reply(404, {'error': 'Unknown endpoint.'})
        # Only the locally served page may submit a conversion.
        host = self.headers.get('Host', '')
        if host not in (f'localhost:{self.server.server_port}', f'127.0.0.1:{self.server.server_port}'):
            return self.reply(403, {'error': 'Local requests only.'})
        if self.headers.get('Origin') not in (None, f'http://{host}'):
            return self.reply(403, {'error': 'Same-origin requests only.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = 0
        if not 0 < length <= LIMIT:
            return self.reply(413, {'error': 'MOV input must be between 1 byte and 256 MB.'})
        executable = encoder()
        if not executable:
            return self.reply(503, {'error': 'Install FFmpeg or imageio-ffmpeg, then restart server.py.'})
        self.connection.settimeout(600)
        try:
            with tempfile.TemporaryDirectory(prefix='timer-export-') as folder:
                source, target = Path(folder) / 'input.mov', Path(folder) / 'timer.mov'
                with source.open('wb') as stream:
                    remaining = length
                    while remaining:
                        block = self.rfile.read(min(1024 * 1024, remaining))
                        if not block:
                            raise ValueError('Incomplete upload')
                        stream.write(block)
                        remaining -= len(block)
                convert(executable, source, target)
                self.send_response(200)
                self.send_header('Content-Type', 'video/quicktime')
                self.send_header('Content-Length', str(target.stat().st_size))
                self.send_header('Content-Disposition', 'attachment; filename="timer.mov"')
                self.end_headers()
                with target.open('rb') as stream:
                    shutil.copyfileobj(stream, self.wfile)
        except (BrokenPipeError, ConnectionResetError) as error:
            self.log_error("MOV client disconnected: %s", error)
        except (subprocess.SubprocessError, OSError, ValueError) as error:
            self.log_error("MOV conversion failed: %s; %s", error, getattr(error, "stderr", b""))
            self.reply(500, {'error': 'ProRes conversion failed. Try a smaller frame size or shorter timer.'})


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    print(f'Timer: http://localhost:{args.port}', flush=True)
    print(f'ProRes encoder: {encoder() or "missing — install imageio-ffmpeg"}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
