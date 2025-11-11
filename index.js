const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== ENV =====
const ADMIN_KEY = process.env.ADMIN_KEY || 'changeme';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'mikhail.tr0shin@yandex.ru';
const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP || '79500333077'; // без +

const TELEMOST_TOKEN = process.env.TELEMOST_TOKEN || ''; // OAuth-токен Telemost

// PHP-почтовый шлюз
const MAIL_ENDPOINT = process.env.MAIL_ENDPOINT || '';
const MAIL_SECRET = process.env.MAIL_SECRET || '';

// Wazzup
const WAZZUP_API_KEY = process.env.WAZZUP_API_KEY || '';
const WAZZUP_CHANNEL_ID = process.env.WAZZUP_CHANNEL_ID || ''; // UUID канала WhatsApp

// ===== MIDDLEWARE =====
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

// ===== ВСПОМОГАТЕЛЬНОЕ =====

function normalizePhoneToDigits(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  // если начинается с 8 и длина 11, меняем на 7
  if (digits.length === 11 && digits[0] === '8') {
    return '7' + digits.slice(1);
  }
  // если начинается с 7 и 11 цифр — ок
  if (digits.length === 11 && digits[0] === '7') {
    return digits;
  }
  // если 10 цифр — добавим 7
  if (digits.length === 10) {
    return '7' + digits;
  }
  return digits;
}

// ===== ПОЧТА ЧЕРЕЗ PHP (galaxytap.ru/mymail.php) =====

