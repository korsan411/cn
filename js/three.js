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

          if (options.position) {
            object.position.set(...options.position);
          }

          scene.add(object);

          if (options.autoFitCamera !== false) {
            this.fitCameraToObject(sceneId, object);
          }

          resolve(object);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('فشل في قراءة الملف'));
      reader.readAsText(file);
    });
  }

  fitCameraToObject(sceneId, object, offset = 1.25) {
    const camera = this.cameras.get(sceneId);
    const controls = this.controls.get(sceneId);

    if (!camera || !object) return;

    const boundingBox = new THREE.Box3().setFromObject(object);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * offset;

    cameraZ *= 1.5; // مسافة إضافية

    camera.position.set(center.x, center.y, cameraZ);
    camera.lookAt(center);

    if (controls) {
      controls.target.copy(center);
      controls.update();
    }
  }

  createToolPath(points, options = {}) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];

    points.forEach(point => {
      vertices.push(point.x / 10, -point.z, point.y / 10);
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    const material = new THREE.LineBasicMaterial({
      color: options.color || 0x10b981,
      linewidth: options.lineWidth || 1
    });

    return new THREE.Line(geometry, material);
  }

  createToolModel(type = 'router') {
    const group = new THREE.Group();

    switch (type) {
      case 'laser':
        this.createLaserTool(group);
        break;
      case 'threed':
        this.create3DPrinterTool(group);
        break;
      default: // router
        this.createRouterTool(group);
        break;
    }

    return group;
  }

  createRouterTool(group) {
    const bodyGeom = new THREE.CylinderGeometry(0.6, 0.6, 6, 12);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0xff4444 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.rotation.x = Math.PI / 2;
    group.add(body);

    const tipGeom = new THREE.ConeGeometry(0.8, 2.5, 12);
    const tipMat = new THREE.MeshPhongMaterial({ color: 0xffff00 });
    const tip = new THREE.Mesh(tipGeom, tipMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 4;
    group.add(tip);

    group.scale.set(1.5, 1.5, 1.5);
  }

  createLaserTool(group) {
    const bodyGeom = new THREE.CylinderGeometry(0.4, 0.4, 8, 12);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0xff4444 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.rotation.x = Math.PI / 2;
    group.add(body);

    const lensGeom = new THREE.CylinderGeometry(0.6, 0.6, 1, 16);
    const lensMat = new THREE.MeshPhongMaterial({ color: 0x00ffff });
    const lens = new THREE.Mesh(lensGeom, lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 4.5;
    group.add(lens);

    group.scale.set(1.2, 1.2, 1.2);
  }

  create3DPrinterTool(group) {
    const bodyGeom = new THREE.CylinderGeometry(0.3, 0.3, 6, 12);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0x10b981 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.rotation.x = Math.PI / 2;
    group.add(body);

    const nozzleGeom = new THREE.ConeGeometry(0.5, 2, 12);
    const nozzleMat = new THREE.MeshPhongMaterial({ color: 0xcccccc });
    const nozzle = new THREE.Mesh(nozzleGeom, nozzleMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.z = 4;
    group.add(nozzle);

    group.scale.set(1.2, 1.2, 1.2);
  }

  cleanupScene(sceneId) {
    // إيقاف التصيير
    if (this.animations.has(sceneId)) {
      cancelAnimationFrame(this.animations.get(sceneId));
      this.animations.delete(sceneId);
    }

    // تنظيف المشهد
    const scene = this.scenes.get(sceneId);
    if (scene) {
      scene.traverse((object) => {
        if (object.isMesh) {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => this.disposeMaterial(material));
            } else {
              this.disposeMaterial(object.material);
            }
          }
        }
      });
      this.scenes.delete(sceneId);
    }

    // تنظيف العارض
    const renderer = this.renderers.get(sceneId);
    if (renderer) {
      renderer.dispose();
      this.renderers.delete(sceneId);
    }

    // تنظيف عناصر التحكم
    const controls = this.controls.get(sceneId);
    if (controls) {
      controls.dispose();
      this.controls.delete(sceneId);
    }

    // تنظيف الكاميرا
    this.cameras.delete(sceneId);
  }

  disposeMaterial(material) {
    if (material.map) material.map.dispose();
    if (material.dispose) material.dispose();
  }

  handleResize(sceneId) {
    const camera = this.cameras.get(sceneId);
    const renderer = this.renderers.get(sceneId);
    const container = renderer ? renderer.domElement.parentElement : null;

    if (camera && renderer && container) {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
  }

  // معالجة تغيير حجم النافذة لجميع المشاهد
  setupGlobalResizeHandler() {
    const handleResize = () => {
      this.scenes.forEach((_, sceneId) => {
        this.handleResize(sceneId);
      });
    };

    window.addEventListener('resize', handleResize);
  }
}

// إنشاء instance عالمي
window.threeJSHandler = new ThreeJSHandler();
window.threeJSHandler.setupGlobalResizeHandler();
