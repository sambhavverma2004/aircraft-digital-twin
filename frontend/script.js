console.log("🔥 NEW SCRIPT LOADED");
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ================================
// CONFIGURATION
// ================================
const STATUS_COLORS = {
    optimal: "#00ff88",   // green
    degraded: "#ffee00",  // yellow
    warning: "#ff8800",   // orange
    critical: "#ff0000"   // red
};
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
    leftStatus: 'OPTIMAL',
    rightStatus: 'OPTIMAL',
    leftRUL: 0,
    rightRUL: 0,
    leftCycle: 0,
    rightCycle: 0,
    leftExplanation: [],
    rightExplanation: [],
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
const loader = new THREE.TextureLoader();
function initScene() {
    // Scene
    scene = new THREE.Scene();
    loader.load('sky.jpg', function(texture) {
        scene.background = texture;
    });
    
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
            
            // Extract engine meshes (HARDCODED)
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

    const engineCandidates = [
        "Object_12", "Object_13", "Object_14",
        "Object_19", "Object_21", "Object_23"
    ];

    model.traverse((child) => {
        if (!child.isMesh) return;
        if (!engineCandidates.includes(child.name)) return;

        // 🔥 REAL POSITION FROM GEOMETRY
        child.geometry.computeBoundingBox();

        const center = new THREE.Vector3();
        child.geometry.boundingBox.getCenter(center);

        child.localToWorld(center);

        console.log(child.name, "REAL X:", center.x.toFixed(3));

        if (center.x < 0) {
            left.push(child);
        } else {
            right.push(child);
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
    if (health > 0.7) return new THREE.Color(STATUS_COLORS.optimal);
    if (health > 0.4) return new THREE.Color(STATUS_COLORS.degraded);
    if (health > 0.2) return new THREE.Color(STATUS_COLORS.warning);
    return new THREE.Color(STATUS_COLORS.critical);
}

function getHealthColorClass(health) {
    if (health > 0.7) return 'optimal';
    if (health > 0.4) return 'degraded';
    if (health > 0.2) return 'warning';
    return 'critical';
}

// ================================
// ENGINE COLOR APPLICATION (MULTI-MATERIAL SUPPORT)
// ================================


function updateEngineColors() {
    if (state.leftEngineMeshes.length === 0) return;

    state.leftEngineHealth += (state.targetLeftHealth - state.leftEngineHealth) * CONFIG.COLOR_LERP_SPEED;
    state.rightEngineHealth += (state.targetRightHealth - state.rightEngineHealth) * CONFIG.COLOR_LERP_SPEED;

    const unifiedHealth = (state.leftEngineHealth + state.rightEngineHealth) / 2;
    const unifiedColor = healthToColor(unifiedHealth);

    state.leftEngineMeshes.forEach(mesh => {
        if (!mesh.material.userData.isEngineMaterial) {
            mesh.material = mesh.material.clone();
            mesh.material.userData.isEngineMaterial = true;
        }
    
        mesh.material = new THREE.MeshStandardMaterial({
            color: unifiedColor,
            emissive: unifiedColor,
            emissiveIntensity: 0.6,
            metalness: 0.2,
            roughness: 0.5
        });
    });
}

// ================================
// API INTEGRATION - DUAL ENGINE
// ================================

async function fetchHealthData() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/health`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('📡 API DATA:', data); // DEBUG LOG
        
        // Update target health for BOTH engines
        state.targetLeftHealth = data.left_engine;
        state.targetRightHealth = data.right_engine;
        
        // Update status
        state.leftStatus = data.left_status;
        state.rightStatus = data.right_status;
        
        // Update RUL
        state.leftRUL = data.left_rul;
        state.rightRUL = data.right_rul;
        
        // Update cycles
        state.leftCycle = data.left_cycle;
        state.rightCycle = data.right_cycle;
        
        // Update explanations (SAFE ACCESS)
        state.leftExplanation = (data.explanation && data.explanation.left) ? data.explanation.left : [];
        state.rightExplanation = (data.explanation && data.explanation.right) ? data.explanation.right : [];
        
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
        const response = await fetch(`${CONFIG.API_URL}/reset`, {
            method: 'POST'
        });
        
        if (response.ok) {
            console.log('✅ Simulation reset');
            state.targetLeftHealth = 1.0;
            state.targetRightHealth = 1.0;
            state.leftStatus = 'OPTIMAL';
            state.rightStatus = 'OPTIMAL';
        }
    } catch (error) {
        console.error('❌ Reset failed:', error);
    }
}

// ================================
// UI UPDATES - DUAL ENGINE + RUL + EXPLANATION
// ================================

function updateUI() {
    // Left Engine - Health Percentage
    const leftPercent = (state.leftEngineHealth * 100).toFixed(1);
    const leftHealthEl = document.getElementById('left-health-value');
    if (leftHealthEl) {
        leftHealthEl.textContent = `${leftPercent}%`;
    }
    
    // Left Engine - Health Bar
    const leftBarEl = document.getElementById('left-health-bar');
    if (leftBarEl) {
        leftBarEl.style.width = `${leftPercent}%`;
    }
    
    // Left Engine - Status
    const leftStatusEl = document.getElementById('left-status');
    if (leftStatusEl) {
        leftStatusEl.textContent = state.leftStatus;
    }
    
    // Left Engine - RUL
    const leftRULEl = document.getElementById('left-rul');
    if (leftRULEl) {
        leftRULEl.textContent = `RUL: ${state.leftRUL.toFixed(1)} cycles`;
    }
    
    // Left Engine - Cycle
    const leftCycleEl = document.getElementById('left-cycle');
    if (leftCycleEl) {
        leftCycleEl.textContent = `Cycle: ${state.leftCycle}`;
    }
    
    // Left Engine - Container Class
    const leftData = document.getElementById('left-engine-data');
    if (leftData) {
        leftData.className = 'engine-data ' + getHealthColorClass(state.leftEngineHealth);
    }
    
    // Right Engine - Health Percentage
    const rightPercent = (state.rightEngineHealth * 100).toFixed(1);
    const rightHealthEl = document.getElementById('right-health-value');
    if (rightHealthEl) {
        rightHealthEl.textContent = `${rightPercent}%`;
    }
    
    // Right Engine - Health Bar
    const rightBarEl = document.getElementById('right-health-bar');
    if (rightBarEl) {
        rightBarEl.style.width = `${rightPercent}%`;
    }
    
    // Right Engine - Status
    const rightStatusEl = document.getElementById('right-status');
    if (rightStatusEl) {
        rightStatusEl.textContent = state.rightStatus;
    }
    
    // Right Engine - RUL
    const rightRULEl = document.getElementById('right-rul');
    if (rightRULEl) {
        rightRULEl.textContent = `RUL: ${state.rightRUL.toFixed(1)} cycles`;
    }
    
    // Right Engine - Cycle
    const rightCycleEl = document.getElementById('right-cycle');
    if (rightCycleEl) {
        rightCycleEl.textContent = `Cycle: ${state.rightCycle}`;
    }
    
    // Right Engine - Container Class
    const rightData = document.getElementById('right-engine-data');
    if (rightData) {
        rightData.className = 'engine-data ' + getHealthColorClass(state.rightEngineHealth);
    }
    
    // Update explanations
    updateExplanationDisplay();
}

function updateExplanationDisplay() {
    // Left Engine Explanation
    const leftExplanationEl = document.getElementById('left-explanation');
    if (leftExplanationEl) {
        if (state.leftExplanation && state.leftExplanation.length > 0) {
            const topFactors = state.leftExplanation
                .filter(item => item.feature !== "cycle")   // ADD THIS LINE
                .slice(0, 3)
                .map(item => `<div class="factor-item">${item.feature}: ${item.importance.toFixed(3)}</div>`)
                .join('');
            leftExplanationEl.innerHTML = `<div class="factors-label">Top Factors:</div>${topFactors}`;
        } else {
            leftExplanationEl.innerHTML = '<div class="factors-label">Waiting for data...</div>';
        }
    }
    
    // Right Engine Explanation
    const rightExplanationEl = document.getElementById('right-explanation');
    if (rightExplanationEl) {
        if (state.rightExplanation && state.rightExplanation.length > 0) {
            const topFactors = state.rightExplanation
                .filter(item => item.feature !== "cycle")   // ADD THIS LINE
                .slice(0, 3)
                .map(item => `<div class="factor-item">${item.feature}: ${item.importance.toFixed(3)}</div>`)
                .join('');
            rightExplanationEl.innerHTML = `<div class="factors-label">Top Factors:</div>${topFactors}`;
        } else {
            rightExplanationEl.innerHTML = '<div class="factors-label">Waiting for data...</div>';
        }
    }
}

function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        if (connected) {
            statusEl.classList.add('connected');
            statusEl.innerHTML = '<span class="status-dot"></span><span class="status-text">Connected</span>';
        } else {
            statusEl.classList.remove('connected');
            statusEl.innerHTML = '<span class="status-dot"></span><span class="status-text">Disconnected</span>';
        }
    }
}

// ================================
// PANEL CONTROLS
// ================================

function initPanelControls() {
    const panel = document.getElementById('side-panel');
    const toggleBtn = document.getElementById('panel-toggle');
    const closeBtn = document.getElementById('panel-close');
    const resetBtn = document.getElementById('reset-btn');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            state.isPanelOpen = !state.isPanelOpen;
            
            if (panel) {
                if (state.isPanelOpen) {
                    panel.classList.add('open');
                    toggleBtn.classList.add('hidden');
                } else {
                    panel.classList.remove('open');
                    toggleBtn.classList.remove('hidden');
                }
            }
        });
    }
    
    if (closeBtn && panel) {
        closeBtn.addEventListener('click', () => {
            state.isPanelOpen = false;
            panel.classList.remove('open');
            if (toggleBtn) {
                toggleBtn.classList.remove('hidden');
            }
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', resetSimulation);
    }
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
