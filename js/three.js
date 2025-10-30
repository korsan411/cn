class ThreeJSHandler {
  constructor() {
    this.scenes = new Map();
    this.renderers = new Map();
    this.cameras = new Map();
    this.controls = new Map();
    this.animations = new Map();
  }

  initScene(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`الحاوية ${containerId} غير موجودة`);
    }

    const sceneId = containerId;
    
    // تنظيف المشهد السابق إذا موجود
    this.cleanupScene(sceneId);

    // إنشاء المشهد
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(options.background || 0x041022);

    // إنشاء الكاميرا
    const camera = new THREE.PerspectiveCamera(
      options.fov || 75,
      container.clientWidth / container.clientHeight,
      options.near || 0.1,
      options.far || 1000
    );
    camera.position.set(...(options.cameraPosition || [0, 0, 5]));

    // إنشاء العارض
    const renderer = new THREE.WebGLRenderer({ 
      antialias: options.antialias !== false,
      alpha: options.alpha || false
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // إضافة عناصر التحكم إذا كانت متاحة
    let controls = null;
    if (options.controls !== false && typeof THREE.OrbitControls !== 'undefined') {
      try {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
      } catch (error) {
        console.warn('فشل في تهيئة OrbitControls:', error);
      }
    }

    // إضافة إضاءة أساسية
    this.setupBasicLighting(scene, options.lighting);

    // حفظ المرجع
    this.scenes.set(sceneId, scene);
    this.cameras.set(sceneId, camera);
    this.renderers.set(sceneId, renderer);
    this.controls.set(sceneId, controls);

    // بدء التصيير
    this.startRendering(sceneId);

    return { scene, camera, renderer, controls };
  }

  setupBasicLighting(scene, options = {}) {
    const ambientLight = new THREE.AmbientLight(
      options.ambientColor || 0x404040,
      options.ambientIntensity || 0.6
    );
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(
      options.directionalColor || 0xffffff,
      options.directionalIntensity || 0.8
    );
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    return { ambientLight, directionalLight };
  }

  startRendering(sceneId) {
    const scene = this.scenes.get(sceneId);
    const camera = this.cameras.get(sceneId);
    const renderer = this.renderers.get(sceneId);
    const controls = this.controls.get(sceneId);

    if (!scene || !camera || !renderer) return;

    const animate = () => {
      this.animations.set(sceneId, requestAnimationFrame(animate));

      if (controls) {
        controls.update();
      }

      renderer.render(scene, camera);
    };

    animate();
  }

  loadSTLModel(file, sceneId, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.scenes.has(sceneId)) {
        reject(new Error(`المشهد ${sceneId} غير مهيأ`));
        return;
      }

      const scene = this.scenes.get(sceneId);
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const loader = new THREE.STLLoader();
          const geometry = loader.parse(event.target.result);

          const material = new THREE.MeshPhongMaterial({
            color: options.color || 0x049ef4,
            specular: options.specular || 0x111111,
            shininess: options.shininess || 200
          });

          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = mesh.receiveShadow = true;

          if (options.position) {
            mesh.position.set(...options.position);
          }

          scene.add(mesh);

          // ضبط الكاميرا لتناسب الموديل
          if (options.autoFitCamera !== false) {
            this.fitCameraToObject(sceneId, mesh);
          }

          resolve(mesh);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('فشل في قراءة الملف'));
      reader.readAsArrayBuffer(file);
    });
  }

  loadOBJModel(file, sceneId, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.scenes.has(sceneId)) {
        reject(new Error(`المشهد ${sceneId} غير مهيأ`));
        return;
      }

      const scene = this.scenes.get(sceneId);
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const loader = new THREE.OBJLoader();
          const object = loader.parse(event.target.result);

          object.traverse((child) => {
            if (child.isMesh) {
              child.material = child.material || new THREE.MeshStandardMaterial({
                color: options.color || 0xcccccc
              });
              child.castShadow = child.receiveShadow = true;
            }
          });

          if (options.position
