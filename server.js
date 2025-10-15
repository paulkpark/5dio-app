const express = require('express');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const cors = require('cors');

const app = express();

// ✅ MEDIA ROOT 지정 
const MEDIA_ROOT = path.resolve(process.env.MEDIA_DIR || path.join(__dirname, 'media'));
fs.mkdirSync(MEDIA_ROOT, { recursive: true }); // 폴더가 없으면 자동 생성
const PORT = process.env.PORT || 5178;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

function safeJoin(root, p = '') {
  const target = path.resolve(root, p || '');
  if (!target.startsWith(root)) throw new Error('Invalid path');
  return target;
}

function listTree(dirAbs) {
  const out = { folders: [], files: [] };
  const entries = fs.readdirSync(dirAbs, { withFileTypes: true });

  for (const entry of entries) {
    try {
      const full = path.join(dirAbs, entry.name);
      if (entry.isDirectory()) {
        const files = fs.readdirSync(full);
        const thumb = files.find(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f));
        out.folders.push({
          name: entry.name,
          path: path.relative(MEDIA_ROOT, full).replace(/\\/g, '/'),
          thumb: thumb
            ? `/media/${path.relative(MEDIA_ROOT, path.join(full, thumb)).replace(/\\/g, '/')}`
            : null
        });
      } else if (entry.isFile()) {
        if (/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(entry.name)) {
          const base = entry.name.replace(/\.[^.]+$/, '');
          const exts = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
          let img = null;
          for (const x of exts) {
            if (fs.existsSync(path.join(dirAbs, base + '.' + x))) {
              img = x;
              break;
            }
          }
          out.files.push({
            name: entry.name,
            path: path.relative(MEDIA_ROOT, full).replace(/\\/g, '/'),
            url: `/media/${path.relative(MEDIA_ROOT, full).replace(/\\/g, '/')}`,
            thumb: img
              ? `/media/${path.relative(MEDIA_ROOT, path.join(dirAbs, base + '.' + img)).replace(/\\/g, '/')}`
              : null
          });
        }
      }
    } catch {}
  }

  out.folders.sort((a, b) => a.name.localeCompare(b.name));
  out.files.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

// ✅ API: 폴더 구조 반환
app.get('/api/tree', (req, res) => {
  try {
    const rel = req.query.path || '';
    const abs = safeJoin(MEDIA_ROOT, rel);
    const st = fs.statSync(abs);
    if (!st.isDirectory()) return res.status(400).json({ error: 'Not a directory' });
    res.json(listTree(abs));
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

// ✅ /media/:file → 오디오/이미지 스트리밍
app.get('/media/*', (req, res) => {
  try {
    const rel = req.params[0];
    const abs = safeJoin(MEDIA_ROOT, rel);
    if (!fs.existsSync(abs)) return res.status(404).send('File not found');
    const st = fs.statSync(abs);
    if (!st.isFile()) return res.status(404).end();

    const type = mime.lookup(abs) || 'application/octet-stream';
    res.setHeader('Content-Type', type);

    const range = req.headers.range;
    if (range) {
      const m = range.match(/bytes=(\d+)-(\d*)/);
      const start = m && m[1] ? parseInt(m[1]) : 0;
      const end = m && m[2] ? parseInt(m[2]) : st.size - 1;
      res.status(206).set({
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${st.size}`,
        'Accept-Ranges': 'bytes'
      });
      fs.createReadStream(abs, { start, end }).pipe(res);
    } else {
      fs.createReadStream(abs).pipe(res);
    }
  } catch (e) {
    res.status(404).send('Error: ' + e.message);
  }
});

// ✅ 서버 시작 로그
app.listen(PORT, () => {
  console.log(`\n[LUNASONIC SERVER READY]`);
  console.log(`http://localhost:${PORT}`);
  console.log(`MEDIA_ROOT: ${MEDIA_ROOT}`);
});
