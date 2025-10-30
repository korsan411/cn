
class OpenCVHandler {
  constructor() {
    this.isReady = false;
    this.grayMat = null;
    this.contour = null;
    this.additionalContours = [];
    this.currentColormap = 'jet';
    this.previewCanvas = null;
  }

  async waitForOpenCV() {
    return new Promise((resolve, reject) => {
      const checkCV = () => {
        try {
          if (typeof cv !== 'undefined' && cv.getBuildInformation) {
            // اختبار شامل للتأكد من جاهزية OpenCV
            const testMat = new cv.Mat();
            if (testMat && testMat.delete) {
              this.isReady = true;
              testMat.delete();
              
              // تحديث واجهة المستخدم
              this.updateCVState('✅ OpenCV جاهز');
              showToast('تم تحميل OpenCV بنجاح', 1400);
              console.log('OpenCV loaded successfully');
              resolve();
              return;
            }
          }
          
          // إعادة المحاولة بعد فترة
          setTimeout(checkCV, 100);
        } catch (error) {
          console.warn('OpenCV test failed, retrying...', error);
          setTimeout(checkCV, 100);
        }
      };
      
      checkCV();
      
      // timeout بعد 30 ثانية
      setTimeout(() => {
        if (!this.isReady) {
          reject(new Error('فشل تحميل OpenCV بعد فترة الانتظار'));
        }
      }, 30000);
    });
  }

  updateCVState(message) {
    try {
      const cvState = document.getElementById('cvState');
      if (cvState) {
        cvState.innerHTML = message;
      }
    } catch (error) {
      console.error('فشل في تحديث حالة OpenCV:', error);
    }
  }

