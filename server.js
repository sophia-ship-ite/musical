const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Queue to serialize writes to db.json to prevent corruption
let writeQueue = Promise.resolve();

function readDatabase() {
  return new Promise((resolve, reject) => {
    fs.readFile(DB_PATH, 'utf8', (err, data) => {
      if (err) return reject(err);
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function writeDatabase(data) {
  writeQueue = writeQueue.then(() => {
    return new Promise((resolve, reject) => {
      fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf8', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
  return writeQueue;
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        if (!body) resolve({});
        else resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  try {
    // API Routes
    if (pathname.startsWith('/api/')) {
      const db = await readDatabase();

      // GET /api/musicals
      if (method === 'GET' && pathname === '/api/musicals') {
        const search = parsedUrl.query.search;
        const sort = parsedUrl.query.sort || 'latest';

        let result = db.musicals.map(m => {
          const mReviews = db.reviews.filter(r => r.musicalId === m.id);
          const count = mReviews.length;
          let avg = null;
          if (count > 0) {
            const sum = mReviews.reduce((acc, curr) => acc + curr.rating, 0);
            avg = parseFloat((sum / count).toFixed(1));
          }
          return {
            ...m,
            averageRating: avg,
            reviewCount: count
          };
        });

        // Search Filter (case-insensitive by title, genre, description)
        if (search) {
          const q = search.toLowerCase().trim();
          result = result.filter(m => 
            (m.title && m.title.toLowerCase().includes(q)) ||
            (m.genre && m.genre.toLowerCase().includes(q)) ||
            (m.description && m.description.toLowerCase().includes(q))
          );
        }

        // Sorting Logic
        if (sort === 'rating') {
          result.sort((a, b) => {
            const rA = a.averageRating === null ? 0 : a.averageRating;
            const rB = b.averageRating === null ? 0 : b.averageRating;
            if (rB !== rA) return rB - rA;
            return b.reviewCount - a.reviewCount;
          });
        } else if (sort === 'reviews') {
          result.sort((a, b) => {
            if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
            const rA = a.averageRating === null ? 0 : a.averageRating;
            const rB = b.averageRating === null ? 0 : b.averageRating;
            return rB - rA;
          });
        } else if (sort === 'alphabetical') {
          result.sort((a, b) => a.title.localeCompare(b.title));
        } else {
          // 'latest' created musical first (createdAt descending)
          result.sort((a, b) => {
            const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tB - tA;
          });
        }

        sendJson(res, 200, result);
        return;
      }

      // POST /api/musicals
      if (method === 'POST' && pathname === '/api/musicals') {
        const body = await parseJsonBody(req);

        // Validation
        if (typeof body.title !== 'string' || body.title.trim().length < 1 || body.title.trim().length > 100) {
          sendJson(res, 400, { error: '뮤지컬 제목은 1자 이상 100자 이하로 입력해 주세요.' });
          return;
        }

        if (typeof body.genre !== 'string' || body.genre.trim().length < 1 || body.genre.trim().length > 50) {
          sendJson(res, 400, { error: '장르는 1자 이상 50자 이하로 입력해 주세요.' });
          return;
        }

        if (typeof body.description !== 'string' || body.description.trim().length < 1 || body.description.trim().length > 5000) {
          sendJson(res, 400, { error: '설명은 1자 이상 5000자 이하로 입력해 주세요.' });
          return;
        }

        const newMusical = {
          id: `mus_${crypto.randomUUID()}`,
          title: body.title.trim(),
          genre: body.genre.trim(),
          description: body.description.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        db.musicals.push(newMusical);
        await writeDatabase(db);

        sendJson(res, 201, newMusical);
        return;
      }

      // GET /api/musicals/:id/reviews
      if (method === 'GET' && pathname.startsWith('/api/musicals/') && pathname.endsWith('/reviews')) {
        const id = pathname.substring('/api/musicals/'.length, pathname.length - '/reviews'.length);
        const musicalExists = db.musicals.some(m => m.id === id);
        if (!musicalExists) {
          sendJson(res, 404, { error: 'Musical not found' });
          return;
        }

        let reviews = db.reviews.filter(r => r.musicalId === id);
        const sort = parsedUrl.query.sort || 'latest';

        if (sort === 'latest') {
          reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else if (sort === 'highest-rating') {
          reviews.sort((a, b) => b.rating - a.rating || new Date(b.createdAt) - new Date(a.createdAt));
        } else if (sort === 'lowest-rating') {
          reviews.sort((a, b) => a.rating - b.rating || new Date(b.createdAt) - new Date(a.createdAt));
        }

        sendJson(res, 200, reviews);
        return;
      }

      // GET /api/musicals/:id
      if (method === 'GET' && pathname.startsWith('/api/musicals/')) {
        const id = pathname.substring('/api/musicals/'.length);
        const musical = db.musicals.find(m => m.id === id);
        if (!musical) {
          sendJson(res, 404, { error: 'Musical not found' });
          return;
        }

        const mReviews = db.reviews.filter(r => r.musicalId === id);
        const count = mReviews.length;
        let avg = null;
        if (count > 0) {
          const sum = mReviews.reduce((acc, curr) => acc + curr.rating, 0);
          avg = parseFloat((sum / count).toFixed(1));
        }

        sendJson(res, 200, {
          ...musical,
          averageRating: avg,
          reviewCount: count
        });
        return;
      }

      // PUT /api/musicals/:id
      if (method === 'PUT' && pathname.startsWith('/api/musicals/')) {
        const id = pathname.substring('/api/musicals/'.length);
        const musicalIndex = db.musicals.findIndex(m => m.id === id);
        if (musicalIndex === -1) {
          sendJson(res, 404, { error: 'Musical not found' });
          return;
        }

        const body = await parseJsonBody(req);

        // Validation
        if (typeof body.title !== 'string' || body.title.trim().length < 1 || body.title.trim().length > 100) {
          sendJson(res, 400, { error: '뮤지컬 제목은 1자 이상 100자 이하로 입력해 주세요.' });
          return;
        }

        if (typeof body.genre !== 'string' || body.genre.trim().length < 1 || body.genre.trim().length > 50) {
          sendJson(res, 400, { error: '장르는 1자 이상 50자 이하로 입력해 주세요.' });
          return;
        }

        if (typeof body.description !== 'string' || body.description.trim().length < 1 || body.description.trim().length > 5000) {
          sendJson(res, 400, { error: '설명은 1자 이상 5000자 이하로 입력해 주세요.' });
          return;
        }

        const musical = db.musicals[musicalIndex];
        musical.title = body.title.trim();
        musical.genre = body.genre.trim();
        musical.description = body.description.trim();
        musical.updatedAt = new Date().toISOString();

        await writeDatabase(db);
        sendJson(res, 200, musical);
        return;
      }

      // DELETE /api/musicals/:id
      if (method === 'DELETE' && pathname.startsWith('/api/musicals/')) {
        const id = pathname.substring('/api/musicals/'.length);
        const musicalIndex = db.musicals.findIndex(m => m.id === id);
        if (musicalIndex === -1) {
          sendJson(res, 404, { error: 'Musical not found' });
          return;
        }

        // Delete the musical
        db.musicals.splice(musicalIndex, 1);
        // Cascade delete reviews
        db.reviews = db.reviews.filter(r => r.musicalId !== id);

        await writeDatabase(db);
        sendJson(res, 200, { success: true });
        return;
      }

      // POST /api/reviews
      if (method === 'POST' && pathname === '/api/reviews') {
        const body = await parseJsonBody(req);
        
        // Validation
        const musicalExists = db.musicals.some(m => m.id === body.musicalId);
        if (!musicalExists) {
          sendJson(res, 400, { error: '올바르지 않은 뮤지컬 ID입니다.' });
          return;
        }

        if (typeof body.nickname !== 'string' || body.nickname.trim().length < 2 || body.nickname.trim().length > 15) {
          sendJson(res, 400, { error: '닉네임은 2자 이상 15자 이하로 입력해 주세요.' });
          return;
        }

        if (typeof body.title !== 'string' || body.title.trim().length < 1 || body.title.trim().length > 100) {
          sendJson(res, 400, { error: '후기 제목은 1자 이상 100자 이하로 입력해 주세요.' });
          return;
        }

        if (typeof body.content !== 'string' || body.content.trim().length < 1 || body.content.trim().length > 3000) {
          sendJson(res, 400, { error: '후기 내용은 1자 이상 3000자 이하로 입력해 주세요.' });
          return;
        }

        const rating = parseFloat(body.rating);
        if (isNaN(rating) || rating < 0.5 || rating > 5.0 || (rating * 2) !== Math.floor(rating * 2)) {
          sendJson(res, 400, { error: '평점은 0.5에서 5.0 사이로 0.5 단위로 입력해 주세요.' });
          return;
        }

        const newReview = {
          id: `rev_${crypto.randomUUID()}`,
          musicalId: body.musicalId,
          nickname: body.nickname.trim(),
          rating: rating,
          title: body.title.trim(),
          content: body.content.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        db.reviews.push(newReview);
        await writeDatabase(db);

        sendJson(res, 201, newReview);
        return;
      }

      // PUT /api/reviews/:id
      if (method === 'PUT' && pathname.startsWith('/api/reviews/')) {
        const id = pathname.substring('/api/reviews/'.length);
        const reviewIndex = db.reviews.findIndex(r => r.id === id);
        if (reviewIndex === -1) {
          sendJson(res, 404, { error: 'Review not found.' });
          return;
        }

        const body = await parseJsonBody(req);

        // Validation
        if (typeof body.nickname !== 'string' || body.nickname.trim().length < 2 || body.nickname.trim().length > 15) {
          sendJson(res, 400, { error: '닉네임은 2자 이상 15자 이하로 입력해 주세요.' });
          return;
        }

        if (typeof body.title !== 'string' || body.title.trim().length < 1 || body.title.trim().length > 100) {
          sendJson(res, 400, { error: '후기 제목은 1자 이상 100자 이하로 입력해 주세요.' });
          return;
        }

        if (typeof body.content !== 'string' || body.content.trim().length < 1 || body.content.trim().length > 3000) {
          sendJson(res, 400, { error: '후기 내용은 1자 이상 3000자 이하로 입력해 주세요.' });
          return;
        }

        const rating = parseFloat(body.rating);
        if (isNaN(rating) || rating < 0.5 || rating > 5.0 || (rating * 2) !== Math.floor(rating * 2)) {
          sendJson(res, 400, { error: '평점은 0.5에서 5.0 사이로 0.5 단위로 입력해 주세요.' });
          return;
        }

        const review = db.reviews[reviewIndex];
        review.nickname = body.nickname.trim();
        review.rating = rating;
        review.title = body.title.trim();
        review.content = body.content.trim();
        review.updatedAt = new Date().toISOString();

        await writeDatabase(db);
        sendJson(res, 200, review);
        return;
      }

      // DELETE /api/reviews/:id
      if (method === 'DELETE' && pathname.startsWith('/api/reviews/')) {
        const id = pathname.substring('/api/reviews/'.length);
        const reviewIndex = db.reviews.findIndex(r => r.id === id);
        if (reviewIndex === -1) {
          sendJson(res, 404, { error: 'Review not found.' });
          return;
        }

        db.reviews.splice(reviewIndex, 1);
        await writeDatabase(db);

        sendJson(res, 200, { success: true });
        return;
      }

      // If no API endpoint matches
      sendJson(res, 404, { error: 'API route not found' });
      return;
    }

    // Static File Server
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') {
      safePath = '/index.html';
    }
    let filePath = path.join(PUBLIC_DIR, safePath);
    
    // Security check: ensure the file path stays inside the public directory
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Access Denied');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      if (stats.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not Found');
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        let contentType = 'application/octet-stream';
        if (ext === '.html') contentType = 'text/html; charset=utf-8';
        else if (ext === '.css') contentType = 'text/css; charset=utf-8';
        else if (ext === '.js') contentType = 'application/javascript; charset=utf-8';
        else if (ext === '.json') contentType = 'application/json; charset=utf-8';
        else if (ext === '.ico') contentType = 'image/x-icon';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    });

  } catch (error) {
    console.error('Server error:', error);
    sendJson(res, 500, { error: 'Internal Server Error' });
  }
});

// Auto-initialize DB and start server
fs.access(DB_PATH, fs.constants.F_OK, (err) => {
  if (err) {
    const initialDb = { musicals: [], reviews: [] };
    fs.writeFile(DB_PATH, JSON.stringify(initialDb, null, 2), 'utf8', (writeErr) => {
      if (writeErr) {
        console.error('Failed to initialize database file db.json:', writeErr);
        process.exit(1);
      }
      console.log('Initialized empty database at db.json');
      startServer();
    });
  } else {
    startServer();
  }
});

function startServer() {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Musical Archive Server running on port ${PORT}`);
  });
}
