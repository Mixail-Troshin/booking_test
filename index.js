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

const TELEMOST_TOKEN = process.env.TELEMOST_TOKEN || ''; // OAuth-токен Telemost

// ===== EMAIL TRANSPORT =====
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

// ===== APP MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== DB =====
const db = new Database('slots.db');

db.prepare(`
  CREATE TABLE IF NOT EXISTS slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TEXT NOT NULL,
    booked INTEGER NOT NULL DEFAULT 0,
    name TEXT,
    email TEXT,
    phone TEXT,
    contact_method TEXT,
    meeting_url TEXT,
    reminder_sent INTEGER NOT NULL DEFAULT 0
  )
`).run();

// на случай старых схем
try { db.prepare('ALTER TABLE slots ADD COLUMN meeting_url TEXT').run(); } catch {}
try { db.prepare('ALTER TABLE slots ADD COLUMN reminder_sent INTEGER NOT NULL DEFAULT 0').run(); } catch {}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function* timeRange(startTime, endTime, stepMinutes) {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let cur = sh * 60 + sm;
  const end = eh * 60 + em;
  while (cur <= end) {
    const h = String(Math.floor(cur / 60)).padStart(2, '0');
    const m = String(cur % 60).padStart(2, '0');
    yield `${h}:${m}`;
    cur += stepMinutes;
  }
}

// если слотов нет — создаём дефолт на 7 дней
function ensureDefaultSlots() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM slots').get().c;
  if (count > 0) return;

  const insert = db.prepare('INSERT INTO slots (time) VALUES (?)');
  const today = new Date();
  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    const dateStr = formatDate(d);
    for (const t of timeRange('10:00', '15:30', 30)) {
      insert.run(`${dateStr} ${t}`);
    }
  }
  console.log('Созданы дефолтные слоты на 7 дней');
}
ensureDefaultSlots();

// ===== TELEMOST =====
async function createTelemostConference() {
  if (!TELEMOST_TOKEN) return null;

  try {
    const resp = await fetch('https://cloud-api.yandex.net/v1/telemost-api/conferences', {
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${TELEMOST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        waiting_room_level: 'PUBLIC'
      })
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('Telemost create error:', resp.status, text);
      return null;
    }

    const data = await resp.json();
    return data.join_url || null;
  } catch (e) {
    console.error('Telemost exception:', e);
    return null;
  }
}

// ===== PUBLIC API =====

// Доступные даты (есть свободные слоты)
app.get('/api/dates', (req, res) => {
  const rows = db.prepare(
    `SELECT DISTINCT substr(time,1,10) AS date
     FROM slots
     WHERE booked = 0
     ORDER BY date`
  ).all();
  res.json(rows.map(r => r.date));
});

// Свободные слоты по дате
app.get('/api/slots', (req, res) => {
  const date = req.query.date;
  let rows;
  if (date) {
    rows = db.prepare(
      `SELECT id, time
       FROM slots
       WHERE booked = 0
         AND time LIKE ? || '%'
       ORDER BY time`
    ).all(date);
  } else {
    rows = db.prepare(
      `SELECT id, time
       FROM slots
       WHERE booked = 0
       ORDER BY time`
    ).all();
  }
  res.json(rows);
});

// Бронирование слота
app.post('/api/book', async (req, res) => {
  const { slotId, name, email, phone, contactMethod } = req.body || {};

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

  // создаём Telemost
  const meetingUrl = await createTelemostConference();

  const upd = db.prepare(`
    UPDATE slots
    SET booked = 1,
        name = ?,
        email = ?,
        phone = ?,
        contact_method = ?,
        meeting_url = ?
    WHERE id = ? AND booked = 0
  `).run(name, email, phone, contactMethod, meetingUrl || null, slotId);

  if (upd.changes === 0) {
    return res.status(409).json({ success: false, message: 'Слот уже занят.' });
  }

  const slotTime = slot.time;

  // письма
  if (transporter) {
    const linkText = meetingUrl ? `\nСсылка на встречу: ${meetingUrl}` : '';
    const userText =
      `Вы записаны на встречу ${slotTime}.\n` +
      `Мы свяжемся с вами в ${contactMethod} по номеру ${phone}.${linkText}`;

    const adminText =
      `Новая запись:\n` +
      `Время: ${slotTime}\n` +
      `Имя: ${name}\n` +
      `Email: ${email}\n` +
      `Телефон: ${phone}\n` +
      `Способ связи: ${contactMethod}\n` +
      (meetingUrl ? `Ссылка Telemost: ${meetingUrl}\n` : '');

    transporter.sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: 'Подтверждение записи на встречу',
      text: userText
    }).catch(e => console.error('Mail user error:', e.message));

    transporter.sendMail({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: 'Новая запись на встречу',
      text: adminText
    }).catch(e => console.error('Mail admin error:', e.message));
  }

  res.json({
    success: true,
    message: 'Вы успешно записаны!' + (meetingUrl ? ' Ссылка отправлена на почту.' : '')
  });
});