  async loadImage(file) {
    if (!this.isReady) {
      throw new Error('OpenCV غير جاهز بعد');
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const imgUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        try {
          this.previewCanvas = document.getElementById('canvasOriginal');
          if (!this.previewCanvas) {
            throw new Error('عنصر canvas غير موجود');
          }

          const ctx = this.previewCanvas.getContext('2d');
          this.previewCanvas.width = img.width;
          this.previewCanvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          // تحقق من حجم الصورة
          InputValidator.validateImageSize(this.previewCanvas);
          
          showElement('canvasOriginal', 'originalPlaceholder');
          URL.revokeObjectURL(imgUrl);
          resolve();
        } catch (error) {
          URL.revokeObjectURL(imgUrl);
          reject(error);
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(imgUrl);
        reject(new Error('فشل في تحميل الصورة'));
      };
      
      img.src = imgUrl;
    });
  }

  async detectContours(options = {}) {
    if (!this.isReady || !this.previewCanvas) {
      throw new Error('OpenCV غير جاهز أو لا توجد صورة محملة');
    }

    let src = null, gray = null, blurred = null, edges = null, hierarchy = null, contours = null, kernel = null;
    
    try {
      src = cv.imread(this.previewCanvas);
      memoryManager.track(src);
      
      gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      memoryManager.track(gray);
      
      blurred = new cv.Mat();
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
      memoryManager.track(blurred);

      // تطبيق إعدادات كشف الحواف
      const mode = options.mode || document.getElementById('edgeMode').value || 'auto';
      const sensitivity = options.sensitivity || parseFloat(document.getElementById('edgeSensitivity').value) || 0.33;

      edges = new cv.Mat();
      memoryManager.track(edges);
      
      this.applyEdgeDetection(blurred, edges, mode, sensitivity);

      // تحسين الحواف
      kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
      cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
      memoryManager.track(kernel);

      // إيجاد الكنتورات
      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
      memoryManager.track(contours);
      memoryManager.track(hierarchy);

      // تصفية الكنتورات حسب المساحة
      const validContours = this.filterContoursByArea(contours, gray);
      
      if (validContours.length > 0) {
        validContours.sort((a, b) => b.area - a.area);
        this.contour = validContours[0].contour;
        this.additionalContours = validContours.slice(1);
        showToast(`تم كشف ${validContours.length} كونتور`);
      } else {
        throw new Error('لم يتم العثور على حواف واضحة في الصورة');
      }

      // حفظ نسخة من الصورة الرمادية
      if (this.grayMat) {
        memoryManager.safeDelete(this.grayMat);
      }
      this.grayMat = gray.clone();
      memoryManager.track(this.grayMat);

      // عرض النتائج
      this.renderHeatmap();
      this.renderContour();

    } catch (error) {
      console.error('خطأ في كشف الحواف:', error);
      throw error;
    } finally {
      // تنظيف المصفوفات المؤقتة
      [src, blurred, edges, hierarchy, contours, kernel].forEach(mat => {
        if (mat !== gray && mat !== this.grayMat) {
          memoryManager.safeDelete(mat);
        }
      });
    }
  }

  applyEdgeDetection(input, output, mode, sensitivity) {
    const median = cv.mean(input)[0];
    const lowerThreshold = Math.max(0, (1.0 - sensitivity) * median);
    const upperThreshold = Math.min(255, (1.0 + sensitivity) * median);

    switch (mode) {
      case 'sobel':
        this.applySobel(input, output);
        break;
      case 'laplace':
        this.applyLaplacian(input, output);
        break;
      default: // canny
        cv.Canny(input, output, lowerThreshold, upperThreshold);
        break;
    }
  }

  applySobel(input, output) {
    const gradX = new cv.Mat(), gradY = new cv.Mat();
    cv.Sobel(input, gradX, cv.CV_16S, 1, 0, 3, 1, 0, cv.BORDER_DEFAULT);
    cv.Sobel(input, gradY, cv.CV_16S, 0, 1, 3, 1, 0, cv.BORDER_DEFAULT);
    cv.convertScaleAbs(gradX, gradX);
    cv.convertScaleAbs(gradY, gradY);
    cv.addWeighted(gradX, 0.5, gradY, 0.5, 0, output);
    memoryManager.safeDelete(gradX);
    memoryManager.safeDelete(gradY);
  }

  applyLaplacian(input, output) {
    cv.Laplacian(input, output, cv.CV_16S, 3, 1, 0, cv.BORDER_DEFAULT);
    cv.convertScaleAbs(output, output);
  }

  filterContoursByArea(contours, grayMat) {
    const minArea = (grayMat.cols * grayMat.rows) * 0.01; // 1% من مساحة الصورة
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
    
    return validContours;
  }

  renderHeatmap() {
    if (!this.grayMat || !this.previewCanvas) return;
    
    try {
      const heatCanvas = document.getElementById('canvasHeatmap');
      if (!heatCanvas) return;
      
      const ctx = heatCanvas.getContext('2d');
      heatCanvas.width = this.grayMat.cols;
      heatCanvas.height = this.grayMat.rows;
      
      const imgData = ctx.createImageData(heatCanvas.width, heatCanvas.height);
      const data = this.grayMat.data;
      
      for (let i = 0; i < data.length; i++) {
        const value = data[i];
        const t = value / 255.0;
        const col = CNCUtils.getColormapColor(t, this.currentColormap);
        const idx = i * 4;
        imgData.data[idx] = col.r;
        imgData.data[idx + 1] = col.g;
        imgData.data[idx + 2] = col.b;
        imgData.data[idx + 3] = 255;
      }
      
      ctx.putImageData(imgData, 0, 0);
      showElement('canvasHeatmap', 'heatmapPlaceholder');
      
    } catch (error) {
      console.error('فشل في عرض heatmap:', error);
    }
  }

  renderContour() {
    if (!this.grayMat || !this.contour) return;
    
    try {
      const contourCanvas = document.getElementById('canvasContour');
      if (!contourCanvas) return;
      
      const ctx = contourCanvas.getContext('2d');
      contourCanvas.width = this.grayMat.cols;
      contourCanvas.height = this.grayMat.rows;
      
      // رسم heatmap كخلفية
      const heatCanvas = document.getElementById('canvasHeatmap');
      if (heatCanvas) {
        ctx.drawImage(heatCanvas, 0, 0);
      }
      
      // رسم الكنتور الرئيسي
      this.drawContour(ctx, this.contour, '#00ff00', 2);
      
      // رسم الكنتورات الإضافية
      this.additionalContours.forEach(item => {
        this.drawContour(ctx, item.contour, '#ffff00', 1);
      });
      
      showElement('canvasContour', 'contourPlaceholder');
      
    } catch (error) {
      console.error('فشل في عرض الكنتور:', error);
    }
  }

  drawContour(ctx, contour, color, lineWidth) {
    try {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      
      const data = contour.data32S;
      for (let i = 0; i < data.length; i += 2) {
        const x = data[i], y = data[i + 1];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      
      ctx.closePath();
      ctx.stroke();
    } catch (error) {
      console.warn('فشل في رسم الكنتور:', error);
    }
  }

  sampleGrayAt(x, y) {
    if (!this.grayMat || !this.previewCanvas) return 128;
    
    try {
      const gw = this.grayMat.cols, gh = this.grayMat.rows;
      if (gw === 0 || gh === 0) return 128;
      
      const gx_f = CNCUtils.clamp((x / this.previewCanvas.width) * (gw - 1), 0, gw - 1);
      const gy_f = CNCUtils.clamp((y / this.previewCanvas.height) * (gh - 1), 0, gh - 1);
      
      const x0 = Math.floor(gx_f), y0 = Math.floor(gy_f);
      const x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1);
      const sx = gx_f - x0, sy = gy_f - y0;
      
      const idx00 = y0 * gw + x0;
      const idx10 = y0 * gw + x1;
      const idx01 = y1 * gw + x0;
      const idx11 = y1 * gw + x1;
      
      if (idx00 >= this.grayMat.data.length || idx10 >= this.grayMat.data.length || 
          idx01 >= this.grayMat.data.length || idx11 >= this.grayMat.data.length) {
        return 128;
      }
      
      const v00 = this.grayMat.data[idx00];
      const v10 = this.grayMat.data[idx10];
      const v01 = this.grayMat.data[idx01];
      const v11 = this.grayMat.data[idx11];
      
      const v0 = v00 * (1 - sx) + v10 * sx;
      const v1 = v01 * (1 - sx) + v11 * sx;
      return Math.round(v0 * (1 - sy) + v1 * sy);
    } catch (error) {
      console.warn('خطأ في أخذ عينات الرمادي:', error);
      return 128;
    }
  }

  cleanup() {
    memoryManager.cleanupMats();
    this.grayMat = null;
    this.contour = null;
    this.additionalContours = [];
  }
}

// إنشاء instance عالمي
window.opencvHandler = new OpenCVHandler();
