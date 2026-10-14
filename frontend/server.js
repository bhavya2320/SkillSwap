const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname);
const port = Number(process.env.FRONTEND_PORT) || 5500;
const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml"
};

http.createServer(function (req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { "Allow": "GET, HEAD" });
        res.end("Method not allowed");
        return;
    }

    let pathname;
    try {
        pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch (error) {
        res.writeHead(400);
        res.end("Invalid URL");
        return;
    }

    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^[/\\]+/, "");
    const filePath = path.resolve(root, relativePath);
    const relativeToRoot = path.relative(root, filePath);
    if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }

    fs.stat(filePath, function (statError, stats) {
        if (statError || !stats.isFile()) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Not found");
            return;
        }

        res.writeHead(200, {
            "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
            "Content-Length": stats.size,
            "X-Content-Type-Options": "nosniff"
        });
        if (req.method === "HEAD") {
            res.end();
            return;
        }
        fs.createReadStream(filePath).pipe(res);
    });
}).listen(port, "127.0.0.1", function () {
    console.log(`SkillSwap frontend available at http://127.0.0.1:${port}`);
});
