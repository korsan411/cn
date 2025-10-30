class TaskManager {
  constructor() {
    this.queue = [];
    this.isRunning = false;
    this.currentTask = null;
    this.maxConcurrent = 1;
  }

  async addTask(taskFn, description = 'مهمة') {
    return new Promise((resolve, reject) => {
      this.queue.push({ 
        taskFn, 
        description, 
        resolve, 
        reject,
        timestamp: Date.now()
      });
      
      if (!this.isRunning) {
        this.processQueue();
      }
    });
  }

  async processQueue() {
    if (this.queue.length === 0 || this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      this.currentTask = task;

      try {
        this.showProgress(task.description);
        const result = await task.taskFn();
        task.resolve(result);
      } catch (error) {
        console.error(`فشل في ${task.description}:`, error);
        showToast(`فشل في ${task.description}: ${error.message}`, 5000);
        task.reject(error);
      } finally {
        this.currentTask = null;
        this.hideProgress();
        
        // إضافة تأخير بسيط بين المهام
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    this.isRunning = false;
  }

  showProgress(message = 'جاري المعالجة...') {
    try {
      const progressText = document.getElementById('progressText');
      const progressOverlay = document.getElementById('progressOverlay');
      
      if (progressText) progressText.textContent = message;
      if (progressOverlay) progressOverlay.style.display = 'flex';
    } catch (error) {
      console.warn('فشل في عرض التقدم:', error);
    }
  }

  hideProgress() {
    try {
      const progressOverlay = document.getElementById('progressOverlay');
      if (progressOverlay) progressOverlay.style.display = 'none';
    } catch (error) {
      console.warn('فشل في إخفاء التقدم:', error);
    }
  }

  clear() {
    this.queue = [];
    this.isRunning = false;
    this.currentTask = null;
    this.hideProgress();
  }

  getQueueLength() {
    return this.queue.length;
  }

  getRunningTask() {
    return this.currentTask;
  }
}

// إنشاء instance عالمي
window.taskManager = new TaskManager();
window.CncTaskManager = window.taskManager;
