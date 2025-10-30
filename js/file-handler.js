class FileHandlers {
  constructor() {
    this.supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
    this.supported3DTypes = ['.stl', '.obj'];
    this.supportedVectorTypes = ['.svg', '.dxf'];
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
  }

  async handleImageUpload(file) {
    const validation = InputValidator.validateFile(file, {
      maxSize: this.maxFileSize,
      allowedTypes: this.supportedImageTypes
    });

    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    await opencvHandler.loadImage(file);
    
    // كشف الحواف تلقائياً بناءً على نوع الماكينة
    const machineType = machineSettings.currentMachine;
    if (machineType === 'laser') {
      await this.detectLaserContours();
    } else if (machineType === 'router') {
      await opencvHandler.detectContours();
    }
  }

  async detectLaserContours() {
    if (!opencvHandler.isReady || !opencvHandler.previewCanvas) {
      throw new Error('OpenCV غير جاهز أو لا توجد صورة محملة');
    }

    let src = null, gray = null, edges = null, hierarchy = null, contours = null;
    
    try {
      src = cv.imread(opencvHandler.previewCanvas);
      memoryManager.track(src);
      
      gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      memoryManager.track(gray);
      
      const mode = document.getElementById('laserEdgeMode').value || 'adaptive';
      const detailLevel = parseInt(document.getElementById('laserDetail').value) || 5;
      
      edges = new cv.Mat();
      memoryManager.track(edges);
      
      this.applyLaserEdgeDetection(gray, edges, mode, detailLevel);

      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
      memoryManager.track(contours);
      memoryManager.track(hierarchy);

      const minArea = (gray.cols * gray.rows) * 0.002;
      const validContours = [];
      
      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const area = cv.contourArea(cnt);
        if (area > minArea) {
          validContours.push({ contour: cnt, area });
        } else {
          memoryManager.safeDelete(cnt);
        }
      }

      if (validContours.length > 0) {
        validContours.sort((a, b) => b.area - a.area);
        opencvHandler.contour = validContours[0].contour;
        opencvHandler.additionalContours = validContours.slice(1);
        showToast(`تم كشف ${validContours.length} كونتور للليزر`);
      } else {
        throw new Error('لم يتم العثور على حواف مناسبة للليزر');
      }

      // حفظ الصورة الرمادية
      if (opencvHandler.grayMat) {
        memoryManager.safeDelete(opencvHandler.grayMat);
      }
      opencvHandler.grayMat = gray.clone();
      memoryManager.track(opencvHandler.grayMat);

      // عرض النتائج
      opencvHandler.renderHeatmap();
      opencvHandler.renderContour();

    } catch (error) {
      console.error('خطأ في كشف حواف الليزر:', error);
      throw error;
    } finally {
      [src, gray, edges, hierarchy, contours].forEach(mat => {
        if (mat !== opencvHandler.grayMat) {
          memoryManager.safeDelete(mat);
        }
      });
    }
  }

  applyLaserEdgeDetection(input, output, mode, detailLevel) {
    switch (mode) {
      case 'adaptive':
        this.applyAdaptiveThreshold(input, output, detailLevel);
        break;
      case 'morphological':
        this.applyMorphologicalGradient(input, output, detailLevel);
        break;
      case 'gradient':
        this.applyGradientBased(input, output, detailLevel);
        break;
      default: // canny
        this.applyCanny(input, output);
        break;
    }
  }

  applyAdaptiveThreshold(input, output, detailLevel) {
    const adaptive = new cv.Mat();
    const blockSize = Math.max(3, 2 * Math.floor(detailLevel) + 1);
    cv.adaptiveThreshold(input, adaptive, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, blockSize, 2);
    memoryManager.track(adaptive);
    
    const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
    cv.morphologyEx(adaptive, output, cv.MORPH_CLOSE, kernel);
    memoryManager.track(kernel);
    
    memoryManager.safeDelete(adaptive);
    memoryManager.safeDelete(kernel);
  }

  applyMorphologicalGradient(input, output, detailLevel) {
    const blurred = new cv.Mat();
    cv.GaussianBlur(input, blurred, new cv.Size(3, 3), 0);
    memoryManager.track(blurred);
    
    const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
    const dilated = new cv.Mat();
    const eroded = new cv.Mat();
    
    cv.dilate(blurred, dilated, kernel);
    cv.erode(blurred, eroded, kernel);
    cv.subtract(dilated, eroded, output);
    
    cv.normalize(output, output, 0, 255, cv.NORM_MINMAX);
    
    memoryManager.safeDelete(blurred);
    memoryManager.safeDelete(kernel);
    memoryManager.safeDelete(dilated);
    memoryManager.safeDelete(eroded);
  }

  applyGradientBased(input, output, detailLevel) {
    const blurred = new cv.Mat();
    cv.GaussianBlur(input, blurred, new cv.Size(5, 5), 0);
    memoryManager.track(blurred);
    
    const gradX = new cv.Mat();
    const gradY = new cv.Mat();
    const absGradX = new cv.Mat();
    const absGradY = new cv.Mat();
    
    cv.Sobel(blurred, gradX, cv.CV_16S, 1, 0, 3, 1, 0, cv.BORDER_DEFAULT);
    cv.Sobel(blurred, gradY, cv.CV_16S, 0, 1, 3, 1, 0, cv.BORDER_DEFAULT);
    
    cv.convertScaleAbs(gradX, absGradX);
    cv.convertScaleAbs(gradY, absGradY);
    cv.addWeighted(absGradX, 0.5, absGradY, 0.5, 0, output);
    
    const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(2, 2));
    cv.morphologyEx(output, output, cv.MORPH_CLOSE, kernel);
    memoryManager.track(kernel);
    
    memoryManager.safeDelete(blurred);
    memoryManager.safeDelete(gradX);
    memoryManager.safeDelete(gradY);
    memoryManager.safeDelete(absGradX);
    memoryManager.safeDelete(absGradY);
    memoryManager.safeDelete(kernel);
  }

  applyCanny(input, output) {
    const blurred = new cv.Mat();
    cv.GaussianBlur(input, blurred, new cv.Size(3, 3), 0);
    cv.Canny(blurred, output, 50, 150);
    memoryManager.safeDelete(blurred);
  }

  async handle3DFileUpload(file) {
    const validation = InputValidator.validateFile(file, {
      maxSize: this.maxFileSize,
      allowedExtensions: this.supported3DTypes
    });

    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    const fileName = file.name.toLowerCase();
    
    try {
      if (fileName.endsWith('.stl')) {
        await threeJSHandler.loadSTLModel(file, 'threeDContainer', {
          color: 0x049ef4,
          autoFitCamera: true
        });
      } else if (fileName.endsWith('.obj')) {
        await threeJSHandler.loadOBJModel(file, 'threeDContainer', {
          color: 0xcccccc,
          autoFitCamera: true
        });
      }
      
      showElement('threeDContainer', 'threedPlaceholder');
      
    } catch (error) {
      console.error('فشل في تحميل الملف ثلاثي الأبعاد:', error);
      throw new Error(`فشل في تحميل الملف: ${error.message}`);
    }
  }

  async handleVectorFileUpload(file) {
    const validation = InputValidator.validateFile(file, {
      maxSize: this.maxFileSize,
      allowedExtensions: this.supportedVectorTypes
    });

    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    const fileName = file.name.toLowerCase();
    
    try {
      if (fileName.endsWith('.svg')) {
        await this.loadSVGFile(file);
      } else if (fileName.endsWith('.dxf')) {
        await this.loadDXFFile(file);
      }
      
    } catch (error) {
      console.error('فشل في تحميل الملف المتجه:', error);
      throw new Error(`فشل في تحميل الملف: ${error.message}`);
    }
  }

  async loadSVGFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const text = event.target.result;
          await this.parseAndRenderSVG(text);
          showToast('تم تحميل ملف SVG بنجاح', 2000);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('فشل في قراءة ملف SVG'));
      reader.readAsText(file);
    });
  }

  async loadDXFFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target.result;
          await this.parseAndRenderDXF(arrayBuffer);
          showToast('تم تحميل ملف DXF بنجاح', 2000);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('فشل في قراءة ملف DXF'));
      reader.readAsArrayBuffer(file);
    });
  }

  async parseAndRenderSVG(svgText) {
    // هذه الدالة تحتاج إلى مكتبة SVG parser
    // يمكن إضافة التطبيق الفعلي هنا
    console.log('معالجة محتوى SVG:', svgText.substring(0, 100));
    
    // عرض رسالة مؤقتة
    showToast('معالجة ملف SVG - الميزة قيد التطوير', 3000);
  }

  async parseAndRenderDXF(dxfData) {
    // هذه الدالة تحتاج إلى مكتبة DXF parser
    // يمكن إضافة التطبيق الفعلي هنا
    console.log('معالجة محتوى DXF:', dxfData.byteLength, 'bytes');
    
    // عرض رسالة مؤقتة
    showToast('معالجة ملف DXF - الميزة قيد التطوير', 3000);
  }

  downloadGCode(gcode, filename = null) {
    if (!gcode) {
      showToast("لا يوجد G-code لتحميله");
      return;
    }

    try {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const machineType = machineSettings.currentMachine;
      
      if (!filename) {
        filename = `${machineType}_output_${dateStr}.gcode`;
      }

      const blob = new Blob([gcode], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      showToast(`تم تحميل الملف: ${filename}`);
      
    } catch (error) {
      console.error('خطأ في تحميل الملف:', error);
      showToast('فشل في تحميل الملف');
    }
  }

  exportSettings() {
    const settings = machineSettings.exportSettings();
    const dataStr = JSON.stringify(settings, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cnc_settings_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('تم تصدير الإعدادات');
  }

  async importSettings(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const settings = JSON.parse(event.target.result);
          const success = machineSettings.importSettings(settings);
          
          if (success) {
            showToast('تم استيراد الإعدادات بنجاح');
            resolve();
          } else {
            reject(new Error('فشل في استيراد الإعدادات'));
          }
        } catch (error) {
          reject(new Error('ملف الإعدادات غير صالح'));
        }
      };
      
      reader.onerror = () => reject(new Error('فشل في قراءة الملف'));
      reader.readAsText(file);
    });
  }

  setupDragAndDrop(containerId, callback) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      container.classList.add('drag-over');
    });

    container.addEventListener('dragleave', () => {
      container.classList.remove('drag-over');
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();
      container.classList.remove('drag-over');
      
      const files = e.dataTransfer.files;
      if (files.length > 0 && callback) {
        callback(files[0]);
      }
    });
  }

  // إعداد drag and drop للعناصر المختلفة
  setupAllDragAndDrop() {
    this.setupDragAndDrop('originalPlaceholder', (file) => {
      taskManager.addTask(() => this.handleImageUpload(file), 'تحميل الصورة');
    });

    this.setupDragAndDrop('threedPlaceholder', (file) => {
      taskManager.addTask(() => this.handle3DFileUpload(file), 'تحميل النموذج ثلاثي الأبعاد');
    });

    this.setupDragAndDrop('vectorPlaceholder', (file) => {
      taskManager.addTask(() => this.handleVectorFileUpload(file), 'تحميل الملف المتجه');
    });
  }
}

// إنشاء instance عالمي
window.fileHandlers = new FileHandlers();
