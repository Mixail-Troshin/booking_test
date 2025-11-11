const daysStrip = document.getElementById('days');
const slotsContainer = document.getElementById('slots');
const slotsEmpty = document.getElementById('slots-empty');
const selectedSlotDiv = document.getElementById('selected-slot');
const messageDiv = document.getElementById('message');
const submitBtn = document.getElementById('submit-btn');
const contactSelect = document.getElementById('contact-select');

let currentDate = null;
let selectedSlotId = null;
let selectedSlotLabel = null;

// Переключение WhatsApp / Telegram
if (contactSelect) {
  contactSelect.addEventListener('click', (e) => {
    const pill = e.target.closest('.radio-pill');
    if (!pill) return;
    contactSelect.querySelectorAll('.radio-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    const input = pill.querySelector('input');
    if (input) input.checked = true;
  });
}

function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${String(d).padStart(2,'0')}.${String(m).padStart(2,'0')}`;
}

function weekdayRu(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][dt.getDay()];
}

function renderDays(dates) {
  daysStrip.innerHTML = '';
  if (!dates.length) {
    if (slotsEmpty) {
      slotsEmpty.style.display = 'block';
      slotsEmpty.textContent = 'Нет доступных дат для записи.';
    }
    return;
  }

  dates.forEach((date, idx) => {
    const pill = document.createElement('div');
    pill.className = 'day-pill';
    pill.dataset.date = date;
    pill.innerHTML = `
      <span class="weekday">${weekdayRu(date)}</span>
      <span class="date">${formatDateLabel(date)}</span>
    `;
    if (idx === 0) {
      pill.classList.add('active');
      currentDate = date;
    }
    pill.addEventListener('click', () => {
      currentDate = date;
      selectedSlotId = null;
      selectedSlotLabel = null;
      if (selectedSlotDiv) selectedSlotDiv.textContent = 'Слот ещё не выбран.';
      if (messageDiv) {
        messageDiv.textContent = '';
        messageDiv.className = '';
      }
      document.querySelectorAll('.day-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      loadSlotsForDay(date);
    });
    daysStrip.appendChild(pill);
  });
}

async function initCalendar() {
  try {
    const res = await fetch('/api/dates');
    const dates = await res.json();
    renderDays(dates);
    if (dates.length) {
      await loadSlotsForDay(dates[0]);
    } else {
      slotsContainer.innerHTML = '';
    }
  } catch (err) {
    console.error(err);
    if (slotsEmpty) {
      slotsEmpty.style.display = 'block';
      slotsEmpty.textContent = 'Ошибка загрузки дат.';
    }
  }
}

async function loadSlotsForDay(date) {
  slotsContainer.innerHTML = 'Загрузка...';
  if (slotsEmpty) {
    slotsEmpty.style.display = 'none';
    slotsEmpty.textContent = '';
  }

  try {
    const res = await fetch('/api/slots?date=' + encodeURIComponent(date));
    const slots = await res.json();
    slotsContainer.innerHTML = '';

    if (!slots.length) {
      if (slotsEmpty) {
        slotsEmpty.style.display = 'block';
        slotsEmpty.textContent = 'На этот день свободных слотов нет.';
      }
      return;
    }

    slots.forEach(s => {
      const [, timeStr] = s.time.split(' ');
      const btn = document.createElement('button');
      btn.className = 'slot-btn';
      btn.textContent = timeStr;
      btn.addEventListener('click', () => {
        selectedSlotId = s.id;
        selectedSlotLabel = s.time;

        if (selectedSlotDiv) {
          selectedSlotDiv.textContent = `Вы выбрали: ${s.time}`;
        }
        if (messageDiv) {
          messageDiv.textContent = '';
          messageDiv.className = '';
        }

        document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      slotsContainer.appendChild(btn);
    });
  } catch (err) {
    console.error(err);
    slotsContainer.innerHTML = '';
    if (slotsEmpty) {
      slotsEmpty.style.display = 'block';
      slotsEmpty.textContent = 'Ошибка загрузки слотов.';
    }
  }
}

if (submitBtn) {
  submitBtn.addEventListener('click', async () => {
    if (!selectedSlotId) {
      messageDiv.textContent = 'Сначала выберите день и время.';
      messageDiv.className = 'error';
      return;
    }

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const contactMethod = document.querySelector('input[name="contact"]:checked')?.value;

    if (!name || !email || !phone || !contactMethod) {
      messageDiv.textContent = 'Заполните все поля.';
      messageDiv.className = 'error';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Бронируем...';

    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId: selectedSlotId, name, email, phone, contactMethod })
      });
      const data = await res.json();

      if (data.success) {
        messageDiv.textContent = data.message;
        messageDiv.className = 'success';
        await initCalendar();
        document.getElementById('name').value = '';
        document.getElementById('email').value = '';
        document.getElementById('phone').value = '';
        selectedSlotId = null;
        selectedSlotLabel = null;
        selectedSlotDiv.textContent = 'Слот ещё не выбран.';
      } else {
        messageDiv.textContent = data.message || 'Ошибка бронирования.';
        messageDiv.className = 'error';
        if (res.status === 409) {
          await initCalendar();
        }
      }
    } catch (err) {
      console.error(err);
      messageDiv.textContent = 'Ошибка сервера. Попробуйте ещё раз.';
      messageDiv.className = 'error';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Забронировать слот';
    }
  });
}

initCalendar();
