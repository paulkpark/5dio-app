// server.js — Render 호환 버전 (Node Web Service)
// + Admin 업로더 / 삭제 / 목록 추가
// ---------------------------------------------

const express = require('express');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const cors = require('cors');
const multer = require('multer');
const basicAuth = require('basic-auth');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const MEDIA_ROOT = path.resolve(process.env.MEDIA_DIR || path.join(__dirname, 'media'));
const PUBLIC_DIR = path.join(__dirname, 'public');

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

// 정적파일(public)
app.use(express.static(PUBLIC_DIR, { maxAge: '1h', etag: true }));

// 헬스체크
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// 안전한 경로 결합(디렉토리 탈출 방지)
function safeJoin(root, p = '') {
  const target = path.resolve(root, p || '');
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (!(target === root || target.startsWith(rootWithSep))) {
    throw new Error('Invalid path');
  }
  return target;
}

// 폴더 트리 나열(썸네일/오디오 매칭)
function listTree(dirAbs) {
  const out = { folders: [], files: [] };
  const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  for (const entry of entries) {
    try {
      const full = path.join(dirAbs, entry.name);
      if (entry.isDirectory()) {
        const files = fs.readdirSync(full);
        const thumb = files.find((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f));
        out.folders.push({
          name: entry.name,
          path: path.relative(MEDIA_ROOT, full).replace(/\\/g, '/'),
          thumb: thumb ? `/media/${path.relative(MEDIA_ROOT, path.join(full, thumb)).replace(/\\/g, '/')}` : null,
        });
      } else if (entry.isFile()) {
        if (/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(entry.name)) {
          const base = entry.name.replace(/\.[^.]+$/, '');
          const exts = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
          let img = null;
          for (const x of exts) {
            if (fs.existsSync(path.join(dirAbs, `${base}.${x}`))) {
              img = x; break;
            }
          }
          out.files.push({
            name: entry.name,
            path: path.relative(MEDIA_ROOT, full).replace(/\\/g, '/'),
            url: `/media/${path.relative(MEDIA_ROOT, full).replace(/\\/g, '/')}`,
            thumb: img ? `/media/${path.relative(MEDIA_ROOT, path.join(dirAbs, `${base}.${img}`)).replace(/\\/g, '/')}` : null,
          });
        }
      }
    } catch {}
  }
  out.folders.sort((a,b)=>a.name.localeCompare(b.name));
  out.files.sort((a,b)=>a.name.localeCompare(b.name));
  return out;
}

// === 기본 미디어 API ===
app.get('/api/tree', (req, res) => {
  try {
    const rel = req.query.path || '';
    const abs = safeJoin(MEDIA_ROOT, rel);
    if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Not found' });
    const st = fs.statSync(abs);
    if (!st.isDirectory()) return res.status(400).json({ error: 'Not a directory' });
    return res.json(listTree(abs));
  } catch (e) {
    return res.status(400).json({ error: String(e.message || e) });
  }
});

// === 미디어 파일 스트리밍 ===
app.get('/media/*', (req, res) => {
  try {
    const rel = req.params[0] || '';
    const abs = safeJoin(MEDIA_ROOT, rel);
    if (!fs.existsSync(abs)) return res.status(404).send('File not found');
    const st = fs.statSync(abs);
    if (!st.isFile()) return res.status(404).end();
    const type = mime.lookup(abs) || 'application/octet-stream';
    res.setHeader('Content-Type', type);

    const range = req.headers.range;
    if (range) {
      const m = range.match(/bytes=(\d+)-(\d*)/);
      const start = m && m[1] ? parseInt(m[1], 10) : 0;
      const end = m && m[2] ? parseInt(m[2], 10) : st.size - 1;
      if (start >= st.size || end >= st.size) {
        res.setHeader('Content-Range', `bytes */${st.size}`);
        return res.status(416).end();
      }
      res.status(206).set({
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${st.size}`,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(abs, { start, end }).pipe(res);
    } else {
      res.setHeader('Content-Length', st.size);
      fs.createReadStream(abs).pipe(res);
    }
  } catch (e) {
    res.status(404).send('Error: ' + (e.message || String(e)));
  }
});

// === Admin 업로더/삭제/목록 ===
const upload = multer({ dest: '/tmp' });
app.use(express.json());

function mustAuth(req, res, next) {
  if (!ADMIN_USER || !ADMIN_PASS) return next(); // 보호 해제
  const creds = basicAuth(req);
  if (creds && creds.name === ADMIN_USER && creds.pass === ADMIN_PASS) return next();
  res.set('WWW-Authenticate', 'Basic realm="5DIO Admin"');
  return res.status(401).send('Auth required');
}

app.get('/admin', mustAuth, (_req, res) => {
  res.type('html').send(`<meta charset="utf-8"><h2>5DIO Media Admin</h2>
<form action="/admin/upload" method="post" enctype="multipart/form-data">
카테고리: <input name="category"><br><br>
<input type="file" name="file"><br><br>
<button>Upload</button>
</form>
<hr>
<form action="/admin/delete" method="post">
삭제할 경로: <input name="path">
<button>Delete</button>
</form>
<hr>
<form onsubmit="event.preventDefault();fetch('/api/tree').then(r=>r.json()).then(j=>pre.textContent=JSON.stringify(j,null,2))">
<button>List root</button>
</form><pre id="pre"></pre>`);
});

app.post('/admin/upload', mustAuth, upload.single('file'), (req, res) => {
  try {
    const cat = (req.body.category || 'Uncategorized').trim();
    const dstDir = safeJoin(MEDIA_ROOT, cat);
    fs.mkdirSync(dstDir, { recursive: true });
    const dst = path.join(dstDir, req.file.originalname);
    fs.renameSync(req.file.path, dst);
    return res.json({ ok: true, saved: path.relative(MEDIA_ROOT, dst) });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }
});

app.post('/admin/delete', mustAuth, express.urlencoded({ extended: true }), (req, res) => {
  try {
    const rel = (req.body.path || '').trim();
    if (!rel) throw new Error('path required');
    const abs = safeJoin(MEDIA_ROOT, rel);
    if (!fs.existsSync(abs)) return res.json({ ok: false, error: 'not found' });
    const st = fs.statSync(abs);
    if (st.isDirectory()) fs.rmSync(abs, { recursive: true, force: true });
    else fs.unlinkSync(abs);
    return res.json({ ok: true, removed: rel });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }
});

// === SPA 라우팅 ===
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// 서버 시작
app.listen(PORT, () => {
  console.log('\n[5DIO SERVER READY]');
  console.log(`→ http://localhost:${PORT}`);
  console.log(`MEDIA_ROOT: ${MEDIA_ROOT}`);
});
