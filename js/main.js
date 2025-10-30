class CncAiApp {
  constructor() {
    this.isInitialized = false;
    this.currentTab = 'original';
  }

  async init() {
    if (this.isInitialized) return;

    try {
      showToast('جاري تحميل التطبيق...', 2000);

      // تهيئة الأنظمة
      await this.initializeSystems();
      
      // إعداد واجهة المستخدم
      this.setupUI();
      
      // إعداد event listeners
      this.setupEventListeners();
      
      // بدء التطبيق
      this.startApplication();
      
      this.isInitialized = true;
      
      showToast('تم تحميل التطبيق بنجاح!', 1500);

    } catch (error) {
      console.error('فشل في تهيئة التطبيق:', error);
      showToast('حدث خطأ في تحميل التطبيق', 5000);
    }
  }

  async initializeSystems() {
    // تهيئة نظام التصحيح أولاً
    debugSystem.init();
    
    // انتظار تحميل OpenCV
    await opencvHandler.waitForOpenCV();
    
    // تهيئة إعدادات الماكينة
    machineSettings.updateUI();
    
    // إعداد معالجة الملفات
    fileHandlers.setupAllDragAndDrop();
    
    // تهيئة نظام المحاكاة
    simulationSystem.init();
    
    debugSystem.info('تم تهيئة جميع الأنظمة');
  }

  setupUI() {
    // إعداد التبويبات
    this.setupTabs();
    
    // تحديث عرض الأبعاد
    this.updateDimensionDisplays();
    
    // إعداد أزرار خريطة الألوان
    this.setupColormapButtons();
    
    // إعداد الإعدادات المتقدمة
    this.setupAdvancedSettings();
    
    // إعداد أزرار التحكم
    this.setupControlButtons();
  }

  setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-buttons button');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabId = button.getAttribute('data-tab');
        this.switchTab(tabId);
      });
    });
  }

  switchTab(tabId) {
    // إخفاء جميع المحتويات
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    
    // إزالة النشط من جميع الأزرار
    document.querySelectorAll('.tab-buttons button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // إظهار المحتوى المحدد
    const targetContent = document.getElementById(tabId);
    const targetButton = document.querySelector(`.tab-buttons button[data-tab="${tabId}"]`);
    
    if (targetContent) targetContent.classList.add('active');
    if (targetButton) targetButton.classList.add('active');
    
    this.currentTab = tabId;
    
    // معالجة خاصة لكل تبويب
    this.handleTabSwitch(tabId);
  }

  handleTabSwitch(tabId) {
    switch (tabId) {
      case 'simulation':
        const gcode = document.getElementById('gcodeOut').value;
        if (gcode) {
          simulationSystem.loadGCode(gcode);
        }
        break;
        
      case 'threed':
        // تأكد من تهيئة المشهد ثلاثي الأبعاد
        setTimeout(() => {
          threeJSHandler.handleResize('threeDContainer');
        }, 100);
        break;
    }
  }

  setupColormapButtons() {
    const buttons = document.querySelectorAll('#colormapButtons button');
    
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        // إزالة النشط من جميع الأزرار
        buttons.forEach(btn => btn.classList.remove('active'));
        
        // إضافة النشط للزر المحدد
        button.classList.add('active');
        
        // تحديث خريطة الألوان
        const colormap = button.getAttribute('data-map');
        opencvHandler.currentColormap = colormap;
        
        // إعادة عرض heatmap إذا كان ظاهراً
        if (opencvHandler.grayMat) {
          opencvHandler.renderHeatmap();
        }
        
        showToast(`تم تغيير خريطة الألوان إلى ${colormap}`);
      });
    });
  }

  setupAdvancedSettings() {
    const toggle = document.getElementById('adv-machine-toggle');
    const body = document.getElementById('adv-machine-body');
    const arrow = document.getElementById('adv-arrow');
    
    if (toggle && body && arrow) {
      toggle.addEventListener('click', () => {
        const isOpen = body.style.display === 'flex';
        body.style.display = isOpen ? 'none' : 'flex';
        arrow.textContent = isOpen ? '▼' : '▲';
      });
    }
    
    // إعداد event listeners للإعدادات المتقدمة
    this.setupAdvancedSettingsEvents();
  }

  setupAdvancedSettingsEvents() {
    // تحديث قيم sliders
    const calX = document.getElementById('adv_cal_x');
    const calY = document.getElementById('adv_cal_y');
    const calXVal = document.getElementById('adv_cal_x_val');
    const calYVal = document.getElementById('adv_cal_y_val');
    
    if (calX && calXVal) {
      calX.addEventListener('input', () => {
        calXVal.textContent = calX.value;
        this.saveAdvancedSettings();
      });
    }
    
    if (calY && calYVal) {
      calY.addEventListener('input', () => {
        calYVal.textContent = calY.value;
        this.saveAdvancedSettings();
      });
    }
    
    // حفظ الإعدادات عند التغيير
    const advancedInputs = [
      'adv_origin_x', 'adv_origin_y', 'adv_origin_z',
      'adv_rev_x', 'adv_rev_y', 'adv_exec', 'adv_delay'
    ];
    
    advancedInputs.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('change', () => this.saveAdvancedSettings());
      }
    });
    
    // أزرار الإعدادات المتقدمة
    const saveBtn = document.getElementById('adv_save');
    const resetBtn = document.getElementById('adv_reset');
    
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveAdvancedSettings());
    }
    
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetAdvancedSettings());
    }
  }

  saveAdvancedSettings() {
    const settings = {
      origin_x: parseFloat(document.getElementById('adv_origin_x').value) || 0,
      origin_y: parseFloat(document.getElementById('adv_origin_y').value) || 0,
      origin_z: parseFloat(document.getElementById('adv_origin_z').value) || 0,
      cal_x: parseFloat(document.getElementById('adv_cal_x').value) || 0,
      cal_y: parseFloat(document.getElementById('adv_cal_y').value) || 0,
      rev_x: document.getElementById('adv_rev_x').checked,
      rev_y: document.getElementById('adv_rev_y').checked,
      exec: document.getElementById('adv_exec').value,
      delay: parseInt(document.getElementById('adv_delay').value) || 0
    };
    
    const success = machineSettings.saveAdvancedSettings(settings);
    if (success) {
      showToast('تم حفظ الإعدادات المتقدمة');
    }
  }

  resetAdvancedSettings() {
    machineSettings.resetAdvancedSettings();
    this.updateAdvancedSettingsUI();
    showToast('تم إعادة تعيين الإعدادات المتقدمة');
  }

  updateAdvancedSettingsUI() {
    const settings = machineSettings.advancedSettings;
    
    document.getElementById('adv_origin_x').value = settings.origin_x;
    document.getElementById('adv_origin_y').value = settings.origin_y;
    document.getElementById('adv_origin_z').value = settings.origin_z;
    document.getElementById('adv_cal_x').value = settings.cal_x;
    document.getElementById('adv_cal_y').value = settings.cal_y;
    document.getElementById('adv_cal_x_val').textContent = settings.cal_x;
    document.getElementById('adv_cal_y_val').textContent = settings.cal_y;
    document.getElementById('adv_rev_x').checked = settings.rev_x;
    document.getElementById('adv_rev_y').checked = settings.rev_y;
    document.getElementById('adv_exec').value = settings.exec;
    document.getElementById('adv_delay').value = settings.delay;
  }

  setupControlButtons() {
    // إعداد أزرار تحميل الملفات
    this.setupFileInputs();
    
    // إعداد أزرار توليد G-code
    this.setupGCodeButtons();
    
    // إعداد أزرار التنزيل
    this.setupDownloadButtons();
    
    // إعداد أزرار المركز
    this.setupCenterButtons();
  }

  setupFileInputs() {
    const fileInput = document.getElementById('fileInput');
    const threedInput = document.getElementById('threedFileInput');
    
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          taskManager.addTask(() => fileHandlers.handleImageUpload(file), 'تحميل الصورة');
        }
      });
    }
    
    if (threedInput) {
      threedInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          taskManager.addTask(() => fileHandlers.handle3DFileUpload(file), 'تحميل النموذج ثلاثي الأبعاد');
        }
      });
    }
  }

  setupGCodeButtons() {
    // راوتر
    document.getElementById('btnGen')?.addEventListener('click', () => this.generateRouterGCode());
    document.getElementById('btnQuick')?.addEventListener('click', () => this.generateQuickGCode());
    document.getElementById('btnContour')?.addEventListener('click', () => this.generateContourGCode());
    
    // ليزر
    document.getElementById('btnLaserEngrave')?.addEventListener('click', () => this.generateLaserGCode());
    document.getElementById('btnLaserQuick')?.addEventListener('click', () => this.generateLaserQuickGCode());
    document.getElementById('btnLaserCut')?.addEventListener('click', () => this.generateLaserCutGCode());
    document.getElementById('btnRedetectLaser')?.addEventListener('click', () => this.redetectLaserContours());
    
    // ثلاثي الأبعاد
    document.getElementById('btnSliceModel')?.addEventListener('click', () => this.generate3DGCode());
  }

  setupDownloadButtons() {
    const downloadButtons = ['btnDownload', 'btnLaserDownload', 'btnDownload3D'];
    
    downloadButtons.forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => {
        const gcode = document.getElementById('gcodeOut').value;
        fileHandlers.downloadGCode(gcode);
      });
    });
  }

  setupCenterButtons() {
    document.getElementById('btnCenterOrigin')?.addEventListener('click', () => {
      machineSettings.centerOrigin();
    });
    
    document.getElementById('btnLaserCenterOrigin')?.addEventListener('click', () => {
      machineSettings.centerOrigin();
    });
    
    document.getElementById('btnThreedCenterOrigin')?.addEventListener('click', () => {
      machineSettings.centerOrigin();
    });
  }

  async generateRouterGCode() {
    if (!opencvHandler.grayMat || !opencvHandler.contour) {
      showToast('لا توجد صورة جاهزة للمعالجة');
      return;
    }

    await taskManager.addTask(async () => {
      const gcode = this.generateRasterGCode();
      this.displayGCode(gcode);
      return gcode;
    }, 'توليد G-code (Raster)');
  }

  generateRasterGCode() {
    // تطبيق المنطق الأصلي لتوليد G-code هنا
    // هذا مثال مبسط
    const settings = machineSettings.getCurrentSettings();
    const advancedSettings = machineSettings.advancedSettings;
    
    let gcode = GCodeLibrary.generateHeader('router').join('\n');
    
    // إضافة أوامر G-code بناءً على الصورة والإعدادات
    // ... (المنطق الأصلي من generateRasterGcode)
    
    gcode += '\n' + GCodeLibrary.generateFooter('router').join('\n');
    
    // تطبيق الإعدادات المتقدمة
    gcode = machineSettings.applyAdvancedSettings(gcode);
    
    return gcode;
  }

  displayGCode(gcode) {
    const gcodeOutput = document.getElementById('gcodeOut');
    if (gcodeOutput) {
      gcodeOutput.value = gcode;
    }
    
    // تحميل G-code في المحاكاة
    simulationSystem.loadGCode(gcode);
    
    // التبديل إلى تبويب المحاكاة
    this.switchTab('simulation');
  }

  updateDimensionDisplays() {
    // إعداد event listeners لتحديث الأبعاد
    const dimensionInputs = [
      'workWidth', 'workHeight', 'laserWorkWidth', 'laserWorkHeight', 
      'threedWorkWidth', 'threedWorkHeight', 'threedWorkDepth'
    ];
    
    const updateHandler = CNCUtils.debounce(() => {
      machineSettings.updateDimensionDisplay();
    }, 200);
    
    dimensionInputs.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('input', updateHandler);
      }
    });
  }

  setupEventListeners() {
    // تبديل نوع الماكينة
    document.getElementById('machineCategory')?.addEventListener('change', (e) => {
      machineSettings.switchMachine(e.target.value);
    });
    
    // إعدادات حساسية الحواف
    document.getElementById('edgeSensitivity')?.addEventListener('input', (e) => {
      document.getElementById('edgeValue').textContent = parseFloat(e.target.value).toFixed(2);
    });
    
    // إعدادات الليزر
    document.getElementById('laserPower')?.addEventListener('input', (e) => {
      document.getElementById('laserPowerValue').textContent = e.target.value + '%';
    });
    
    document.getElementById('laserDetail')?.addEventListener('input', (e) => {
      document.getElementById('laserDetailValue').textContent = e.target.value;
    });
    
    // إعدادات وضع الحواف
    document.getElementById('edgeMode')?.addEventListener('change', () => {
      if (opencvHandler.previewCanvas && machineSettings.currentMachine === 'router') {
        taskManager.addTask(() => opencvHandler.detectContours(), 'تحديث كشف الحواف');
      }
    });
    
    document.getElementById('laserEdgeMode')?.addEventListener('change', () => {
      // تحديث وصف وضع الليزر
      this.updateLaserModeDescription();
    });
    
    // إعدادات اختصارات لوحة المفاتيح
    this.setupKeyboardShortcuts();
  }

  updateLaserModeDescription() {
    const mode = document.getElementById('laserEdgeMode').value;
    const descriptions = {
      canny: 'Canny - كشف حواف تقليدي مناسب للصور العامة',
      adaptive: 'Adaptive Threshold - ممتاز للصور ذات الإضاءة غير المتجانسة',
      morphological: 'Morphological - للحواف الدقيقة والناعمة والتفاصيل الصغيرة',
      gradient: 'Gradient-Based - للتدرجات اللونية والصور ذات التباين العالي'
    };
    
    const descElement = document.getElementById('laserModeDesc');
    if (descElement) {
      descElement.textContent = descriptions[mode] || '';
    }
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'g': // توليد G-code
            e.preventDefault();
            this.handleQuickGenerate();
            break;
            
          case 'r': // توليد سريع
            e.preventDefault();
            this.handleQuickTest();
            break;
            
          case 'd': // تحميل
            e.preventDefault();
            fileHandlers.downloadGCode(document.getElementById('gcodeOut').value);
            break;
            
          case '`': // تصحيح
            e.preventDefault();
            document.getElementById('cnc-debug-btn')?.click();
            break;
        }
      }
    });
  }

  handleQuickGenerate() {
    const machineType = machineSettings.currentMachine;
    
    switch (machineType) {
      case 'laser':
        document.getElementById('btnLaserEngrave')?.click();
        break;
      case 'threed':
        document.getElementById('btnSliceModel')?.click();
        break;
      default:
        document.getElementById('btnGen')?.click();
        break;
    }
  }

  handleQuickTest() {
    const machineType = machineSettings.currentMachine;
    
    if (machineType === 'laser') {
      document.getElementById('btnLaserQuick')?.click();
    } else {
      document.getElementById('btnQuick')?.click();
    }
  }

  startApplication() {
    // بدء التطبيق
    debugSystem.info('بدأ تشغيل التطبيق');
    
    // تحديث الواجهة بشكل دوري
    this.startUIUpdates();
  }

  startUIUpdates() {
    // تحديث حالة الذاكرة بشكل دوري
    setInterval(() => {
      this.updateMemoryUsage();
    }, 10000);
  }

  updateMemoryUsage() {
    const usage = memoryManager.getMemoryUsage();
    debugSystem.info(`استخدام الذاكرة: ${usage.current}/${usage.max} مصفوفات`);
  }

  // دوال مساعدة للوظائف المتبقية
  generateQuickGCode() {
    // تطبيق المنطق الأصلي للتوليد السريع
  }

  generateContourGCode() {
    // تطبيق المنطق الأصلي لتوليد كونتور
  }

  generateLaserGCode() {
    // تطبيق المنطق الأصلي لتوليد ليزر
  }

  generateLaserQuickGCode() {
    // تطبيق المنطق الأصلي للتوليد السريع للليزر
  }

  generateLaserCutGCode() {
    // تطبيق المنطق الأصلي لتوليد قص ليزر
  }

  generate3DGCode() {
    // تطبيق المنطق الأصلي لتوليد ثلاثي الأبعاد
  }

  async redetectLaserContours() {
    if (!opencvHandler.previewCanvas) {
      showToast('لا توجد صورة محملة');
      return;
    }
    
    await taskManager.addTask(() => fileHandlers.detectLaserContours(), 'إعادة كشف حواف الليزر');
  }
}

// دوال مساعدة global
function showElement(elementId, placeholderId) {
  try {
    const element = document.getElementById(elementId);
    const placeholder = document.getElementById(placeholderId);
    
    if (element) element.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
  } catch (error) {
    console.error('فشل في إظهار العنصر:', error);
  }
}

function hideElement(elementId) {
  try {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'none';
  } catch (error) {
    console.error('فشل في إخفاء العنصر:', error);
  }
}

// تهيئة التطبيق عند تحميل الصفحة
let cncApp;

document.addEventListener('DOMContentLoaded', () => {
  cncApp = new CncAiApp();
  cncApp.init();
});

// جعل التطبيق متاحاً globally للتصحيح
window.cncApp = cncApp;