// ===== ADMIN API =====

// Получить все слоты
app.get('/api/admin/slots', (req, res) => {
  const key = req.query.key;
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Нет доступа' });
  }

  const rows = db.prepare(
    `SELECT id, time, booked, name, email, phone, contact_method, meeting_url
     FROM slots
     ORDER BY time`
  ).all();

  res.json({ success: true, slots: rows });
});

// Обновить расписание
app.post('/api/admin/schedule', (req, res) => {
  const { key, startDate, endDate, startTime, endTime, stepMinutes, weekdaysOnly } = req.body || {};
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Нет доступа' });
  }
  if (!startDate || !endDate || !startTime || !endTime || !stepMinutes) {
    return res.status(400).json({ success: false, message: 'Не хватает параметров' });
  }

  db.prepare('DELETE FROM slots').run();

  const insert = db.prepare('INSERT INTO slots (time) VALUES (?)');
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay(); // 0 вс, 6 сб
    if (weekdaysOnly && (day === 0 || day === 6)) continue;
    const dateStr = formatDate(d);
    for (const t of timeRange(startTime, endTime, Number(stepMinutes))) {
      insert.run(`${dateStr} ${t}`);
    }
  }

  console.log('Расписание обновлено админом');
  res.json({ success: true, message: 'Расписание обновлено' });
});

// Напоминания за час (дергается кроном)
app.post('/api/admin/send-reminders', async (req, res) => {
  const { key } = req.body || {};
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Нет доступа' });
  }
  if (!transporter) {
    return res.status(400).json({ success: false, message: 'SMTP не настроен' });
  }

  const now = new Date();
  const inHour = new Date(now.getTime() + 60 * 60 * 1000);

  const rows = db.prepare(
    `SELECT id, time, name, email, meeting_url
     FROM slots
     WHERE booked = 1 AND reminder_sent = 0`
  ).all();

  let processed = 0;

  for (const s of rows) {
    const [datePart, timePart] = s.time.split(' ');
    const [y, m, d] = datePart.split('-').map(Number);
    const [hh, mm] = timePart.split(':').map(Number);
    const dt = new Date(y, m - 1, d, hh, mm);

    if (dt > now && dt <= inHour) {
      const linkText = s.meeting_url ? `\nСсылка на встречу: ${s.meeting_url}` : '';
      const textUser =
        `Напоминание: ваша встреча запланирована на ${s.time} (через ~1 час).${linkText}`;
      const textAdmin =
        `Напоминание: через час встреча с ${s.name} в ${s.time}.${linkText}`;

      try {
        await transporter.sendMail({
          from: FROM_EMAIL,
          to: s.email,
          subject: 'Напоминание о встрече',
          text: textUser
        });
        await transporter.sendMail({
          from: FROM_EMAIL,
          to: ADMIN_EMAIL,
          subject: 'Напоминание о встрече с клиентом',
          text: textAdmin
        });
        db.prepare('UPDATE slots SET reminder_sent = 1 WHERE id = ?').run(s.id);
        processed++;
      } catch (e) {
        console.error('Reminder mail error:', e.message);
      }
    }
  }

  res.json({ success: true, processed });
});

// Страница админки
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Healthcheck (на всякий случай)
app.get('/healthz', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
