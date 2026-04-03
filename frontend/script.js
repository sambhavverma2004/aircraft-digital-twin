import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ================================
// CONFIGURATION
// ================================

const CONFIG = {
    API_URL: 'http://127.0.0.1:8000',
    UPDATE_INTERVAL: 1000, // ms
    COLOR_LERP_SPEED: 0.08, // smooth transition speed
    AUTO_ROTATE: false, // No aggressive rotation
    AUTO_ROTATE_SPEED: 0.2, // Very slow if enabled
    MODEL_PATH: './scene.gltf'
};

// ================================
// STATE MANAGEMENT
// ================================

const state = {
    leftEngineHealth: 1.0,
    rightEngineHealth: 1.0,
    targetLeftHealth: 1.0,
    targetRightHealth: 1.0,
    leftEngineMeshes: [],
    rightEngineMeshes: [],
    leftEngineLights: [],
    rightEngineLights: [],
    isConnected: false,
    isPanelOpen: false
};

// ================================
// SCENE SETUP
// ================================

let scene, camera, renderer, controls;
let aircraftModel;

function initScene() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e27);
    scene.fog = new THREE.Fog(0x0a0e27, 80, 300);
    
    // Camera - Positioned for good aircraft view
    camera = new THREE.PerspectiveCamera(
        50,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(12, 6, 20);
    camera.lookAt(0, 0, 0);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: false 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    
    document.getElementById('canvas-container').appendChild(renderer.domElement);
    
    // Controls - Smooth and responsive
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 8;
    controls.maxDistance = 60;
    controls.maxPolarAngle = Math.PI / 2 + 0.4;
    controls.autoRotate = CONFIG.AUTO_ROTATE;
    controls.autoRotateSpeed = CONFIG.AUTO_ROTATE_SPEED;
    controls.enablePan = true;
    
    // Professional Lighting Setup
    setupLighting();
    
    // Resize Handler
    window.addEventListener('resize', onWindowResize);
}

function setupLighting() {
    // Ambient Light - soft base illumination
    const ambientLight = new THREE.AmbientLight(0x404560, 0.7);
    scene.add(ambientLight);
    
    // Main Directional Light (key light)
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.8);
    mainLight.position.set(25, 40, 30);
    mainLight.castShadow = true;
    mainLight.shadow.camera.near = 1;
    mainLight.shadow.camera.far = 150;
    mainLight.shadow.camera.left = -40;
    mainLight.shadow.camera.right = 40;
    mainLight.shadow.camera.top = 40;
    mainLight.shadow.camera.bottom = -40;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.bias = -0.0001;
    scene.add(mainLight);
    
    // Hemisphere Light (sky/ground gradient)
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.5);
    scene.add(hemisphereLight);
    
    // Fill Light (reduce harsh shadows)
    const fillLight = new THREE.DirectionalLight(0x8899ff, 0.4);
    fillLight.position.set(-25, 15, -25);
    scene.add(fillLight);
    
    // Rim Light (edge definition)
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, 10, -30);
    scene.add(rimLight);
}

// ================================
// MODEL LOADING & ENGINE DETECTION
// ================================

function loadAircraftModel() {
    const loader = new GLTFLoader();
    
    console.log('🔄 Loading aircraft model...');
    
    loader.load(
        CONFIG.MODEL_PATH,
        (gltf) => {
            aircraftModel = gltf.scene;
            
            // Center model
            const box = new THREE.Box3().setFromObject(aircraftModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            aircraftModel.position.sub(center);
            
            // Scale if needed
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 20) {
                const scale = 15 / maxDim;
                aircraftModel.scale.multiplyScalar(scale);
            }
            
            // Enable shadows
            aircraftModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            scene.add(aircraftModel);
            
            // Extract engine meshes
            extractEngineMeshes(aircraftModel);
            
            // Add engine glow lights
            addEngineGlowLights();
            
            console.log('✅ Aircraft model loaded successfully');
        },
        (progress) => {
            const percent = (progress.loaded / progress.total) * 100;
            console.log(`Loading: ${percent.toFixed(1)}%`);
        },
        (error) => {
            console.error('❌ Error loading model:', error);
            createFallbackAircraft();
        }
    );
}

function extractEngineMeshes(model) {
    const left = [];
    const right = [];

    model.traverse((child) => {
        if (child.isMesh) {

            // LEFT ENGINE (pink cylinder under left wing)
            if (
                child.name === "Object_12" ||
                child.name === "Object_13" ||
                child.name === "Object_14"
            ) {
                left.push(child);
            }

            // RIGHT ENGINE (pink cylinder under right wing)
            if (
                child.name === "Object_19" ||
                child.name === "Object_21" ||
                child.name === "Object_23"
            ) {
                right.push(child);
            }
        }
    });

    state.leftEngineMeshes = left;
    state.rightEngineMeshes = right;

    console.log("LEFT:", left.map(m => m.name));
    console.log("RIGHT:", right.map(m => m.name));
}

