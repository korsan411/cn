class InputValidator {
  static validateNumberInput(inputId, min, max, defaultValue = min) {
    try {
      const input = document.getElementById(inputId);
      if (!input) {
        throw new Error(`عنصر الإدخال ${inputId} غير موجود`);
      }
      
      let value = parseFloat(input.value);
      
      if (isNaN(value)) {
        showToast(`القيمة في ${inputId} غير صالحة`);
        input.value = defaultValue;
        return defaultValue;
      }
      
      if (value < min) {
        showToast(`القيمة في ${inputId} أقل من المسموح (${min})`);
        input.value = min;
        return min;
      }
      
      if (value > max) {
        showToast(`القيمة في ${inputId} أكبر من المسموح (${max})`);
        input.value = max;
        return max;
      }
      
      return value;
    } catch (error) {
      console.error(`خطأ في التحقق من ${inputId}:`, error);
      return defaultValue;
    }
  }

  static validateImageSize(canvas) {
    if (!canvas) return false;
    
    const maxPixels = 2000000; // 2MP للحد من استهلاك الذاكرة
    const currentPixels = canvas.width * canvas.height;
    
    if (currentPixels > maxPixels) {
      const ratio = Math.sqrt(maxPixels / currentPixels);
      const newWidth = Math.floor(canvas.width * ratio);
      const newHeight = Math.floor(canvas.height * ratio);
      
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = newWidth;
      tempCanvas.height = newHeight;
      tempCtx.drawImage(canvas, 0, 0, newWidth, newHeight);
      
      const ctx = canvas.getContext('2d');
      canvas.width = newWidth;
      canvas.height = newHeight;
      ctx.drawImage(tempCanvas, 0, 0);
      
      showToast('تم تقليل حجم الصورة للأداء الأفضل');
      return true;
    }
    return false;
  }

  static validateLaserSettings() {
    const power = this.validateNumberInput('laserPower', 0, 100, 80);
    const speed = this.validateNumberInput('laserSpeed', 100, 10000, 2000);
    const passes = this.validateNumberInput('laserPasses', 1, 10, 1);
    
    return { power, speed, passes };
  }

  static validateRouterSettings() {
    const feedRate = this.validateNumberInput('feedRate', 10, 5000, 800);
    const safeZ = this.validateNumberInput('safeZ', 0, 100, 5);
    const maxDepth = this.validateNumberInput('maxDepth', 0.1, 50, 3);
    const stepOver = this.validateNumberInput('stepOver', 0.1, 50, 5);
    
    return { feedRate, safeZ, maxDepth, stepOver };
  }

  static validate3DSettings() {
    const layerHeight = this.validateNumberInput('threedLayerHeight', 0.05, 1.0, 0.2);
    const fillDensity = this.validateNumberInput('threedFillDensity', 0, 100, 20);
    const printSpeed = this.validateNumberInput('threedPrintSpeed', 10, 200, 50);
    const workDepth = this.validateNumberInput('threedWorkDepth', 0.1, 100, 10);
    
    return { layerHeight, fillDensity, printSpeed, workDepth };
  }

  static validateFile(file, options = {}) {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB افتراضي
      allowedTypes = ['image/*'],
      allowedExtensions = []
    } = options;

    const errors = [];

    // التحقق من الحجم
    if (file.size > maxSize) {
      errors.push(`حجم الملف كبير جداً. الحد الأقصى: ${(maxSize / 1024 / 1024).toFixed(1)}MB`);
    }

    // التحقق من النوع
    const isTypeValid = allowedTypes.some(type => {
      if (type === '*') return true;
      if (type.endsWith('/*')) {
        const category = type.split('/')[0];
        return file.type.startsWith(category + '/');
      }
      return file.type === type;
    });

    const isExtensionValid = allowedExtensions.length === 0 || 
      allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isTypeValid && !isExtensionValid) {
      errors.push('نوع الملف غير مدعوم');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateAllInputs() {
    const errors = [];
    
    // التحقق من المدخلات الأساسية
    const requiredInputs = [
      { id: 'workWidth', min: 1, max: 200 },
      { id: 'workHeight', min: 1, max: 200 },
      { id: 'laserWorkWidth', min: 1, max: 200 },
      { id: 'laserWorkHeight', min: 1, max: 200 },
      { id: 'threedWorkWidth', min: 1, max: 200 },
      { id: 'threedWorkHeight', min: 1, max: 200 }
    ];
    
    requiredInputs.forEach(input => {
      try {
        this.validateNumberInput(input.id, input.min, input.max);
      } catch (error) {
        errors.push(`خطأ في ${input.id}: ${error.message}`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

window.InputValidator = InputValidator;
