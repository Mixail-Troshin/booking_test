const slotsContainer = document.getElementById('slots');
const form = document.getElementById('booking-form');
const selectedSlotDiv = document.getElementById('selected-slot');
const messageDiv = document.getElementById('message');

let selectedSlotId = null;

async function loadSlots() {
  slotsContainer.textContent = 'Загрузка слотов...';
  form.style.display = 'none';
  messageDiv.textContent = '';
  messageDiv.className = '';

  try {
    const res = await fetch('/api/slots');
    const slots = await res.json();

    slotsContainer.innerHTML = '';

    if (!slots.length) {
      slotsContainer.textContent = 'Свободных слотов нет.';
      return;
    }

    slots.forEach(slot => {
      const btn = document.createElement('button');
      btn.className = 'slot-btn';

      const label = slot.time.includes(' ')
        ? slot.time.split(' ')[1]
        : slot.time;

      btn.textContent = label;
      btn.onclick = () => selectSlot(slot.id, slot.time);
      slotsContainer.appendChild(btn);
    });
  } catch (err) {
    console.error(err);
    slotsContainer.textContent = 'Ошибка загрузки слотов.';
  }
}

function selectSlot(id, time) {
  selectedSlotId = id;
  selectedSlotDiv.textContent = `Вы выбрали: ${time}`;
  form.style.display = 'block';
  messageDiv.textContent = '';
  messageDiv.className = '';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedSlotId) return;

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();

  messageDiv.textContent = '';
  messageDiv.className = '';

  try {
    const res = await fetch('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId: selectedSlotId, name, email })
    });

    const data = await res.json();

    if (data.success) {
      messageDiv.textContent = data.message;
      messageDiv.className = 'success';
      await loadSlots();
      form.reset();
      form.style.display = 'none';
      selectedSlotId = null;
    } else {
      messageDiv.textContent = data.message || 'Ошибка бронирования';
      messageDiv.className = 'error';
      if (res.status === 409) {
        await loadSlots();
      }
    }
  } catch (err) {
    console.error(err);
    messageDiv.textContent = 'Ошибка запроса к серверу';
    messageDiv.className = 'error';
  }
});

loadSlots();