function addEngineGlowLights() {
    // Calculate average positions for engine groups
    if (state.leftEngineMeshes.length > 0) {
        const avgPos = new THREE.Vector3();
        state.leftEngineMeshes.forEach(mesh => {
            const worldPos = new THREE.Vector3();
            mesh.getWorldPosition(worldPos);
            avgPos.add(worldPos);
        });
        avgPos.divideScalar(state.leftEngineMeshes.length);
        
        const leftGlow = new THREE.PointLight(0x00ff00, 0, 8);
        leftGlow.position.copy(avgPos);
        leftGlow.name = 'leftEngineGlow';
        scene.add(leftGlow);
        state.leftEngineLights.push(leftGlow);
    }
    
    if (state.rightEngineMeshes.length > 0) {
        const avgPos = new THREE.Vector3();
        state.rightEngineMeshes.forEach(mesh => {
            const worldPos = new THREE.Vector3();
            mesh.getWorldPosition(worldPos);
            avgPos.add(worldPos);
        });
        avgPos.divideScalar(state.rightEngineMeshes.length);
        
        const rightGlow = new THREE.PointLight(0x00ff00, 0, 8);
        rightGlow.position.copy(avgPos);
        rightGlow.name = 'rightEngineGlow';
        scene.add(rightGlow);
        state.rightEngineLights.push(rightGlow);
    }
}

function createFallbackAircraft() {
    console.log('🔧 Creating fallback aircraft');
    
    // Fuselage
    const fuselageGeometry = new THREE.CylinderGeometry(0.6, 0.5, 10, 16);
    const fuselageMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xd8d8d8,
        metalness: 0.6,
        roughness: 0.4
    });
    const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
    fuselage.rotation.z = Math.PI / 2;
    fuselage.castShadow = true;
    fuselage.receiveShadow = true;
    scene.add(fuselage);
    
    // Wings
    const wingGeometry = new THREE.BoxGeometry(16, 0.3, 3);
    const wingMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xc0c0c0,
        metalness: 0.5,
        roughness: 0.5
    });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.castShadow = true;
    wings.receiveShadow = true;
    scene.add(wings);
    
    // Engines (will change color)
    const engineGeometry = new THREE.CylinderGeometry(0.5, 0.6, 2, 16);
    
    const leftEngine = new THREE.Mesh(
        engineGeometry,
        new THREE.MeshStandardMaterial({ 
            color: 0x00ff00,
            metalness: 0.7,
            roughness: 0.3
        })
    );
    leftEngine.position.set(-5, 0, 0);
    leftEngine.rotation.z = Math.PI / 2;
    leftEngine.castShadow = true;
    scene.add(leftEngine);
    state.leftEngineMeshes.push(leftEngine);
    
    const rightEngine = new THREE.Mesh(
        engineGeometry,
        new THREE.MeshStandardMaterial({ 
            color: 0x00ff00,
            metalness: 0.7,
            roughness: 0.3
        })
    );
    rightEngine.position.set(5, 0, 0);
    rightEngine.rotation.z = Math.PI / 2;
    rightEngine.castShadow = true;
    scene.add(rightEngine);
    state.rightEngineMeshes.push(rightEngine);
    
    addEngineGlowLights();
}

// ================================
// HEALTH TO COLOR MAPPING
// ================================

function healthToColor(health) {
    // Smooth RGB gradient: Green → Yellow → Red
    let r, g, b;
    
    if (health > 0.5) {
        // Green to Yellow (1.0 → 0.5)
        const t = (health - 0.5) * 2;
        r = 1.0 - t;
        g = 1.0;
        b = 0.0;
    } else {
        // Yellow to Red (0.5 → 0.0)
        const t = health * 2;
        r = 1.0;
        g = t;
        b = 0.0;
    }
    
    return new THREE.Color(r, g, b);
}

function getHealthStatus(health) {
    if (health > 0.7) return 'OPTIMAL';
    if (health > 0.4) return 'DEGRADED';
    if (health > 0.2) return 'WARNING';
    return 'CRITICAL';
}

function getHealthColorClass(health) {
    if (health > 0.7) return 'optimal';
    if (health > 0.4) return 'degraded';
    if (health > 0.2) return 'warning';
    return 'critical';
}

// ================================
// ENGINE COLOR APPLICATION
// ================================

