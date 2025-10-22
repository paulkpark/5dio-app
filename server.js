
import express from 'express';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(compression());
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.get('*', (req, res, next) => {
  if (req.path.match(/\.(js|css|png|jpg|jpeg|webp|svg|ico|mp3|wav|ogg|m4a|json)$/i)) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.listen(PORT, () => console.log(`5DIO server http://localhost:${PORT}`));
