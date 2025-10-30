class AppInitializer {
    constructor() {
        this.initializationAttempts = 0;
        this.maxAttempts = 3;
        this.initializationTimeout = 30000; // 30 seconds
    }

    async initializeWithRetry() {
        while (this.initializationAttempts < this.maxAttempts) {
            try {
                this.initializationAttempts++;
                console.log(`محاولة التهيئة ${this.initializationAttempts} من ${this.maxAttempts}`);
                
                await this.initialize();
                console.log('✅ التهيئة اكتملت بنجاح');
                return true;
                
            } catch (error) {
                console.error(`❌ فشلت محاولة التهيئة ${this.initializationAttempts}:`, error);
                
                if (this.initializationAttempts >= this.maxAttempts) {
                    ErrorHandler.handleError('INIT_FAILED', error, { attempts: this.initializationAttempts });
                    return false;
                }
                
                // الانتظار قبل إعادة المحاولة
                await this.delay(2000 * this.initializationAttempts);
            }
        }
        
        return false;
    }

    async initialize() {
        // إعداد مهلة للتهيئة
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('انتهت مهلة التهيئة')), this.initializationTimeout);
        });

        const initPromise = this.initializeStepByStep();
        
        return Promise.race([initPromise, timeoutPromise]);
    }

    async initializeStepByStep() {
        console.log('🚀 بدء التهيئة خطوة بخطوة...');

        // الخطوة 1: التحقق من المتطلبات الأساسية
        await this.checkPrerequisites();
        console.log('✅ المتطلبات الأساسية جاهزة');

        // الخطوة 2: تهيئة نظام التصحيح
        await this.initializeDebugSystem();
        console.log('✅ نظام التصحيح جاهز');

        // الخطوة 3: انتظار OpenCV
        await this.waitForOpenCV();
        console.log('✅ OpenCV جاهز');

        // الخطوة 4: تهيئة Three.js
        await this.initializeThreeJS();
        console.log('✅ Three.js جاهز');

        // الخطوة 5: تهيئة أنظمة التطبيق
        await this.initializeAppSystems();
        console.log('✅ أنظمة التطبيق جاهزة');

        // الخطوة 6: إعداد واجهة المستخدم
        await this.setupUserInterface();
        console.log('✅ واجهة المستخدم جاهزة');

        console.log('🎉 اكتملت جميع خطوات التهيئة');
    }

    async checkPrerequisites() {
        const tests = await ErrorHandler.testAllSystems();
        const failedTests = tests.filter(test => test.status === 'FAILED');
        
        if (failedTests.length > 0) {
            const errorMessages = failedTests.map(test => 
                `${test.name}: ${test.error}`
            ).join('; ');
            
            throw new Error(`فشل في اختبارات النظام: ${errorMessages}`);
        }
    }

    async initializeDebugSystem() {
        return new Promise((resolve) => {
            try {
                if (window.debugSystem && typeof debugSystem.init === 'function') {
                    debugSystem.init();
                    console.log('🐞 نظام التصحيح مهيأ');
                } else {
                    console.warn('⚠️ نظام التصحيح غير متاح');
                }
                resolve();
            } catch (error) {
                console.warn('⚠️ فشل في تهيئة نظام التصحيح:', error);
                resolve(); // المتابعة رغم فشل التصحيح
            }
        });
    }

    async waitForOpenCV() {
        return new Promise(async (resolve, reject) => {
            try {
                if (window.opencvHandler && typeof opencvHandler.waitForOpenCV === 'function') {
                    await opencvHandler.waitForOpenCV();
                    resolve();
                } else {
                    // Fallback: الانتظار لـ OpenCV مباشرة
                    await this.waitForOpenCVDirect();
                    resolve();
                }
            } catch (error) {
                reject(new Error(`فشل في تحميل OpenCV: ${error.message}`));
            }
        });
    }

    async waitForOpenCVDirect() {
        return new Promise((resolve, reject) => {
            const checkInterval = 100;
            const maxChecks = 300; // 30 ثانية كحد أقصى
            let checks = 0;

            const checkCV = () => {
                checks++;
                
                try {
                    if (typeof cv !== 'undefined' && cv.getBuildInformation) {
                        const testMat = new cv.Mat();
                        if (testMat && testMat.delete) {
                            testMat.delete();
                            resolve();
                            return;
                        }
                    }

                    if (checks >= maxChecks) {
                        reject(new Error('انتهت مهلة انتظار OpenCV'));
                        return;
                    }

                    setTimeout(checkCV, checkInterval);
                } catch (error) {
                    if (checks >= maxChecks) {
                        reject(new Error(`فشل في اختبار OpenCV: ${error.message}`));
                        return;
                    }
                    setTimeout(checkCV, checkInterval);
                }
            };

            checkCV();
        });
    }

    async initializeThreeJS() {
        return new Promise((resolve) => {
            try {
                if (typeof THREE === 'undefined') {
                    throw new Error('Three.js لم يتم تحميله');
                }

                // اختبار Three.js الأساسي
                const scene = new THREE.Scene();
                if (!scene) {
                    throw new Error('فشل في إنشاء مشهد Three.js');
                }

                console.log('🧊 Three.js جاهز للاستخدام');
                resolve();
            } catch (error) {
                console.warn('⚠️ فشل في تهيئة Three.js:', error);
                // المتابعة رغم فشل Three.js (لأنه غير ضروري للوظائف الأساسية)
                resolve();
            }
        });
    }

    async initializeAppSystems() {
        const systems = [
            { name: 'إعدادات الماكينة', init: this.initMachineSettings.bind(this) },
            { name: 'إدارة الذاكرة', init: this.initMemoryManager.bind(this) },
            { name: 'معالجة الملفات', init: this.initFileHandlers.bind(this) },
            { name: 'نظام المحاكاة', init: this.initSimulationSystem.bind(this) }
        ];

        for (const system of systems) {
            try {
                await system.init();
                console.log(`✅ ${system.name} جاهز`);
            } catch (error) {
                console.warn(`⚠️ فشل في تهيئة ${system.name}:`, error);
                // المتابعة رغم فشل بعض الأنظمة
            }
        }
    }

    async initMachineSettings() {
        if (window.machineSettings) {
            machineSettings.updateUI();
        } else {
            throw new Error('كائن إعدادات الماكينة غير موجود');
        }
    }

    async initMemoryManager() {
        if (window.memoryManager) {
            memoryManager.startAutoCleanup();
        }
    }

    async initFileHandlers() {
        if (window.fileHandlers) {
            fileHandlers.setupAllDragAndDrop();
        }
    }

    async initSimulationSystem() {
        if (window.simulationSystem) {
            try {
                simulationSystem.init();
            } catch (error) {
                console.warn('فشل في تهيئة نظام المحاكاة:', error);
            }
        }
    }

    async setupUserInterface() {
        return new Promise((resolve) => {
            try {
                // تهيئة واجهة المستخدم بشكل متدرج
                this.setupTabs();
                this.setupEventListeners();
                this.updateUI();
                
                console.log('🎨 واجهة المستخدم مهيأة');
                resolve();
            } catch (error) {
                console.warn('⚠️ فشل في إعداد واجهة المستخدم:', error);
                resolve(); // المتابعة رغم فشل واجهة المستخدم
            }
        });
    }

    setupTabs() {
        try {
            const tabButtons = document.querySelectorAll('.tab-buttons button');
            if (tabButtons.length === 0) {
                throw new Error('لم يتم العثور على أزرار التبويبات');
            }

            tabButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    const tabId = e.target.getAttribute('data-tab');
                    this.switchTab(tabId);
                });
            });

            // تفعيل التبويب الأول
            const firstTab = tabButtons[0];
            if (firstTab) {
                const firstTabId = firstTab.getAttribute('data-tab');
                this.switchTab(firstTabId);
            }
        } catch (error) {
            throw new Error(`فشل في إعداد التبويبات: ${error.message}`);
        }
    }

    switchTab(tabId) {
        try {
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
            
        } catch (error) {
            console.warn('فشل في تبديل التبويب:', error);
        }
    }

    setupEventListeners() {
        try {
            // إعداد المستمعين الأساسيين
            this.setupBasicEventListeners();
            this.setupMachineTypeSwitch();
            this.setupDimensionInputs();
            
        } catch (error) {
            console.warn('فشل في إعداد مستمعين الأحداث:', error);
        }
    }

    setupBasicEventListeners() {
        // إعدادات حساسية الحواف
        const edgeSensitivity = document.getElementById('edgeSensitivity');
        const edgeValue = document.getElementById('edgeValue');
        
        if (edgeSensitivity && edgeValue) {
            edgeSensitivity.addEventListener('input', (e) => {
                edgeValue.textContent = parseFloat(e.target.value).toFixed(2);
            });
        }

        // تحديث حالة OpenCV
        this.updateCVState('✅ OpenCV جاهز');
    }

    setupMachineTypeSwitch() {
        const machineCategory = document.getElementById('machineCategory');
        if (machineCategory) {
            machineCategory.addEventListener('change', (e) => {
                if (window.machineSettings) {
                    machineSettings.switchMachine(e.target.value);
                }
            });
        }
    }

    setupDimensionInputs() {
        const dimensionInputs = [
            'workWidth', 'workHeight', 'laserWorkWidth', 'laserWorkHeight', 
            'threedWorkWidth', 'threedWorkHeight'
        ];

        dimensionInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', () => {
                    if (window.machineSettings) {
                        machineSettings.updateDimensionDisplay();
                    }
                });
            }
        });
    }

    updateUI() {
        try {
            // تحديث حالة OpenCV
            this.updateCVState('✅ التطبيق جاهز للاستخدام');
            
            // إظهار رسالة ترحيب
            showToast('تم تحميل التطبيق بنجاح!', 2000);
            
        } catch (error) {
            console.warn('فشل في تحديث واجهة المستخدم:', error);
        }
    }

    updateCVState(message) {
        try {
            const cvState = document.getElementById('cvState');
            if (cvState) {
                cvState.innerHTML = message;
            }
        } catch (error) {
            console.warn('فشل في تحديث حالة OpenCV:', error);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async emergencyFallback() {
        console.log('🚨 تفعيل وضع الطوارئ...');
        
        // إظهار واجهة مبسطة
        this.showEmergencyUI();
        
        // تعطيل الوظائف المتقدمة
        this.disableAdvancedFeatures();
        
        // إظهار رسالة للمستخدم
        showToast('تم تحميل الوضع الأساسي بسبب مشاكل في النظام', 5000);
    }

    showEmergencyUI() {
        try {
            // إخفاء الأقسام المتقدمة
            const advancedSections = document.querySelectorAll('.colormap-section, .file-format-section, #adv-machine-card');
            advancedSections.forEach(section => {
                if (section) section.style.display = 'none';
            });
            
            // إظهار رسالة
            const emergencyMsg = document.createElement('div');
            emergencyMsg.className = 'emergency-message';
            emergencyMsg.innerHTML = `
                <div style="background: #fef3cd; color: #856404; padding: 12px; border-radius: 8px; margin: 10px 0; text-align: center;">
                    ⚠️ الوضع الأساسي: بعض الميزات غير متاحة
                </div>
            `;
            
            const header = document.querySelector('header');
            if (header) {
                header.parentNode.insertBefore(emergencyMsg, header.nextSibling);
            }
        } catch (error) {
            console.warn('فشل في إظهار واجهة الطوارئ:', error);
        }
    }

    disableAdvancedFeatures() {
        // تعطيل الأزرار المتقدمة
        const advancedButtons = document.querySelectorAll('#btnQuick, #btnContour, #btnLaserQuick, #btnLaserCut, #btnPreviewLayers');
        advancedButtons.forEach(btn => {
            if (btn) btn.disabled = true;
        });
    }
}

// وظيفة التهيئة الرئيسية المعدلة
async function initializeAppWithFallback() {
    const initializer = new AppInitializer();
    
    try {
        const success = await initializer.initializeWithRetry();
        
        if (!success) {
            console.warn('🔴 فشلت جميع محاولات التهيئة، تفعيل وضع الطوارئ');
            await initializer.emergencyFallback();
        }
        
    } catch (error) {
        console.error('🔴 فشل كارثي في التهيئة:', error);
        ErrorHandler.handleError('FATAL_INIT_ERROR', error);
        
        // عرض رسالة نهائية
        showToast('فشل في تحميل التطبيق. يرجى تحديث الصفحة.', 10000);
    }
}

// استبدال التهيئة الأصلية
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 بدء تهيئة التطبيق مع نظام الاسترجاع...');
    initializeAppWithFallback();
});
