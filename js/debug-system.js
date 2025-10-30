class DebugSystem {
  constructor() {
    this.logs = [];
    this.maxLogs = 300;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;

    try {
      this.setupDebugOverlay();
      this.overrideConsoleMethods();
      this.setupGlobalErrorHandlers();
      this.isInitialized = true;
      
      this.info('تم تهيئة نظام التصحيح');

    } catch (error) {
      console.error('فشل في تهيئة نظام التصحيح:', error);
    }
  }

  setupDebugOverlay() {
    const overlay = document.getElementById('cnc-debug-overlay');
    const body = document.getElementById('cnc-debug-body');
    const btn = document.getElementById('cnc-debug-btn');
    const copyBtn = document.getElementById('cnc-debug-copy');
    const clearBtn = document.getElementById('cnc-debug-clear');
    const closeBtn = document.getElementById('cnc-debug-close');
    const countEl = document.getElementById('cnc-debug-count');

    if (!overlay || !body || !btn) {
      console.warn('عناصر التصحيح غير موجودة في DOM');
      return;
    }

    // زر فتح/إغلاق التصحيح
    btn.addEventListener('click', () => {
      overlay.classList.toggle('collapsed');
      overlay.setAttribute('aria-hidden', overlay.classList.contains('collapsed'));
    });

    // نسخ السجلات
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.copyLogs());
    }

    // مسح السجلات
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearLogs());
    }

    // إغلاق التصحيح
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        overlay.classList.add('collapsed');
      });
    }

    // تحديث العداد
    this.updateCount = () => {
      if (countEl) {
        countEl.textContent = this.logs.length + ' سجلات';
      }
    };
  }

  overrideConsoleMethods() {
    const original = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      info: console.info.bind(console)
    };

    console.log = (...args) => {
      this.info(args.map(arg => this.stringify(arg)).join(' '));
      original.log(...args);
    };

    console.info = (...args) => {
      this.info(args.map(arg => this.stringify(arg)).join(' '));
      original.info(...args);
    };

    console.warn = (...args) => {
      this.warn(args.map(arg => this.stringify(arg)).join(' '));
      original.warn(...args);
    };

    console.error = (...args) => {
      this.error(args.map(arg => this.stringify(arg)).join(' '));
      original.error(...args);
    };
  }

  setupGlobalErrorHandlers() {
    window.addEventListener('error', (event) => {
      this.error(`خطأ غير معالج: ${event.message} (${event.filename}:${event.lineno})`, event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.error(`Promise مرفوض: ${event.reason}`, event.reason);
    });
  }

  stringify(arg) {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }

  addLog(type, message, stack = null) {
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp: new Date(),
      type,
      message: String(message).substring(0, 500),
      stack: stack ? String(stack).substring(0, 1000) : null
    };

    this.logs.unshift(logEntry);

    // الحفاظ على الحد الأقصى للسجلات
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    this.updateUI(logEntry);
    this.updateCount();
  }

  updateUI(logEntry) {
    const body = document.getElementById('cnc-debug-body');
    if (!body) return;

    const logElement = this.createLogElement(logEntry);
    
    if (body.firstChild) {
      body.insertBefore(logElement, body.firstChild);
    } else {
      body.appendChild(logElement);
    }

    // الحفاظ على عدد معقول من العناصر في الواجهة
    const maxDisplayed = 50;
    while (body.children.length > maxDisplayed) {
      body.removeChild(body.lastChild);
    }
  }

  createLogElement(logEntry) {
    const div = document.createElement('div');
    div.className = `debug-log debug-${logEntry.type}`;
    
    const time = logEntry.timestamp.toLocaleTimeString();
    const message = logEntry.message;
    
    div.innerHTML = `
      <div class="debug-time">[${time}] ${logEntry.type.toUpperCase()}</div>
      <div class="debug-message">${this.escapeHtml(message)}</div>
      ${logEntry.stack ? `<div class="debug-stack">${this.escapeHtml(logEntry.stack)}</div>` : ''}
    `;

    return div;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  info(message) {
    this.addLog('info', message);
  }

  warn(message, error = null) {
    this.addLog('warn', message, error?.stack);
  }

  error(message, error = null) {
    this.addLog('error', message, error?.stack);
  }

  clearLogs() {
    this.logs = [];
    const body = document.getElementById('cnc-debug-body');
    if (body) {
      body.innerHTML = '';
    }
    this.updateCount();
    this.info('تم مسح سجلات التصحيح');
  }

  async copyLogs() {
    try {
      const logText = this.logs.map(log => 
        `[${log.timestamp.toISOString()}] ${log.type.toUpperCase()}: ${log.message}${log.stack ? '\n' + log.stack : ''}`
      ).join('\n\n');

      await navigator.clipboard.writeText(logText);
      this.info('تم نسخ السجلات إلى الحافظة');
    } catch (error) {
      this.error('فشل في نسخ السجلات: ' + error.message);
    }
  }

  getLogs() {
    return [...this.logs];
  }

  exportLogs() {
    const logData = {
      exportedAt: new Date().toISOString(),
      logCount: this.logs.length,
      logs: this.logs
    };

    const dataStr = JSON.stringify(logData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug_logs_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.info('تم تصدير سجلات التصحيح');
  }

  performanceStart(label) {
    if (!console.time) return;
    console.time(label);
  }

  performanceEnd(label) {
    if (!console.timeEnd) return;
    console.timeEnd(label);
  }

  measurePerformance(fn, label) {
    this.performanceStart(label);
    const result = fn();
    this.performanceEnd(label);
    return result;
  }

  async measurePerformanceAsync(fn, label) {
    this.performanceStart(label);
    const result = await fn();
    this.performanceEnd(label);
    return result;
  }
}

// إنشاء instance عالمي
window.debugSystem = new DebugSystem();

// إضافة دوال global للاستخدام السهل
window.debug = {
  info: (msg) => debugSystem.info(msg),
  warn: (msg, err) => debugSystem.warn(msg, err),
  error: (msg, err) => debugSystem.error(msg, err),
  clear: () => debugSystem.clearLogs(),
  export: () => debugSystem.exportLogs()
};
