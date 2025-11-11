<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Запись на консультацию</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --bg-gradient: linear-gradient(135deg, #0f172a, #111827, #1f2937);
      --accent: #6366f1;
      --accent-soft: rgba(99,102,241,0.14);
      --text-main: #e5e7eb;
      --text-muted: #9ca3af;
      --radius-xl: 22px;
      --radius-md: 14px;
      --transition-fast: 0.18s ease;
      --border-soft: rgba(148,163,253,0.26);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, -sans-serif;
      background: var(--bg-gradient);
      color: var(--text-main);
      display: flex;
      justify-content: center;
      padding: 32px 16px;
    }

    .shell {
      width: 100%;
      max-width: 1080px;
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(280px, 2fr);
      gap: 24px;
      align-items: flex-start;
    }

    @media (max-width: 800px) {
      .shell {
        grid-template-columns: 1fr;
      }
    }

    .card {
      background: radial-gradient(circle at top left, rgba(148,163,253,0.08), transparent),
                  rgba(15,23,42,0.98);
      border-radius: var(--radius-xl);
      padding: 22px 20px 20px;
      border: 1px solid rgba(75,85,99,0.7);
      box-shadow: 0 24px 80px rgba(15,23,42,0.85);
      backdrop-filter: blur(18px);
    }

    .headline {
      font-size: 26px;
      font-weight: 600;
      margin: 0 0 6px;
      letter-spacing: 0.01em;
    }

    .subtitle {
      margin: 0 0 14px;
      font-size: 14px;
      color: var(--text-muted);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 9px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 11px;
      margin-bottom: 10px;
    }

    /* СЛОТЫ */

    #slots {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
      gap: 8px;
      margin-top: 10px;
    }

    .day-label {
      grid-column: 1 / -1;
      margin-top: 14px;
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.14em;
    }

    .slot-btn {
      padding: 7px 8px;
      border-radius: 12px;
      border: 1px solid rgba(75,85,99,0.9);
      background: rgba(15,23,42,0.98);
      color: var(--text-main);
      font-size: 13px;
      cursor: pointer;
      transition: all var(--transition-fast);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      white-space: nowrap;
    }

    .slot-btn span {
      font-size: 10px;
      color: var(--accent);
    }

    .slot-btn:hover {
      border-color: var(--accent);
      box-shadow: 0 6px 22px rgba(79,70,229,0.35);
      transform: translateY(-1px);
      background: rgba(15,23,42,1);
    }

    .slot-empty {
      color: var(--text-muted);
      font-size: 13px;
      margin-top: 10px;
    }

    /* ФОРМА */

    .form-card {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .label {
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 2px;
    }

    .input, .select-row {
      width: 100%;
      padding: 8px 10px;
      border-radius: 12px;
      border: 1px solid rgba(75,85,99,0.9);
      background: rgba(9,9,11,0.98);
      color: var(--text-main);
      font-size: 13px;
      outline: none;
      transition: all var(--transition-fast);
    }

    .input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px rgba(99,102,241,0.25);
    }

    .select-row {
      display: flex;
      gap: 8px;
      padding: 6px;
      align-items: center;
    }

    .radio-pill {
      flex: 1;
      padding: 6px 8px;
      border-radius: 999px;
      background: transparent;
      border: 1px solid rgba(75,85,99,0.9);
      font-size: 11px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      transition: all var(--transition-fast);
      justify-content: center;
    }

    .radio-pill input {
      display: none;
    }

    .radio-pill.active {
      border-color: var(--accent);
      background: var(--accent-soft);
      color: var(--accent);
      box-shadow: 0 6px 18px rgba(79,70,229,0.4);
    }

    .selected-slot {
      font-size: 12px;
      color: var(--accent);
      margin-bottom: 4px;
    }

    .submit-btn {
      margin-top: 4px;
      padding: 9px 12px;
      border-radius: 14px;
      border: none;
      background: linear-gradient(90deg, #6366f1, #8b5cf6);
      color: white;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-fast);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      justify-content: center;
    }

    .submit-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 14px 40px rgba(79,70,229,0.55);
    }

    #message {
      min-height: 18px;
      font-size: 12px;
      margin-top: 4px;
    }
    .success { color: #22c55e; }
    .error { color: #f97316; }

    /* Правая колонка */

    .side-title {
      font-size: 16px;
      font-weight: 500;
      margin-bottom: 6px;
    }
    .side-text {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 16px;
    }
    .side-list {
      list-style: none;
      padding: 0;
      margin: 0;
      font-size: 12px;
      color: var(--text-muted);
    }
    .side-list li {
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: var(--accent);
    }
  </style>
</head>
<body>
<div class="shell">

  <!-- Левая: слоты -->
  <div class="card">
    <div class="badge">Онлайн-запись · свободные слоты на неделю</div>
    <h1 class="headline">Выберите удобное время консультации</h1>
    <p class="subtitle">
      Заполните данные, выберите мессенджер — мы напишем вам для подтверждения.
    </p>

    <div id="slots"></div>
    <div id="slots-empty" class="slot-empty" style="display:none;">
      На ближайшую неделю нет свободных слотов.
    </div>
  </div>

  <!-- Правая: форма -->
  <div class="card form-card">
    <div id="selected-slot" class="selected-slot">
      Слот ещё не выбран.
    </div>

    <label class="label" for="name">Ваше имя</label>
    <input id="name" class="input" type="text" placeholder="Как к вам обращаться?" required>

    <label class="label" for="phone">Телефон для связи</label>
    <input id="phone" class="input" type="tel" placeholder="+7 900 000-00-00" required>

    <label class="label" for="email">Email (для резервной связи)</label>
    <input id="email" class="input" type="email" placeholder="name@example.com" required>

    <div class="label">Где удобнее написать?</div>
    <div class="select-row" id="contact-select">
      <label class="radio-pill active">
        <input type="radio" name="contact" value="whatsapp" checked>
        WhatsApp
      </label>
      <label class="radio-pill">
        <input type="radio" name="contact" value="telegram">
        Telegram
      </label>
    </div>

    <button class="submit-btn" id="submit-btn">
      Забронировать слот
    </button>
    <div id="message"></div>
  </div>

</div>

<script src="script.js"></script>
</body>
</html>
