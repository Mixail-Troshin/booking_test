const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// --- настройки из переменных окружения Render ---
const ADMIN_KEY = process.env.ADMIN_KEY || 'changeme';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@example.com';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = process.env.SMTP_PORT || '';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

// --- email-транспорт (если задан SMTP) ---
let transporter = null;
if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
  console.log('Email transporter настроен');
} else {
  console.log('Email не настроен: задайте SMTP_* переменные, чтобы отправлять письма');
}

// --- middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- база SQLite ---
const db = new Database('slots.db');

db.prepare(`
  CREATE TABLE IF NOT EXISTS slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TEXT NOT NULL,
    booked INTEGER NOT NULL DEFAULT 0,
    name TEXT,
    email TEXT
  )
`).run();

// если пусто — создаём слоты на сегодня
const count = db.prepare('SELECT COUNT(*) AS c FROM slots').get().c;
if (count === 0) {
  const insert = db.prepare('INSERT INTO slots (time) VALUES (?)');
  const times = [
    '10:00','10:30',
    '11:00','11:30',
    '12:00','12:30',
    '13:00','13:30'
  ];
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  for (const t of times) {
    insert.run(`${today} ${t}`);
  }
  console.log('Созданы стартовые слоты на сегодня');
}

// --- публичное API: свободные слоты ---
app.get('/api/slots', (req, res) => {
  const rows = db.prepare(
    'SELECT id, time FROM slots WHERE booked = 0 ORDER BY time'
  ).all();
  res.json(rows);
});

// --- публичное API: бронь ---
app.post('/api/book', async (req, res) => {
  const { slotId, name, email } = req.body;

  if (!slotId || !name || !email) {
    return res.status(400).json({ success: false, message: 'Не хватает данных' });
  }

  const slot = db.prepare('SELECT id, booked, time FROM slots WHERE id = ?').get(slotId);
  if (!slot) {
    return res.status(404).json({ success: false, message: 'Слот не найден' });
  }
  if (slot.booked) {
    return res.status(409).json({ success: false, message: 'Слот уже занят' });
  }

  const info = db.prepare(`
    UPDATE slots
    SET booked = 1, name = ?, email = ?
    WHERE id = ? AND booked = 0
  `).run(name, email, slotId);

  if (info.changes === 0) {
    return res.status(409).json({ success: false, message: 'Слот уже занят' });
  }

  const slotTime = slot.time;

  if (transporter) {
    transporter.sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: 'Подтверждение записи на встречу',
      text: `Вы записаны на встречу в ${slotTime}.`
    }).catch(err => console.error('Mail user error:', err.message));

    transporter.sendMail({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: 'Новая запись на встречу',
      text: `Время: ${slotTime}\nИмя: ${name}\nEmail: ${email}`
    }).catch(err => console.error('Mail admin error:', err.message));
  }

  res.json({ success: true, message: 'Вы успешно записаны!' });
});

// --- API для админки ---
app.get('/api/admin/slots', (req, res) => {
  const key = req.query.key;
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Нет доступа' });
  }

  const rows = db.prepare(
    'SELECT id, time, booked, name, email FROM slots ORDER BY time'
  ).all();

  res.json({ success: true, slots: rows });
});

// страница админки
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// --- старт ---
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