function updateEngineColors() {
    // Smooth interpolation (lerp)
    state.leftEngineHealth += (state.targetLeftHealth - state.leftEngineHealth) * CONFIG.COLOR_LERP_SPEED;
    state.rightEngineHealth += (state.targetRightHealth - state.rightEngineHealth) * CONFIG.COLOR_LERP_SPEED;
    
    const leftColor = healthToColor(state.leftEngineHealth);
    const rightColor = healthToColor(state.rightEngineHealth);
    
    // Apply to left engine meshes
    state.leftEngineMeshes.forEach(mesh => {
        if (mesh.material) {
            // Clone material if not already cloned
            if (!mesh.material.userData.isEngineMaterial) {
                mesh.material = mesh.material.clone();
                mesh.material.userData.isEngineMaterial = true;
            }
            
            mesh.material = new THREE.MeshStandardMaterial({
				color: leftColor,
				emissive: leftColor,
				emissiveIntensity: 0.6,
				metalness: 0.2,
				roughness: 0.5
			});
        }
    });
    
    // Apply to right engine meshes
    state.rightEngineMeshes.forEach(mesh => {
		if (mesh.material) {
			if (!mesh.material.userData.isEngineMaterial) {
				mesh.material = mesh.material.clone();
				mesh.material.userData.isEngineMaterial = true;
			}
	
			mesh.material = new THREE.MeshStandardMaterial({
				color: rightColor,
				emissive: rightColor,
				emissiveIntensity: 0.6,
				metalness: 0.2,
				roughness: 0.5
			});
		}
	});
   
    
    // Update glow lights
    state.leftEngineLights.forEach(light => {
        light.color.copy(leftColor);
        // Intensity increases as health decreases (more dramatic when failing)
        light.intensity = (1 - state.leftEngineHealth) * 3;
        
        // Pulsing effect when critical
        if (state.leftEngineHealth < 0.3) {
            light.intensity *= 1 + 0.3 * Math.sin(Date.now() * 0.005);
        }
    });
    
    state.rightEngineLights.forEach(light => {
        light.color.copy(rightColor);
        light.intensity = (1 - state.rightEngineHealth) * 3;
        
        if (state.rightEngineHealth < 0.3) {
            light.intensity *= 1 + 0.3 * Math.sin(Date.now() * 0.005);
        }
    });
}

// ================================
// API INTEGRATION
// ================================

async function fetchHealthData() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/health`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update target health
        state.targetLeftHealth = data.health;
        state.targetRightHealth = data.health;
        
        // Update connection status
        if (!state.isConnected) {
            state.isConnected = true;
            updateConnectionStatus(true);
        }
        
    } catch (error) {
        console.error('❌ API Error:', error);
        state.isConnected = false;
        updateConnectionStatus(false);
    }
}

async function resetSimulation() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/reset`);
        
        if (response.ok) {
            console.log('✅ Simulation reset');
            state.targetLeftHealth = 1.0;
            state.targetRightHealth = 1.0;
        }
    } catch (error) {
        console.error('❌ Reset failed:', error);
    }
}

// ================================
// UI UPDATES
// ================================

function updateUI() {
    // Left Engine
    const leftPercent = (state.leftEngineHealth * 100).toFixed(1);
    document.getElementById('left-health-value').textContent = `${leftPercent}%`;
    document.getElementById('left-health-bar').style.width = `${leftPercent}%`;
    document.getElementById('left-status').textContent = getHealthStatus(state.leftEngineHealth);
    
    const leftData = document.getElementById('left-engine-data');
    leftData.className = 'engine-data ' + getHealthColorClass(state.leftEngineHealth);
    
    // Right Engine
    const rightPercent = (state.rightEngineHealth * 100).toFixed(1);
    document.getElementById('right-health-value').textContent = `${rightPercent}%`;
    document.getElementById('right-health-bar').style.width = `${rightPercent}%`;
    document.getElementById('right-status').textContent = getHealthStatus(state.rightEngineHealth);
    
    const rightData = document.getElementById('right-engine-data');
    rightData.className = 'engine-data ' + getHealthColorClass(state.rightEngineHealth);
}

function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connection-status');
    if (connected) {
        statusEl.classList.add('connected');
        statusEl.innerHTML = '<span class="status-dot"></span><span class="status-text">Connected</span>';
    } else {
        statusEl.classList.remove('connected');
        statusEl.innerHTML = '<span class="status-dot"></span><span class="status-text">Disconnected</span>';
    }
}

// ================================
// PANEL CONTROLS
// ================================

function initPanelControls() {
    const panel = document.getElementById('side-panel');
    const toggleBtn = document.getElementById('panel-toggle');
    const closeBtn = document.getElementById('panel-close');
    
    toggleBtn.addEventListener('click', () => {
        state.isPanelOpen = !state.isPanelOpen;
        
        if (state.isPanelOpen) {
            panel.classList.add('open');
            toggleBtn.classList.add('hidden');
        } else {
            panel.classList.remove('open');
            toggleBtn.classList.remove('hidden');
        }
    });
    
    closeBtn.addEventListener('click', () => {
        state.isPanelOpen = false;
        panel.classList.remove('open');
        toggleBtn.classList.remove('hidden');
    });
    
    // Reset button
    document.getElementById('reset-btn').addEventListener('click', resetSimulation);
}

// ================================
// ANIMATION LOOP
// ================================

function animate() {
    requestAnimationFrame(animate);
    
    // Update controls
    controls.update();
    
    // Update engine colors (smooth transitions)
    updateEngineColors();
    
    // Update UI
    updateUI();
    
    // Render
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ================================
// INITIALIZATION
// ================================

function init() {
    console.log('🚀 Initializing Aircraft Digital Twin System...');
    
    // Setup scene
    initScene();
    
    // Load model
    loadAircraftModel();
    
    // Setup UI controls
    initPanelControls();
    
    // Start animation
    animate();
    
    // Start API polling
    setInterval(fetchHealthData, CONFIG.UPDATE_INTERVAL);
    fetchHealthData();
    
    console.log('✅ System initialized');
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}