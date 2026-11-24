// Autocorrector y Asistente de Ortografía en Español para YakChat
// Compatible con contenteditable (Lexical/Meta), inputs y textareas.
// Soporta corrección automática al pulsar Espacio o signos de puntuación,
// regla de reversión inmediata con Retroceso (Backspace), atajo Alt+O,
// persistencia de mayúsculas/minúsculas y preservación de pila de deshacer (Ctrl+Z).

const { ipcRenderer } = require('electron');

// 1. Diccionario de palabras de altísima frecuencia en español y erratas comunes
const STATIC_DICT = {
  // Erratas y sustituciones de teclado comunes
  'espanhol': 'español',
  'espanhola': 'española',
  'espanholes': 'españoles',
  'espanholas': 'españolas',
  'espanol': 'español',
  'espanola': 'española',
  'espanoles': 'españoles',
  'espanolas': 'españolas',
  'aver': 'a ver',
  'osea': 'o sea',
  'porfa': 'porfa',
  'tambn': 'también',
  'tmb': 'también',

  // Acentuación de palabras indispensables
  'tambien': 'también',
  'ademas': 'además',
  'despues': 'después',
  'aqui': 'aquí',
  'aca': 'acá',
  'alla': 'allá',
  'ahi': 'ahí',
  'asi': 'así',
  'alli': 'allí',
  'jamas': 'jamás',
  'quiza': 'quizá',
  'quizas': 'quizás',
  'ojala': 'ojalá',
  'facil': 'fácil',
  'faciles': 'fáciles',
  'dificil': 'difícil',
  'dificiles': 'difíciles',
  'util': 'útil',
  'utiles': 'útiles',
  'inutil': 'inútil',
  'inutiles': 'inútiles',
  'rapido': 'rápido',
  'rapida': 'rápida',
  'rapidos': 'rápidos',
  'rapidas': 'rápidas',
  'rapidamente': 'rápidamente',
  'facilmente': 'fácilmente',
  'dificilmente': 'difícilmente',
  'utilmente': 'útilmente',
  'comunmente': 'comúnmente',
  'unicamente': 'únicamente',
  'ultimamente': 'últimamente',
  'practicamente': 'prácticamente',
  'basicamente': 'básicamente',
  'logicamente': 'lógicamente',
  'musica': 'música',
  'telefono': 'teléfono',
  'telefonos': 'teléfonos',
  'numero': 'número',
  'numeros': 'números',
  'dia': 'día',
  'dias': 'días',
  'ultimo': 'último',
  'ultima': 'última',
  'ultimos': 'últimos',
  'ultimas': 'últimas',
  'arbol': 'árbol',
  'arboles': 'árboles',
  'exito': 'éxito',
  'exitos': 'éxitos',
  'pagina': 'página',
  'paginas': 'páginas',
  'estandar': 'estándar',
  'estandares': 'estándares',
  'codigo': 'código',
  'codigos': 'códigos',
  'articulo': 'artículo',
  'articulos': 'artículos',
  'tecnico': 'técnico',
  'tecnica': 'técnica',
  'tecnicos': 'técnicos',
  'tecnicas': 'técnicas',
  'automatico': 'automático',
  'automatica': 'automática',
  'automaticos': 'automáticos',
  'automaticas': 'automáticas',
  'automaticamente': 'automáticamente',
  'logico': 'lógico',
  'logica': 'lógica',
  'critico': 'crítico',
  'critica': 'crítica',
  'publico': 'público',
  'publica': 'pública',
  'practico': 'práctico',
  'practica': 'práctica',
  'basico': 'básico',
  'basica': 'básica',
  'clasico': 'clásico',
  'clasica': 'clásica',
  'politico': 'político',
  'politica': 'política',
  'medico': 'médico',
  'medica': 'médica',
  'fisico': 'físico',
  'fisica': 'física',
  'quimico': 'químico',
  'quimica': 'química',
  'electronico': 'electrónico',
  'electronica': 'electrónica',
  'economico': 'económico',
  'economica': 'económica',
  'caracteristica': 'característica',
  'caracteristicas': 'características',
  'especifico': 'específico',
  'especifica': 'específica',
  'grafico': 'gráfico',
  'grafica': 'gráfica',
  'proximo': 'próximo',
  'proxima': 'próxima',
  'maximo': 'máximo',
  'maxima': 'máxima',
  'minimo': 'mínimo',
  'minima': 'mínima',
  'optimo': 'óptimo',
  'optima': 'óptima',
  'unico': 'único',
  'unica': 'única',
  'unicos': 'únicos',
  'unicas': 'únicas',
  'comun': 'común',
  'ningun': 'ningún',
  'algun': 'algún',
  'segun': 'según',
  'razon': 'razón',
  'corazon': 'corazón',
  'camion': 'camión',
  'avion': 'avión',
  'estacion': 'estación',
  'ingles': 'inglés',
  'frances': 'francés',
  'aleman': 'alemán',
  'portugues': 'portugués',
  'japones': 'japonés',
  'holandes': 'holandés',
  'irlandes': 'irlandés',
  'pais': 'país',
  'paises': 'países',
  'raiz': 'raíz',
  'raices': 'raíces',
  'maiz': 'maíz',
  'oido': 'oído',
  'oidos': 'oídos',
  'reir': 'reír',
  'sonreir': 'sonreír',
  'caida': 'caída',
  'leido': 'leído',
  'traido': 'traído',
  'creido': 'creído',
  'habia': 'había',
  'habian': 'habían',
  'habias': 'habías',
  'habiamos': 'habíamos',
  'tenia': 'tenía',
  'tenian': 'tenían',
  'tenias': 'tenías',
  'teniamos': 'teníamos',
  'podia': 'podía',
  'podian': 'podían',
  'podias': 'podías',
  'podiamos': 'podíamos',
  'debia': 'debía',
  'debian': 'debían',
  'debiamos': 'debíamos',
  'queria': 'quería',
  'querian': 'querían',
  'queriamos': 'queríamos',
  'sabia': 'sabía',
  'sabian': 'sabían',
  'sabiamos': 'sabíamos',
  'haria': 'haría',
  'harian': 'harían',
  'hariamos': 'haríamos',
  'seria': 'sería',
  'serian': 'serían',
  'seriamos': 'seríamos',
  'estaria': 'estaría',
  'estarian': 'estarían',
  'estariamos': 'estaríamos',
  'gustaria': 'gustaría',
  'gustarian': 'gustarían',
  'gustariamos': 'gustaríamos',
  'estabamos': 'estábamos',
  'ibamos': 'íbamos',
  'adios': 'adiós',
  'mama': 'mamá',
  'papa': 'papá',
  'bebe': 'bebé',
  'cafe': 'café',
  'menu': 'menú',
  'envio': 'envío',
  'envios': 'envíos',
  'guia': 'guía',
  'guias': 'guías',
  'linea': 'línea',
  'lineas': 'líneas',
  'area': 'área',
  'areas': 'áreas',
  'periodo': 'período',
  'miercoles': 'miércoles',
  'sabado': 'sábado',

  // Toponimia y geografía común
  'mexico': 'México',
  'peru': 'Perú',
  'panama': 'Panamá',
  'bogota': 'Bogotá',
  'medellin': 'Medellín',
  'asuncion': 'Asunción',
  'cordoba': 'Córdoba',
  'america': 'América',
  'africa': 'África',
  'oceania': 'Oceanía',
  'europa': 'Europa',
  'espana': 'España',
  'espanha': 'España'
};