async function sendViaPhpMail({ toEmail, subject, text, html }) {
  if (!MAIL_ENDPOINT || !MAIL_SECRET) {
    console.log('PHP mail endpoint не настроен');
    return false;
  }
  if (!toEmail) return false;

  try {
    const body = new URLSearchParams({
      secret: MAIL_SECRET,
      to: toEmail,
      subject,
      text,
      html: html || ''
    });

    const resp = await fetch(MAIL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    const txt = await resp.text();

    if (!resp.ok || txt.trim() !== 'OK') {
      console.error('PHP mail error:', resp.status, txt);
      return false;
    }

    console.log('PHP mail sent to', toEmail);
    return true;
  } catch (e) {
    console.error('PHP mail exception:', e);
    return false;
  }
}

async function sendBookingEmails({ name, email, phone, slotTime, contactMethod, meetingUrl }) {
  const safeName = name || 'клиент';
  const linkBlock = meetingUrl
    ? `<p><b>Ссылка на встречу:</b> <a href="${meetingUrl}">${meetingUrl}</a></p>`
    : '';

  const userSubject = 'Подтверждение записи на встречу';
  const userHtml = `
    <h2>Вы записаны на встречу</h2>
    <p>Здравствуйте, ${safeName}!</p>
    <p><b>Дата и время:</b> ${slotTime}</p>
    <p><b>Способ связи:</b> ${contactMethod}</p>
    <p><b>Телефон:</b> ${phone}</p>
    ${linkBlock}
    <p>До встречи!</p>
  `;

  const adminSubject = 'Новая запись на встречу';
  const adminHtml = `
    <h2>Новая запись на встречу</h2>
    <p><b>Имя:</b> ${safeName}</p>
    <p><b>Email:</b> ${email}</p>
    <p><b>Телефон:</b> ${phone}</p>
    <p><b>Способ связи:</b> ${contactMethod}</p>
    <p><b>Дата и время:</b> ${slotTime}</p>
    ${linkBlock}
  `;

  await sendViaPhpMail({
    toEmail: email,
    subject: userSubject,
    text: `Вы записаны на встречу ${slotTime}. ${meetingUrl ? 'Ссылка: ' + meetingUrl : ''}`,
    html: userHtml
  });

  await sendViaPhpMail({
    toEmail: ADMIN_EMAIL,
    subject: adminSubject,
    text:
      `Новая запись на встречу ${slotTime}\n` +
      `Имя: ${safeName}\nEmail: ${email}\nТелефон: ${phone}\n` +
      (meetingUrl ? 'Ссылка: ' + meetingUrl : ''),
    html: adminHtml
  });
}

async function sendReminderEmails({ name, email, slotTime, meetingUrl }) {
  const safeName = name || 'клиент';
  const linkBlock = meetingUrl
    ? `<p><b>Ссылка на встречу:</b> <a href="${meetingUrl}">${meetingUrl}</a></p>`
    : '';

  const subjectUser = 'Напоминание о встрече';
  const htmlUser = `
    <h2>Напоминание</h2>
    <p>Здравствуйте, ${safeName}!</p>
    <p>Через час у вас встреча:</p>
    <p><b>${slotTime}</b></p>
    ${linkBlock}
  `;

  const subjectAdmin = 'Напоминание о встрече с клиентом';
  const htmlAdmin = `
    <h2>Напоминание о встрече</h2>
    <p>Через час встреча с ${safeName}.</p>
    <p><b>${slotTime}</b></p>
    ${linkBlock}
  `;

  await sendViaPhpMail({
    toEmail: email,
    subject: subjectUser,
    text: `Напоминание о встрече через час: ${slotTime} ${meetingUrl ? 'Ссылка: ' + meetingUrl : ''}`,
    html: htmlUser
  });

  await sendViaPhpMail({
    toEmail: ADMIN_EMAIL,
    subject: subjectAdmin,
    text: `Через час встреча с ${safeName} в ${slotTime} ${meetingUrl ? 'Ссылка: ' + meetingUrl : ''}`,
    html: htmlAdmin
  });
}

// ===== WAZZUP (WhatsApp) =====

async function sendWazzupMessage({ toPhone, text }) {
  if (!WAZZUP_API_KEY || !WAZZUP_CHANNEL_ID) {
    console.log('Wazzup не настроен');
    return false;
  }

  const chatId = normalizePhoneToDigits(toPhone);
  if (!chatId) {
    console.log('Wazzup: некорректный номер', toPhone);
    return false;
  }

  const body = {
    channelId: WAZZUP_CHANNEL_ID,
    chatType: 'whatsapp',
    chatId,
    text,
    clearUnanswered: false
  };

  try {
    const resp = await fetch('https://api.wazzup24.com/v3/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WAZZUP_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    const data = await resp.text();

    if (!resp.ok) {
      console.error('Wazzup error:', resp.status, data);
      return false;
    }

    console.log('Wazzup message ok ->', chatId);
    return true;
  } catch (e) {
    console.error('Wazzup exception:', e);
    return false;
  }
}

async function sendWazzupNotifications({ name, phone, slotTime, meetingUrl }) {
  const safeName = name || 'клиент';
  const userPhone = phone ? normalizePhoneToDigits(phone) : '';
  const adminPhone = ADMIN_WHATSAPP;

  const linkText = meetingUrl ? ` Ссылка: ${meetingUrl}` : '';

  // Клиенту (если указал телефон)
  if (userPhone) {
    const textUser =
      `Вы записаны на встречу ${slotTime}.` +
      ` Если нужно изменить время — просто ответьте на это сообщение.` +
      `${linkText ? ' ' + linkText : ''}`;
    await sendWazzupMessage({ toPhone: userPhone, text: textUser });
  }

  // Тебе
  const textAdmin =
    `Новая запись: ${safeName}, ${phone || 'без телефона'}, ${slotTime}.` +
    (meetingUrl ? ` Телемост: ${meetingUrl}` : '');
  await sendWazzupMessage({ toPhone: adminPhone, text: textAdmin });
}

// ===== TELEMOST =====

async function createTelemostConference() {
  if (!TELEMOST_TOKEN) {
    console.log('Telemost: TELEMOST_TOKEN не задан, пропускаем создание встречи');
    return null;
  }

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

    if (resp.status === 201) {
      const data = await resp.json();
      console.log('Telemost: встреча создана', data.join_url);
      return data.join_url || null;
    }

    const text = await resp.text();
    console.error('Telemost create error:', resp.status, text);
    return null;
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

  // отмечаем слот
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

  // E-mail нотификации
  await sendBookingEmails({
    name,
    email,
    phone,
    slotTime,
    contactMethod,
    meetingUrl
  });

  // WhatsApp нотификации (через Wazzup)
  await sendWazzupNotifications({
    name,
    phone,
    slotTime,
    meetingUrl
  });

  res.json({
    success: true,
    message: 'Вы успешно записаны! Подтверждение отправлено на email и в WhatsApp (если указан).'
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

// Напоминания за час
app.post('/api/admin/send-reminders', async (req, res) => {
  const { key } = req.body || {};
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Нет доступа' });
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
      await sendReminderEmails({
        name: s.name,
        email: s.email,
        slotTime: s.time,
        meetingUrl: s.meeting_url
      });
      db.prepare('UPDATE slots SET reminder_sent = 1 WHERE id = ?').run(s.id);
      processed++;
    }
  }

  res.json({ success: true, processed });
});

// Страница админки
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Healthcheck
app.get('/healthz', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
