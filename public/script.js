// Элементы
const slotsContainer = document.getElementById('slots');
const slotsEmpty = document.getElementById('slots-empty');
const selectedSlotDiv = document.getElementById('selected-slot');
const messageDiv = document.getElementById('message');
const submitBtn = document.getElementById('submit-btn');
const contactSelect = document.getElementById('contact-select');

let selectedSlotId = null;
let selectedSlotLabel = null;

// Визуальное переключение WhatsApp / Telegram
if (contactSelect) {
  contactSelect.addEventListener('click', (e) => {
    const pill = e.target.closest('.radio-pill');
    if (!pill) return;
    contactSelect.querySelectorAll('.radio-pill')
      .forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    const input = pill.querySelector('input');
    if (input) input.checked = true;
  });
}

// Группируем слоты по дате
function groupByDate(slots) {
  const map = {};
  slots.forEach(s => {
    const [dateStr, timeStr] = s.time.split(' ');
    if (!map[dateStr]) map[dateStr] = [];
    map[dateStr].push({ id: s.id, timeStr, full: s.time });
  });
  return map;
}

// Форматируем дату вида YYYY-MM-DD в DD.MM
function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return `${String(d).padStart(2,'0')}.${String(m).padStart(2,'0')}`;
}

// Загружаем и отрисовываем слоты
async function loadSlots() {
  if (!slotsContainer) return;

  slotsContainer.textContent = 'Загрузка слотов...';
  if (slotsEmpty) slotsEmpty.style.display = 'none';
  selectedSlotId = null;
  selectedSlotLabel = null;
  if (selectedSlotDiv) selectedSlotDiv.textContent = 'Слот ещё не выбран.';
  if (messageDiv) {
    messageDiv.textContent = '';
    messageDiv.className = '';
  }

  try {
    const res = await fetch('/api/slots');
    const slots = await res.json();

    slotsContainer.innerHTML = '';

    if (!slots.length) {
      if (slotsEmpty) {
        slotsEmpty.style.display = 'block';
        slotsEmpty.textContent = 'На ближайшую неделю нет свободных слотов.';
      }
      return;
    }

    const grouped = groupByDate(slots);

    Object.keys(grouped).forEach(dateStr => {
      // Заголовок дня
      const day = document.createElement('div');
      day.className = 'day-label';
      day.textContent = `День ${formatDateLabel(dateStr)}`;
      slotsContainer.appendChild(day);

      // Кнопки слотов
      grouped[dateStr].forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'slot-btn';
        btn.innerHTML = `${s.timeStr}<span>${formatDateLabel(dateStr)}</span>`;
        btn.addEventListener('click', () => {
          selectedSlotId = s.id;
          selectedSlotLabel = `${dateStr} ${s.timeStr}`;
          if (selectedSlotDiv) {
            selectedSlotDiv.textContent = `Вы выбрали: ${selectedSlotLabel}`;
          }
          if (messageDiv) {
            messageDiv.textContent = '';
            messageDiv.className = '';
          }
        });
        slotsContainer.appendChild(btn);
      });
    });
  } catch (err) {
    console.error('Ошибка загрузки слотов:', err);
    slotsContainer.innerHTML = '';
    if (slotsEmpty) {
      slotsEmpty.style.display = 'block';
      slotsEmpty.textContent = 'Ошибка загрузки слотов.';
    }
  }
}

// Отправка брони
if (submitBtn) {
  submitBtn.addEventListener('click', async () => {
    if (!selectedSlotId) {
      messageDiv.textContent = 'Сначала выберите время.';
      messageDiv.className = 'error';
      return;
    }

    const name = document.getElementById('name')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const phone = document.getElementById('phone')?.value.trim();
    const contactMethod = document.querySelector('input[name="contact"]:checked')?.value;

    if (!name || !email || !phone || !contactMethod) {
      messageDiv.textContent = 'Пожалуйста, заполните все поля.';
      messageDiv.className = 'error';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправляем...';

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
        // обновляем слоты
        await loadSlots();
        // чистим форму
        document.getElementById('name').value = '';
        document.getElementById('email').value = '';
        document.getElementById('phone').value = '';
      } else {
        messageDiv.textContent = data.message || 'Ошибка бронирования.';
        messageDiv.className = 'error';
        if (res.status === 409) {
          await loadSlots();
        }
      }
    } catch (err) {
      console.error('Ошибка при бронировании:', err);
      messageDiv.textContent = 'Ошибка сервера. Попробуйте ещё раз.';
      messageDiv.className = 'error';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Забронировать слот';
    }
  });
}

// Старт
loadSlots();
