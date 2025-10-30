class MachineSettings {
  constructor() {
    this.currentMachine = 'router';
    this.settings = {
      router: this.getDefaultRouterSettings(),
      laser: this.getDefaultLaserSettings(),
      threed: this.getDefault3DSettings()
    };
    this.advancedSettings = this.loadAdvancedSettings();
  }

  getDefaultRouterSettings() {
    return {
      workWidth: 30,
      workHeight: 20,
      workDepth: 3.0,
      originX: 0,
      originY: 0,
      feedRate: 800,
      safeZ: 5,
      scanDir: 'x',
      stepOver: 5,
      maxDepth: 3.0,
      fixedZ: false,
      fixedZValue: -1.0,
      invertZ: false,
      woodColor: '#a0522d',
      contourMode: 'outer'
    };
  }

  getDefaultLaserSettings() {
    return {
      workWidth: 30,
      workHeight: 20,
      originX: 0,
      originY: 0,
      laserPower: 80,
      laserSpeed: 2000,
      laserPasses: 1,
      laserMode: 'engrave',
      laserDynamic: true,
      laserAirAssist: false,
      laserEdgeMode: 'adaptive',
      laserDetail: 5
    };
  }

  getDefault3DSettings() {
    return {
      workWidth: 30,
      workHeight: 20,
      workDepth: 10,
      originX: 0,
      originY: 0,
      layerHeight: 0.2,
      fillDensity: 20,
      printSpeed: 50,
      infillPattern: 'rectilinear',
      support: false,
      raft: false
    };
  }

  loadAdvancedSettings() {
    try {
      const stored = localStorage.getItem('cnc_machine_advanced_v2');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('فشل في تحميل الإعدادات المتقدمة:', error);
    }

    return {
      origin_x: 0,
      origin_y: 0,
      origin_z: 0,
      cal_x: 0,
      cal_y: 0,
      rev_x: false,
      rev_y: false,
      exec: 'raster',
      delay: 0
    };
  }

  saveAdvancedSettings(settings) {
    try {
      this.advancedSettings = { ...this.advancedSettings, ...settings };
      localStorage.setItem('cnc_machine_advanced_v2', JSON.stringify(this.advancedSettings));
      return true;
    } catch (error) {
      console.error('فشل في حفظ الإعدادات المتقدمة:', error);
      return false;
    }
  }

  resetAdvancedSettings() {
    this.advancedSettings = {
      origin_x: 0,
      origin_y: 0,
      origin_z: 0,
      cal_x: 0,
      cal_y: 0,
      rev_x: false,
      rev_y: false,
      exec: 'raster',
      delay: 0
    };
    
    try {
      localStorage.removeItem('cnc_machine_advanced_v2');
    } catch (error) {
      console.warn('فشل في حذف الإعدادات المتقدمة:', error);
    }
    
    return this.advancedSettings;
  }

  getCurrentSettings() {
    return this.settings[this.currentMachine];
  }

  updateSetting(machineType, key, value) {
    if (this.settings[machineType]) {
      this.settings[machineType][key] = value;
    }
  }

  switchMachine(machineType) {
    if (this.settings[machineType]) {
      this.currentMachine = machineType;
      this.updateUI();
      return true;
    }
    return false;
  }

  updateUI() {
    // إخفاء/إظهار أقسام الماكينة
    this.toggleMachineSections();
    
    // تحديث قيم المدخلات
    this.updateInputValues();
    
    // تحديث وضوح الأزرار
    this.updateButtonVisibility();
  }

  toggleMachineSections() {
    const sections = {
      router: document.getElementById('routerSettings'),
      laser: document.getElementById('laserSettings'),
      threed: document.getElementById('threedSettings')
    };

    Object.entries(sections).forEach(([type, element]) => {
      if (element) {
        element.style.display = type === this.currentMachine ? 'block' : 'none';
      }
    });
  }

  updateInputValues() {
    const currentSettings = this.getCurrentSettings();
    
    Object.entries(currentSettings).forEach(([key, value]) => {
      const input = document.getElementById(key);
      if (input) {
        if (input.type === 'checkbox') {
          input.checked = value;
        } else {
          input.value = value;
        }
      }
    });

    // تحديث عرض الأبعاد
    this.updateDimensionDisplay();
  }

  updateButtonVisibility() {
    const elements = {
      router: ['btnGen', 'btnContour', 'btnQuick', 'btnCenterOrigin', 'btnDownload'],
      laser: ['btnLaserEngrave', 'btnLaserQuick', 'btnLaserCut', 'btnLaserDownload', 'btnRedetectLaser', 'btnLaserCenterOrigin'],
      threed: ['btnSliceModel', 'btnPreviewLayers', 'btnDownload3D', 'btnThreedCenterOrigin']
    };

    // إخفاء جميع العناصر أولاً
    Object.values(elements).flat().forEach(id => {
      const elem = document.getElementById(id);
      if (elem) elem.style.display = 'none';
    });

    // إظهار العناصر المناسبة
    const toShow = elements[this.currentMachine] || [];
    toShow.forEach(id => {
      const elem = document.getElementById(id);
      if (elem) elem.style.display = 'block';
    });
  }

  updateDimensionDisplay() {
    try {
      const currentSettings = this.getCurrentSettings();
      const prefixes = {
        router: '',
        laser: 'laser',
        threed: 'threed'
      };

      const prefix = prefixes[this.currentMachine];
      
      if (currentSettings.workWidth !== undefined) {
        const widthMmElem = document.getElementById(prefix ? `${prefix}WidthMm` : 'widthMm');
        if (widthMmElem) {
          widthMmElem.textContent = CNCUtils.cmToMm(currentSettings.workWidth).toFixed(1) + ' مم';
        }
      }

      if (currentSettings.workHeight !== undefined) {
        const heightMmElem = document.getElementById(prefix ? `${prefix}HeightMm` : 'heightMm');
        if (heightMmElem) {
          heightMmElem.textContent = CNCUtils.cmToMm(currentSettings.workHeight).toFixed(1) + ' مم';
        }
      }

      if (currentSettings.workDepth !== undefined) {
        const depthMmElem = document.getElementById(prefix ? `${prefix}DepthMm` : 'depthMm');
        if (depthMmElem) {
          depthMmElem.textContent = currentSettings.workDepth.toFixed(1) + ' مم';
        }
      }

    } catch (error) {
      console.error('فشل في تحديث عرض الأبعاد:', error);
    }
  }

  centerOrigin() {
    const currentSettings = this.getCurrentSettings();
    const prefixes = {
      router: '',
      laser: 'laser',
      threed: 'threed'
    };

    const prefix = prefixes[this.currentMachine];
    
    if (currentSettings.workWidth !== undefined && currentSettings.workHeight !== undefined) {
      const originX = document.getElementById(prefix ? `${prefix}OriginX` : 'originX');
      const originY = document.getElementById(prefix ? `${prefix}OriginY` : 'originY');
      
      if (originX) originX.value = (currentSettings.workWidth / 2).toFixed(1);
      if (originY) originY.value = (currentSettings.workHeight / 2).toFixed(1);
      
      this.updateSetting(this.currentMachine, 'originX', parseFloat(originX.value));
      this.updateSetting(this.currentMachine, 'originY', parseFloat(originY.value));
      
      showToast("تم توسيط نقطة الأصل");
    }
  }

  applyAdvancedSettings(gcode) {
    if (!gcode || typeof gcode !== 'string') return gcode;

    try {
      const settings = this.advancedSettings;
      const parsed = GCodeLibrary.parse(gcode);
      
      const transformed = parsed.map(cmd => {
        if (cmd.type !== 'command') return cmd;
        
        if (cmd.code === 'G0' || cmd.code === 'G1') {
          // تطبيق التحويلات على الإحداثيات
          if (cmd.parameters.X !== undefined) {
            let x = cmd.parameters.X;
            if (settings.rev_x) x = -x;
            if (settings.origin_x) x += settings.origin_x;
            if (settings.cal_x) x *= (1 + settings.cal_x);
            cmd.parameters.X = x;
          }
          
          if (cmd.parameters.Y !== undefined) {
            let y = cmd.parameters.Y;
            if (settings.rev_y) y = -y;
            if (settings.origin_y) y += settings.origin_y;
            if (settings.cal_y) y *= (1 + settings.cal_y);
            cmd.parameters.Y = y;
          }
          
          if (cmd.parameters.Z !== undefined && settings.origin_z) {
            cmd.parameters.Z += settings.origin_z;
          }
        }
        
        return cmd;
      });
      
      return GCodeLibrary.stringify(transformed);
    } catch (error) {
      console.error('فشل في تطبيق الإعدادات المتقدمة:', error);
      return gcode;
    }
  }

  validateSettings() {
    const currentSettings = this.getCurrentSettings();
    const errors = [];

    // التحقق من القيم الأساسية
    if (currentSettings.workWidth <= 0 || currentSettings.workWidth > 200) {
      errors.push('عرض العمل غير صالح');
    }

    if (currentSettings.workHeight <= 0 || currentSettings.workHeight > 200) {
      errors.push('ارتفاع العمل غير صالح');
    }

    // تحقق إضافي حسب نوع الماكينة
    switch (this.currentMachine) {
      case 'router':
        if (currentSettings.feedRate <= 0) {
          errors.push('سرعة التغذية غير صالحة');
        }
        if (currentSettings.maxDepth <= 0) {
          errors.push('أقصى عمق غير صالح');
        }
        break;
      
      case 'laser':
        if (currentSettings.laserPower < 0 || currentSettings.laserPower > 100) {
          errors.push('قوة الليزر غير صالحة');
        }
        if (currentSettings.laserSpeed <= 0) {
          errors.push('سرعة الليزر غير صالحة');
        }
        break;
      
      case 'threed':
        if (currentSettings.layerHeight <= 0) {
          errors.push('ارتفاع الطبقة غير صالح');
        }
        if (currentSettings.fillDensity < 0 || currentSettings.fillDensity > 100) {
          errors.push('كثافة الحشو غير صالحة');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  exportSettings() {
    return {
      machineType: this.currentMachine,
      settings: this.settings[this.currentMachine],
      advancedSettings: this.advancedSettings,
      timestamp: new Date().toISOString()
    };
  }

  importSettings(settings) {
    try {
      if (settings.machineType && this.settings[settings.machineType]) {
        this.switchMachine(settings.machineType);
        
        if (settings.settings) {
          this.settings[settings.machineType] = { 
            ...this.settings[settings.machineType], 
            ...settings.settings 
          };
        }
        
        if (settings.advancedSettings) {
          this.saveAdvancedSettings(settings.advancedSettings);
        }
        
        this.updateUI();
        return true;
      }
    } catch (error) {
      console.error('فشل في استيراد الإعدادات:', error);
    }
    
    return false;
  }
}

// إنشاء instance عالمي
window.machineSettings = new MachineSettings();
