class MemoryManager {
  constructor() {
    this.mats = new Set();
    this.maxMats = 20;
    this.totalAllocated = 0;
  }

  track(mat, name = 'mat') {
    try {
      if (mat && !this.isMatDeleted(mat)) {
        this.mats.add({ mat, name, timestamp: Date.now() });
        this.totalAllocated++;
        
        // تنظيف الذاكرة إذا تجاوزنا الحد
        if (this.mats.size > this.maxMats) {
          this.cleanupOldest();
        }
      }
    } catch (error) {
      console.warn('فشل في تتبع المصفوفة:', error);
    }
  }

  isMatDeleted(mat) {
    try {
      return !mat || typeof mat.delete !== 'function' || mat.isDeleted;
    } catch {
      return true;
    }
  }

  cleanupOldest() {
    try {
      if (this.mats.size === 0) return;
      
      const matsArray = Array.from(this.mats);
      // ترتيب حسب الأقدم
      matsArray.sort((a, b) => a.timestamp - b.timestamp);
      
      // حذف أقدم 25%
      const toDelete = Math.max(1, Math.floor(this.mats.size * 0.25));
      
      for (let i = 0; i < toDelete; i++) {
        const item = matsArray[i];
        if (item) {
          this.safeDelete(item.mat, item.name);
          this.mats.delete(item);
        }
      }
    } catch (error) {
      console.warn('فشل في تنظيف أقدم المصفوفات:', error);
    }
  }

  safeDelete(mat, name = 'mat') {
    try {
      if (!this.isMatDeleted(mat) && typeof mat.delete === 'function') {
        mat.delete();
        mat.isDeleted = true;
        console.log(`🧹 تم حذف ${name} بأمان`);
      }
    } catch (error) {
      console.warn(`فشل في حذف ${name}:`, error);
    }
  }

  cleanupAll() {
    try {
      this.mats.forEach(item => {
        this.safeDelete(item.mat, item.name);
      });
      this.mats.clear();
      this.totalAllocated = 0;
      console.log('🧹 تم تنظيف جميع المصفوفات');
    } catch (error) {
      console.warn('فشل في التنظيف الكامل:', error);
    }
  }

  cleanupMats() {
    // تنظيف المصفوفات المؤقتة
    const tempMats = [
      window.grayMat,
      window.contour,
      ...(window.additionalContours || []).map(c => c.contour)
    ].filter(Boolean);
    
    tempMats.forEach(mat => {
      if (!this.isMatDeleted(mat)) {
        this.safeDelete(mat, 'temp-mat');
      }
    });
    
    window.grayMat = null;
    window.contour = null;
    window.additionalContours = [];
  }

  getMemoryUsage() {
    return {
      current: this.mats.size,
      total: this.totalAllocated,
      max: this.maxMats
    };
  }

  // تنظيف دوري للذاكرة
  startAutoCleanup(interval = 30000) {
    this.cleanupInterval = setInterval(() => {
      if (this.mats.size > this.maxMats * 0.7) {
        this.cleanupOldest();
      }
    }, interval);
  }

  stopAutoCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// إنشاء instance عالمي
window.memoryManager = new MemoryManager();
window.memoryManager.startAutoCleanup();
