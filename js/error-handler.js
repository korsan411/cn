class ErrorHandler {
    static init() {
        // التقاط جميع الأخطاء غير المعالجة
        window.addEventListener('error', (event) => {
            this.handleError('UNHANDLED_ERROR', event.error);
        });

        // التقاط وعود مرفوضة غير معالجة
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError('UNHANDLED_PROMISE', event.reason);
        });

        // التقاط أخطاء التحميل
        window.addEventListener('load', () => {
            this.checkResourceLoading();
        });
    }

    static handleError(type, error, context = {}) {
        const errorInfo = {
            type,
            message: error?.message || 'Unknown error',
            stack: error?.stack,
            timestamp: new Date().toISOString(),
            context,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        console.error(`[${type}]`, errorInfo);

        // عرض رسالة للمستخدم
        this.showUserFriendlyError(errorInfo);

        // إرسال إلى نظام التصحيح
        if (window.debugSystem) {
            window.debugSystem.error(`${type}: ${errorInfo.message}`, error);
        }

        // حفظ في localStorage للتحليل لاحقاً
        this.saveError(errorInfo);
    }

    static showUserFriendlyError(errorInfo) {
        let userMessage = 'حدث خطأ غير متوقع';

        switch (errorInfo.type) {
            case 'OPENCV_LOAD_FAILED':
                userMessage = 'فشل في تحميل مكتبة معالجة الصور. تأكد من الاتصال بالإنترنت.';
                break;
            case 'THREEJS_LOAD_FAILED':
                userMessage = 'فشل في تحميل مكتبة الرسومات ثلاثية الأبعاد.';
                break;
            case 'INIT_FAILED':
                userMessage = 'فشل في تهيئة التطبيق. جاري إعادة المحاولة...';
                break;
            case 'MEMORY_ERROR':
                userMessage = 'خطأ في الذاكرة. جاري تنظيف الموارد...';
                break;
        }

        showToast(userMessage, 5000);

        // إظهار زر إعادة المحاولة للأخطاء الحرجة
        if (this.isCriticalError(errorInfo)) {
            this.showRetryButton();
        }
    }

    static isCriticalError(errorInfo) {
        const criticalErrors = ['OPENCV_LOAD_FAILED', 'THREEJS_LOAD_FAILED', 'INIT_FAILED'];
        return criticalErrors.includes(errorInfo.type);
    }

    static showRetryButton() {
        const retryBtn = document.createElement('button');
        retryBtn.textContent = 'إعادة المحاولة';
        retryBtn.className = 'primary';
        retryBtn.style.margin = '10px auto';
        retryBtn.style.display = 'block';
        
        retryBtn.onclick = () => {
            window.location.reload();
        };

        const toast = document.getElementById('toast');
        if (toast) {
            toast.appendChild(retryBtn);
        }
    }

    static saveError(errorInfo) {
        try {
            const errors = JSON.parse(localStorage.getItem('cnc_errors') || '[]');
            errors.push(errorInfo);
            
            // حفظ آخر 50 خطأ فقط
            if (errors.length > 50) {
                errors.splice(0, errors.length - 50);
            }
            
            localStorage.setItem('cnc_errors', JSON.stringify(errors));
        } catch (e) {
            console.warn('Failed to save error to localStorage:', e);
        }
    }

    static getStoredErrors() {
        try {
            return JSON.parse(localStorage.getItem('cnc_errors') || '[]');
        } catch {
            return [];
        }
    }

    static clearStoredErrors() {
        try {
            localStorage.removeItem('cnc_errors');
        } catch (e) {
            console.warn('Failed to clear stored errors:', e);
        }
    }

    static checkResourceLoading() {
        // التحقق من تحميل الموارد الحرجة
        const criticalResources = [
            'https://docs.opencv.org/4.8.0/opencv.js',
            'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
        ];

        criticalResources.forEach(resource => {
            const img = new Image();
            img.onerror = () => {
                this.handleError('RESOURCE_LOAD_FAILED', new Error(`Failed to load: ${resource}`));
            };
            img.src = resource + '?check=' + Date.now();
        });
    }

    static async testAllSystems() {
        const tests = [
            { name: 'OpenCV', test: this.testOpenCV },
            { name: 'Three.js', test: this.testThreeJS },
            { name: 'DOM', test: this.testDOM },
            { name: 'WebGL', test: this.testWebGL },
            { name: 'Memory', test: this.testMemory }
        ];

        const results = [];

        for (const test of tests) {
            try {
                await test.test();
                results.push({ name: test.name, status: 'PASSED' });
            } catch (error) {
                results.push({ name: test.name, status: 'FAILED', error: error.message });
            }
        }

        return results;
    }

    static async testOpenCV() {
        return new Promise((resolve, reject) => {
            if (typeof cv === 'undefined') {
                reject(new Error('OpenCV not loaded'));
                return;
            }

            try {
                // اختبار بسيط لـ OpenCV
                const mat = new cv.Mat();
                if (!mat || typeof mat.delete !== 'function') {
                    reject(new Error('OpenCV Mat creation failed'));
                } else {
                    mat.delete();
                    resolve();
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    static async testThreeJS() {
        return new Promise((resolve, reject) => {
            if (typeof THREE === 'undefined') {
                reject(new Error('Three.js not loaded'));
                return;
            }

            try {
                // اختبار بسيط لـ Three.js
                const scene = new THREE.Scene();
                if (!scene) {
                    reject(new Error('Three.js scene creation failed'));
                } else {
                    resolve();
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    static async testDOM() {
        return new Promise((resolve, reject) => {
            const requiredElements = [
                'canvasOriginal',
                'gcodeOut',
                'routerSettings',
                'laserSettings',
                'threedSettings'
            ];

            const missing = requiredElements.filter(id => !document.getElementById(id));
            
            if (missing.length > 0) {
                reject(new Error(`Missing DOM elements: ${missing.join(', ')}`));
            } else {
                resolve();
            }
        });
    }

    static async testWebGL() {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (!gl) {
                reject(new Error('WebGL not supported'));
            } else {
                resolve();
            }
        });
    }

    static async testMemory() {
        return new Promise((resolve, reject) => {
            // اختبار الذاكرة الأساسي
            if (navigator.deviceMemory && navigator.deviceMemory < 2) {
                reject(new Error('Low device memory'));
            } else {
                resolve();
            }
        });
    }
}

// Initialize error handler immediately
ErrorHandler.init();
