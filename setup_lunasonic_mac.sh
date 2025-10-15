#!/usr/bin/env bash
set -e
echo "▶ LUNASONIC macOS setup (Node.js LTS + Library Server)"

is_macos() { [[ "$(uname -s)" == "Darwin" ]]; }
have_cmd() { command -v "$1" >/dev/null 2>&1; }
append_once() { LINE="$1"; FILE="$2"; grep -qxF "$LINE" "$FILE" 2>/dev/null || echo "$LINE" >> "$FILE"; }

if ! is_macos; then echo "❌ macOS only"; exit 1; fi

SHELL_RC="${HOME}/.zshrc"
[[ -n "$BASH_VERSION" ]] && SHELL_RC="${HOME}/.bashrc"

if ! have_cmd brew; then
  echo "🔧 Installing Homebrew…"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
  echo "✅ Homebrew already installed."
fi

if ! have_cmd nvm; then
  echo "🔧 Installing NVM…"
  brew install nvm
  mkdir -p "${HOME}/.nvm"
  append_once 'export NVM_DIR="$HOME/.nvm"' "$SHELL_RC"
  if [[ -d "/opt/homebrew/opt/nvm" ]]; then
    append_once '[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && . "/opt/homebrew/opt/nvm/nvm.sh"' "$SHELL_RC"
  else
    append_once '[ -s "/usr/local/opt/nvm/nvm.sh" ] && . "/usr/local/opt/nvm/nvm.sh"' "$SHELL_RC"
  fi
  export NVM_DIR="$HOME/.nvm"
  [[ -s "/opt/homebrew/opt/nvm/nvm.sh" ]] && . "/opt/homebrew/opt/nvm/nvm.sh"
  [[ -s "/usr/local/opt/nvm/nvm.sh" ]] && . "/usr/local/opt/nvm/nvm.sh"
else
  echo "✅ NVM already installed."
  export NVM_DIR="$HOME/.nvm"
  [[ -s "/opt/homebrew/opt/nvm/nvm.sh" ]] && . "/opt/homebrew/opt/nvm/nvm.sh"
  [[ -s "/usr/local/opt/nvm/nvm.sh" ]] && . "/usr/local/opt/nvm/nvm.sh"
fi

echo "🔧 Installing Node.js LTS…"
nvm install --lts
nvm use --lts
echo "✅ Node $(node -v) / npm $(npm -v)"

ROOT="${PWD}/lunasonic_library_server"
mkdir -p "$ROOT/public" "$ROOT/media"

cat > "$ROOT/server.js" <<'JS'
// same server as provided in chat - trimmed for brevity
const express = require('express'); const path = require('path'); const fs = require('fs');
const mime = require('mime-types'); const cors = require('cors');
const MEDIA_ROOT = process.env.MEDIA_ROOT || path.resolve(__dirname, 'media');
const PORT = process.env.PORT || 5178;
const app = express(); app.use(cors()); app.use(express.static(path.join(__dirname, 'public')));
function safeJoin(root, p=''){ const t = path.resolve(root, p || ''); if(!t.startsWith(root)) throw new Error('Invalid path'); return t; }
function listTree(dirAbs){ const out={folders:[],files:[]}; const es=fs.readdirSync(dirAbs,{withFileTypes:true}); for(const e of es){ try{ const full=path.join(dirAbs,e.name);
if(e.isDirectory()){ const files=fs.readdirSync(full); const thumb=files.find(f=>/\.(png|jpg|jpeg|webp|gif)$/i.test(f)); out.folders.push({name:e.name,path:path.relative(MEDIA_ROOT,full).replace(/\\/g,'/'),thumb: thumb? `/media/${path.relative(MEDIA_ROOT,path.join(full,thumb)).replace(/\\/g,'/')}`:null});}
else if(e.isFile()){ if(/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(e.name)){ const base=e.name.replace(/\.[^.]+$/,''); const exts=['png','jpg','jpeg','webp','gif']; let img=null; for(const x of exts){ if(fs.existsSync(path.join(dirAbs,base+'.'+x))){ img=x; break;} }
out.files.push({name:e.name,path:path.relative(MEDIA_ROOT,full).replace(/\\/g,'/'),url:`/media/${path.relative(MEDIA_ROOT,full).replace(/\\/g,'/')}`,thumb: img? `/media/${path.relative(MEDIA_ROOT,path.join(dirAbs,base+'.'+img)).replace(/\\/g,'/')}`:null}); } } }catch{} } out.folders.sort((a,b)=>a.name.localeCompare(b.name)); out.files.sort((a,b)=>a.name.localeCompare(b.name)); return out; }
app.get('/api/tree',(req,res)=>{ try{ const rel=req.query.path||''; const abs=safeJoin(MEDIA_ROOT,rel); const st=fs.statSync(abs); if(!st.isDirectory()) return res.status(400).json({error:'Not a directory'}); res.json(listTree(abs)); }catch(e){ res.status(400).json({error:String(e.message||e)}); } });
app.get('/media/*',(req,res)=>{ try{ const rel=req.params[0]; const abs=safeJoin(MEDIA_ROOT,rel); const st=fs.statSync(abs); if(!st.isFile()) return res.status(404).end(); const type=mime.lookup(abs)||'application/octet-stream'; const range=req.headers.range;
if(range){ const m=range.match(/bytes=(\d+)-(\d*)/); const start=m&&m[1]?parseInt(m[1]):0; const end=m&&m[2]?parseInt(m[2]):st.size-1; if(isNaN(start)||isNaN(end)||start>end) return res.status(416).end();
res.status(206).set({'Content-Type':type,'Content-Length':(end-start+1),'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${st.size}`}); fs.createReadStream(abs,{start,end}).pipe(res);
}else{ res.set({'Content-Type':type,'Content-Length':st.size}); fs.createReadStream(abs).pipe(res);} }catch(e){ res.status(404).end(); } });
app.listen(PORT,()=>{ console.log(`[LUNASONIC] http://localhost:${PORT}`); console.log(`MEDIA_ROOT: ${MEDIA_ROOT}`); console.log(`Open http://localhost:${PORT}/`); });
JS

cat > "$ROOT/package.json" <<'JSON'
{
  "name": "lunasonic-library-server",
  "version": "1.0.0",
  "main": "server.js",
  "license": "MIT",
  "type": "module",
  "scripts": { "start": "node server.js" },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "mime-types": "^2.1.35"
  }
}
JSON

cat > "$ROOT/public/index.html" <<'HTML'
<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LUNASONIC Server</title>
<p>Server is running. Try <a href="/api/tree" target="_blank">/api/tree</a>.</p>
<p>Place your client HTML as <code>public/app.html</code> and open <a href="/app.html">/app.html</a>.</p>
HTML

echo "🔧 Installing server deps…"
(cd "$ROOT" && npm install)

MEDIA_ROOT="${MEDIA_ROOT:-$HOME/Music/lunasonic_media}"
mkdir -p "$MEDIA_ROOT"
echo "📁 MEDIA_ROOT: $MEDIA_ROOT"

echo "🚀 Starting server on http://localhost:${PORT:-5178}"
(cd "$ROOT" && PORT="${PORT:-5178}" MEDIA_ROOT="$MEDIA_ROOT" npm start)
