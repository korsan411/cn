class SimulationSystem {
  constructor() {
    this.isPlaying = false;
    this.animationFrame = null;
    this.tool = null;
    this.toolPath = null;
    this.pathPoints = [];
    this.currentIndex = 0;
    this.speed = 1.0;
    this.elapsedTime = 0;
    this.sceneId = 'threeContainer';
  }

  init() {
    try {
      // تهيئة المشهد ثلاثي الأبعاد
      threeJSHandler.initScene(this.sceneId, {
        background: 0x081224,
        fov: 60,
        controls: true,
        cameraPosition: [100, 100, 100]
      });

      // إضافة منصة العمل
      this.addWorkPlatform();
      
      // إعداد عناصر التحكم
      this.setupControls();
      
      showToast('تم تهيئة نظام المحاكاة');

    } catch (error) {
      console.error('فشل في تهيئة المحاكاة:', error);
      throw error;
    }
  }

  addWorkPlatform() {
    const scene = threeJSHandler.scenes.get(this.sceneId);
    if (!scene) return;

    const machineType = machineSettings.currentMachine;
    const settings = machineSettings.getCurrentSettings();
    
    let platformColor, workWidth, workHeight;

    switch (machineType) {
      case 'laser':
        platformColor = 0x666666;
        workWidth = CNCUtils.cmToMm(settings.workWidth) / 10;
        workHeight = CNCUtils.cmToMm(settings.workHeight) / 10;
        break;
      case 'threed':
        platformColor = 0x444444;
        workWidth = CNCUtils.cmToMm(settings.workWidth) / 10;
        workHeight = CNCUtils.cmToMm(settings.workHeight) / 10;
        break;
      default: // router
        platformColor = 0x8B4513;
        workWidth = CNCUtils.cmToMm(settings.workWidth) / 10;
        workHeight = CNCUtils.cmToMm(settings.workHeight) / 10;
        break;
    }

    const platformGeometry = new THREE.BoxGeometry(workWidth, 0.5, workHeight);
    const platformMaterial = new THREE.MeshPhongMaterial({ 
      color: platformColor 
    });
    const platformMesh = new THREE.Mesh(platformGeometry, platformMaterial);
    platformMesh.position.set(workWidth / 2, -0.25, workHeight / 2);
    scene.add(platformMesh);

    // إضافة شبكة مساعدة
    const gridHelper = new THREE.GridHelper(Math.max(workWidth, workHeight), 10);
    gridHelper.position.set(workWidth / 2, 0, workHeight / 2);
    scene.add(gridHelper);
  }

  setupControls() {
    const container = document.getElementById(this.sceneId);
    if (!container) return;

    // إزالة عناصر التحكم القديمة
    const oldControls = container.querySelector('.sim-controls');
    const oldProgress = container.querySelector('.sim-progress');
    if (oldControls) oldControls.remove();
    if (oldProgress) oldProgress.remove();

    // إنشاء عناصر التحكم
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'sim-controls';
    controlsDiv.innerHTML = `
      <button id="simPlay" title="تشغيل">▶</button>
      <button id="simPause" title="إيقاف">⏸</button>
      <button id="simReset" title="إعادة تعيين">⏮</button>
      <label>سرعة</label>
      <input id="simSpeed" type="range" min="0.2" max="3" step="0.1" value="${this.speed}">
      <span id="simSpeedLabel">${this.speed.toFixed(1)}x</span>
    `;
    container.appendChild(controlsDiv);

    const progressDiv = document.createElement('div');
    progressDiv.className = 'sim-progress';
    progressDiv.innerHTML = `
      الحالة: <span id="simStatus">جاهز</span> — 
      تقدم: <span id="simProgress">0%</span>
    `;
    container.appendChild(progressDiv);

    // إضافة event listeners
    this.setupControlEvents();
  }

  setupControlEvents() {
    document.getElementById('simPlay')?.addEventListener('click', () => this.play());
    document.getElementById('simPause')?.addEventListener('click', () => this.pause());
    document.getElementById('simReset')?.addEventListener('click', () => this.reset());
    
    const speedSlider = document.getElementById('simSpeed');
    const speedLabel = document.getElementById('simSpeedLabel');
    
    if (speedSlider && speedLabel) {
      speedSlider.addEventListener('input', (e) => {
        this.speed = parseFloat(e.target.value);
        speedLabel.textContent = this.speed.toFixed(1) + 'x';
      });
    }
  }

  loadGCode(gcode) {
    if (!gcode) {
      showToast('لا يوجد G-code للمحاكاة');
      return;
    }

    try {
      this.pathPoints = this.parseGCodeForSimulation(gcode);
      
      if (this.pathPoints.length === 0) {
        showToast('لم يتم العثور على نقاط حركة في G-code');
        return;
      }

      // إنشاء مسار مرئي
      this.createToolPathVisualization();
      
      // إنشاء نموذج الأداة
      this.createToolModel();
      
      // إعادة تعيين المحاكاة
      this.reset();
      
      showToast(`تم تحميل ${this.pathPoints.length} نقطة للمحاكاة`);

    } catch (error) {
      console.error('فشل في تحميل G-code للمحاكاة:', error);
      showToast('فشل في تحميل G-code للمحاكاة');
    }
  }

  parseGCodeForSimulation(gcode) {
    const commands = GCodeLibrary.parse(gcode);
    const points = [];
    let currentPos = { x: 0, y: 0, z: 0 };
    let pointCount = 0;
    const maxPoints = 1500;

    for (const cmd of commands) {
      if (pointCount >= maxPoints) break;
      
      if (cmd.type === 'command' && (cmd.code === 'G0' || cmd.code === 'G1')) {
        if (cmd.parameters.X !== undefined) currentPos.x = cmd.parameters.X;
        if (cmd.parameters.Y !== undefined) currentPos.y = cmd.parameters.Y;
        if (cmd.parameters.Z !== undefined) currentPos.z = cmd.parameters.Z;

        // أخذ عينات أقل للتحسين
        if (pointCount % 8 === 0) {
          points.push({ ...currentPos });
        }
        pointCount++;
      }
    }

    // إذا كان المسار كبير جداً، نخففه أكثر
    if (points.length > 2000) {
      const simplified = [];
      for (let i = 0; i < points.length; i += Math.ceil(points.length / 1000)) {
        simplified.push(points[i]);
      }
      return simplified;
    }

    return points;
  }

  createToolPathVisualization() {
    const scene = threeJSHandler.scenes.get(this.sceneId);
    if (!scene || this.pathPoints.length < 2) return;

    // إزالة المسار القديم
    if (this.toolPath) {
      scene.remove(this.toolPath);
    }

    const machineType = machineSettings.currentMachine;
    let pathColor;

    switch (machineType) {
      case 'laser':
        pathColor = 0xff4444;
        break;
      case 'threed':
        pathColor = 0x10b981;
        break;
      default: // router
        pathColor = 0x3b82f6;
        break;
    }

    this.toolPath = threeJSHandler.createToolPath(this.pathPoints, {
      color: pathColor,
      lineWidth: 2
    });

    scene.add(this.toolPath);
  }

  createToolModel() {
    const scene = threeJSHandler.scenes.get(this.sceneId);
    if (!scene) return;
