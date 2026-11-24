(() => {
  const form = document.getElementById('open-link-form');
  const input = document.getElementById('url-input');
  const statusEl = document.getElementById('status-msg');
  const openBtn = document.getElementById('open-btn');
  const cancelBtn = document.getElementById('cancel-btn');

  let isSubmitting = false;

  function setStatus(text, type) {
    statusEl.textContent = text || '';
    statusEl.className = 'status-row';
    if (type === 'loading') {
      statusEl.classList.add('status-loading');
    } else if (type === 'error') {
      statusEl.classList.add('status-error');
    }
  }

  function setBusy(busy) {
    isSubmitting = busy;
    openBtn.disabled = busy;
    cancelBtn.disabled = busy;
    input.disabled = busy;
  }

  async function init() {
    try {
      const initial = await window.yakChatOpenLink.getInitialValue();
      if (initial) {
        input.value = initial;
      }
    } catch (_) {}
    input.focus();
    input.select();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const value = input.value.trim();
    if (!value) {
      setStatus('Introduce una URL de WhatsApp o un número de teléfono válido.', 'error');
      input.focus();
      return;
    }

    setBusy(true);
    setStatus('Resolviendo enlace...', 'loading');

    try {
      const result = await window.yakChatOpenLink.submit(value);
      if (!result || !result.ok) {
        setBusy(false);
        setStatus(
          (result && result.error) || 'No se pudo resolver o validar el enlace proporcionado.',
          'error'
        );
        input.focus();
        input.select();
      }
    } catch (err) {
      setBusy(false);
      setStatus(`Error: ${err.message || 'No se pudo abrir el enlace.'}`, 'error');
      input.focus();
    }
  });

  cancelBtn.addEventListener('click', () => {
    if (!isSubmitting) {
      window.yakChatOpenLink.cancel();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !isSubmitting) {
      window.yakChatOpenLink.cancel();
    }
  });

  init();
})();
