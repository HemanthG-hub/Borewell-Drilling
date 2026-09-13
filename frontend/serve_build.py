from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os


BUILD_DIR = Path(__file__).resolve().parent / "build"


class SpaHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        requested = BUILD_DIR / self.path.lstrip("/").split("?", 1)[0]
        if not requested.exists() and "." not in Path(self.path).name:
            self.path = "/index.html"
        return super().do_GET()


if __name__ == "__main__":
    os.chdir(BUILD_DIR)
    server = ThreadingHTTPServer(("127.0.0.1", 3000), SpaHandler)
    print("Serving RigRecall at http://127.0.0.1:3000")
    server.serve_forever()
