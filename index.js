const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== ENV =====
const ADMIN_KEY = process.env.ADMIN_KEY || 'changeme';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@example.com';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = process.env.SMTP_PORT || '';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

// ===== EMAIL (опционально) =====
let transporter = null;
if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  console.log('Email transporter настроен');
} else {
  console.log('Email не настроен: задайте SMTP_* переменные, чтобы отправлять письма');
}

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== DB =====
const db = new Database('slots.db');

// На случай старых версий: просто выкидываем таблицу и создаём заново.
// Так мы гарантируем корректную схему и новую сетку слотов.
db.prepare('DROP TABLE IF EXISTS slots').run();

db.prepare(`
  CREATE TABLE slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TEXT NOT NULL,
    booked INTEGER NOT NULL DEFAULT 0,
    name TEXT,
    email TEXT,
    phone TEXT,
    contact_method TEXT
  )
`).run();

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Создаём сетку слотов на 7 дней вперёд
(function createWeeklySlots() {
  const insert = db.prepare('INSERT INTO slots (time) VALUES (?)');
  const times = [
    '10:00', '10:30',
    '11:00', '11:30',
    '12:00', '12:30',
    '13:00', '13:30',
    '14:00', '14:30',
    '15:00', '15:30'
  ];

  const today = new Date();

  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    const dateStr = formatDate(d);
    for (const t of times) {
      insert.run(`${dateStr} ${t}`);
    }
  }

  console.log('Созданы слоты на 7 дней вперёд');
})();

// ===== API: свободные слоты =====
app.get('/api/slots', (req, res) => {
  const now = new Date();
  const end = new Date();
  end.setDate(now.getDate() + 7);

  const from = `${formatDate(now)} 00:00`;
  const to = `${formatDate(end)} 23:59`;

  const rows = db.prepare(
    `SELECT id, time
     FROM slots
     WHERE booked = 0
       AND time >= ?
       AND time <= ?
     ORDER BY time`
  ).all(from, to);

  res.json(rows);
});

// ===== API: бронирование =====
app.post('/api/book', async (req, res) => {
  const { slotId, name, email, phone, contactMethod } = req.body;

  if (!slotId || !name || !email || !phone || !contactMethod) {
    return res.status(400).json({ success: false, message: 'Заполните все поля.' });
  }

  const slot = db.prepare('SELECT id, booked, time FROM slots WHERE id = ?').get(slotId);
  if (!slot) {
    return res.status(404).json({ success: false, message: 'Слот не найден.' });
  }
  if (slot.booked) {
    return res.status(409).json({ success: false, message: 'Слот уже занят.' });
  }

  const info = db.prepare(`
    UPDATE slots
    SET booked = 1,
        name = ?,
        email = ?,
        phone = ?,
        contact_method = ?
    WHERE id = ? AND booked = 0
  `).run(name, email, phone, contactMethod, slotId);

  if (info.changes === 0) {
    return res.status(409).json({ success: false, message: 'Слот уже занят.' });
  }

  const slotTime = slot.time;

  if (transporter) {
    const userText =
      `Вы записаны на встречу ${slotTime}. ` +
      `Мы свяжемся с вами в ${contactMethod} по номеру ${phone}.`;

    const adminText =
      `Новая запись:\n` +
      `Время: ${slotTime}\n` +
      `Имя: ${name}\n` +
      `Email: ${email}\n` +
      `Телефон: ${phone}\n` +
      `Способ связи: ${contactMethod}\n`;

    transporter.sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: 'Подтверждение записи на встречу',
      text: userText
    }).catch(err => console.error('Mail user error:', err.message));

    transporter.sendMail({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: 'Новая запись на встречу',
      text: adminText
    }).catch(err => console.error('Mail admin error:', err.message));
  }

  return res.json({ success: true, message: 'Вы успешно записаны!' });
});

// ===== API: админка =====
app.get('/api/admin/slots', (req, res) => {
  const key = req.query.key;
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Нет доступа' });
  }

  const rows = db.prepare(
    `SELECT id, time, booked, name, email, phone, contact_method
     FROM slots
     ORDER BY time`
  ).all();

  res.json({ success: true, slots: rows });
});

// страница админки
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ===== START =====
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