// 2. Pronombres interrogativos/exclamativos cuando van dentro de preguntas (¿...?)
const INTERROGATIVES = {
  'como': 'cómo',
  'que': 'qué',
  'cuando': 'cuándo',
  'donde': 'dónde',
  'quien': 'quién',
  'quienes': 'quiénes',
  'cual': 'cuál',
  'cuales': 'cuáles',
  'cuanto': 'cuánto',
  'cuanta': 'cuánta',
  'cuantos': 'cuántos',
  'cuantas': 'cuántas'
};

function preserveCase(rawWord, replacement) {
  if (rawWord === rawWord.toUpperCase()) {
    return replacement.toUpperCase();
  }
  if (rawWord[0] === rawWord[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement.toLowerCase();
}

function getCorrectedWord(rawWord, contextBefore = '') {
  if (!rawWord || rawWord.length < 2) return null;
  // Ignorar palabras que contienen números o símbolos
  if (/\d/.test(rawWord)) return null;

  // Ignorar si estamos dentro de URL, email, mención o hashtag
  if (/[/@#:]/.test(contextBefore.slice(-10))) return null;
  if (/https?:\/\/\S*$/i.test(contextBefore)) return null;

  const lower = rawWord.toLowerCase();

  // 1. Coincidencia directa en diccionario
  if (STATIC_DICT[lower]) {
    return preserveCase(rawWord, STATIC_DICT[lower]);
  }

  // 2. Interrogativos dentro de oraciones con signo ¿
  const lastQuestionMark = contextBefore.lastIndexOf('¿');
  if (lastQuestionMark !== -1) {
    const afterQ = contextBefore.substring(lastQuestionMark);
    if (!afterQ.includes('?') && INTERROGATIVES[lower]) {
      return preserveCase(rawWord, INTERROGATIVES[lower]);
    }
  }

  // 3. Reglas morfológicas productivas del español:
  // - Palabras agudas terminadas en -ción, -sión, -gión (no plurales en -ciones)
  if (lower.length >= 5) {
    if (lower.endsWith('cion') && !lower.endsWith('ciones')) {
      return preserveCase(rawWord, lower.slice(0, -4) + 'ción');
    }
    if (lower.endsWith('sion') && !lower.endsWith('siones')) {
      return preserveCase(rawWord, lower.slice(0, -4) + 'sión');
    }
    if (lower.endsWith('gion') && !lower.endsWith('giones')) {
      return preserveCase(rawWord, lower.slice(0, -4) + 'gión');
    }
  }

  // - Esdrújulas y palabras con hiato acentual: -grafía, -logía, -metría, -scopía, -nomía
  if (lower.length >= 6) {
    if (lower.endsWith('grafia')) {
      return preserveCase(rawWord, lower.slice(0, -6) + 'grafía');
    }
    if (lower.endsWith('logia')) {
      return preserveCase(rawWord, lower.slice(0, -5) + 'logía');
    }
    if (lower.endsWith('metria')) {
      return preserveCase(rawWord, lower.slice(0, -6) + 'metría');
    }
    if (lower.endsWith('scopia')) {
      return preserveCase(rawWord, lower.slice(0, -6) + 'scopía');
    }
    if (lower.endsWith('nomia') && lower !== 'anomia') {
      return preserveCase(rawWord, lower.slice(0, -5) + 'nomía');
    }
  }

  // - Superlativos en -ísimo, -ísima, -ísimos, -ísimas
  if (lower.length >= 6) {
    const isimoMatch = lower.match(/^([a-zñ]+)isim([oa]s?)$/);
    if (isimoMatch) {
      return preserveCase(rawWord, isimoMatch[1] + 'ísim' + isimoMatch[2]);
    }
  }

  // - Palabras esdrújulas en -álisis
  if (lower.length >= 6 && lower.endsWith('alisis')) {
    return preserveCase(rawWord, lower.slice(0, -6) + 'álisis');
  }

  return null;
}

let autocorrectEnabled = true;
let autocorrectNotification = false;
let lastCorrection = null; // { original, corrected, time }

// Componente visual ligero para notificaciones tipo Toast
let toastElement = null;
let toastTimeout = null;

function showAutocorrectToast(message, isEnabled = true) {
  if (!toastElement) {
    toastElement = document.createElement('div');
    toastElement.id = 'wa-autocorrect-toast';
    toastElement.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: rgba(17, 27, 33, 0.94);
      color: #e9edef;
      border: 1px solid rgba(0, 168, 132, 0.4);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 10px;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.2s ease, transform 0.2s ease;
      pointer-events: none;
    `;
    document.body.appendChild(toastElement);
  }

  const icon = isEnabled ? '✍️' : '⏹️';
  toastElement.innerHTML = `<span style="font-size:16px;">${icon}</span><span>${message}</span>`;
  toastElement.style.borderColor = isEnabled ? 'rgba(0, 168, 132, 0.6)' : 'rgba(239, 68, 68, 0.4)';

  requestAnimationFrame(() => {
    toastElement.style.opacity = '1';
    toastElement.style.transform = 'translateY(0)';
  });

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    if (toastElement) {
      toastElement.style.opacity = '0';
      toastElement.style.transform = 'translateY(8px)';
    }
  }, 2200);
}

// 4. Forzar el atributo spellcheck="true" en todos los campos editables
function ensureSpellcheckOnActiveInputs() {
  try {
    const editables = document.querySelectorAll(
      '[contenteditable="true"], [contenteditable="plaintext-only"], input[type="text"], input:not([type]), textarea'
    );
    for (const el of editables) {
      if (el.getAttribute('spellcheck') !== 'true') {
        el.setAttribute('spellcheck', 'true');
        el.spellcheck = true;
      }
    }
  } catch (_) {}
}

function handleKeydown(e) {
  // Manejador del atajo Alt+O para conmutar el autocorrector rápidamente
  if (e.altKey && (e.key === 'o' || e.key === 'O' || e.code === 'KeyO')) {
    e.preventDefault();
    ipcRenderer.send('autocorrect-toggle');
    return;
  }

  if (!autocorrectEnabled) return;

  const target = e.target;
  const isContentEditable = target && target.isContentEditable;
  const isInputOrTextarea = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

  if (!isContentEditable && !isInputOrTextarea) return;

  // Reversión con tecla Retroceso (Backspace) estilo smartphone si se pulsa inmediatamente tras una autocorrección
  if (e.key === 'Backspace' && lastCorrection && (Date.now() - lastCorrection.time < 3000)) {
    e.preventDefault();
    document.execCommand('undo');
    lastCorrection = null;
    return;
  }

  // El autocorrector se activa al pulsar espacio o signos de puntuación delimitadores
  const isDelimiter = e.key === ' ' || e.key === '.' || e.key === ',' || e.key === '!' || e.key === '?' || e.key === ';' || e.key === ':';
  if (!isDelimiter) {
    lastCorrection = null;
    return;
  }

  if (isContentEditable) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    const offset = range.startOffset;

    if (node.nodeType === Node.TEXT_NODE) {
      const textBefore = node.textContent.substring(0, offset);
      const match = textBefore.match(/(?:^|\s|[^\p{L}\p{N}])([\p{L}\p{N}]+)$/u);
      if (match) {
        const rawWord = match[1];
        const prefix = textBefore.substring(0, offset - rawWord.length);
        const corrected = getCorrectedWord(rawWord, prefix);

        if (corrected && corrected !== rawWord) {
          e.preventDefault();
          const wordStart = offset - rawWord.length;
          const replaceRange = document.createRange();
          replaceRange.setStart(node, wordStart);
          replaceRange.setEnd(node, offset);
          sel.removeAllRanges();
          sel.addRange(replaceRange);

          const inserted = corrected + e.key;
          document.execCommand('insertText', false, inserted);

          lastCorrection = {
            original: rawWord,
            corrected: corrected,
            time: Date.now()
          };

          if (autocorrectNotification) {
            showAutocorrectToast(`"${rawWord}" ➔ "${corrected}"`, true);
          }
        }
      }
    }
  } else if (isInputOrTextarea) {
    const selStart = target.selectionStart;
    const textBefore = target.value.substring(0, selStart);
    const match = textBefore.match(/(?:^|\s|[^\p{L}\p{N}])([\p{L}\p{N}]+)$/u);
    if (match) {
      const rawWord = match[1];
      const prefix = textBefore.substring(0, selStart - rawWord.length);
      const corrected = getCorrectedWord(rawWord, prefix);

      if (corrected && corrected !== rawWord) {
        e.preventDefault();
        const wordStart = selStart - rawWord.length;
        const inserted = corrected + e.key;
        target.setRangeText(inserted, wordStart, selStart, 'end');
        target.dispatchEvent(new Event('input', { bubbles: true }));

        lastCorrection = {
          original: rawWord,
          corrected: corrected,
          time: Date.now()
        };

        if (autocorrectNotification) {
          showAutocorrectToast(`"${rawWord}" ➔ "${corrected}"`, true);
        }
      }
    }
  }
}

function initAutocorrect() {
  if (window.__waAutocorrectLoaded) return;
  window.__waAutocorrectLoaded = true;

  // 1. Obtener estado inicial de la configuración
  ipcRenderer.invoke('autocorrect-get-settings').then((res) => {
    if (res) {
      if (typeof res.autocorrectEnabled === 'boolean') {
        autocorrectEnabled = res.autocorrectEnabled;
      }
      if (typeof res.autocorrectNotification === 'boolean') {
        autocorrectNotification = res.autocorrectNotification;
      }
    }
  }).catch((err) => {
    console.warn('[Autocorrect] Error fetching settings:', err.message);
  });

  // 2. Escuchar cambios de configuración desde el proceso principal o menú
  ipcRenderer.on('autocorrect-settings-updated', (_event, patch) => {
    if (!patch) return;
    if (typeof patch.autocorrectEnabled === 'boolean') {
      const prev = autocorrectEnabled;
      autocorrectEnabled = patch.autocorrectEnabled;
      if (prev !== autocorrectEnabled) {
        showAutocorrectToast(
          autocorrectEnabled ? 'Autocorrector en español: Activado' : 'Autocorrector en español: Desactivado',
          autocorrectEnabled
        );
      }
    }
    if (typeof patch.autocorrectNotification === 'boolean') {
      autocorrectNotification = patch.autocorrectNotification;
    }
  });

  // 3. Prueba en vivo solicitada desde el menú
  ipcRenderer.on('autocorrect-test-live', () => {
    showAutocorrectToast('✍️ Autocorrector en español activo. Escribe "tambien" o "espanhol" y presiona espacio.', true);
  });

  // 4. Capturar pulsaciones de teclado en fase de captura para precedencia
  window.addEventListener('keydown', handleKeydown, true);

  // 5. Asegurar spellcheck="true" al hacer foco o clic en cualquier input
  window.addEventListener('focusin', (e) => {
    const t = e.target;
    if (t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) {
      t.setAttribute('spellcheck', 'true');
      t.spellcheck = true;
    }
  }, true);

  // 6. Monitoreo continuo del DOM para asegurar spellcheck
  ensureSpellcheckOnActiveInputs();
  setInterval(ensureSpellcheckOnActiveInputs, 3000);
}

module.exports = {
  initAutocorrect,
  getCorrectedWord,
  preserveCase
};
