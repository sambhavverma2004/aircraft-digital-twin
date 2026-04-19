import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;

init();

function init() {
    // SCENE
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e27);

    // CAMERA
    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        2000
    );

    // RENDERER
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // CONTROLS (FULLY WORKING)
    controls = new OrbitControls(camera, renderer.domElement);

    controls.enableDamping = true;
    controls.dampingFactor = 0.07;

    controls.enableZoom = true;
    controls.zoomSpeed = 1.2;

    controls.enablePan = true;
    controls.panSpeed = 1.0;

    controls.enableRotate = true;
    controls.rotateSpeed = 1.0;

    controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
};
    controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN
};

// 🔥 THIS IS IMPORTANT
    controls.maxPolarAngle = Math.PI;      // allow full rotation
    controls.minPolarAngle = 0;            // allow full freedom

// distance control
    controls.minDistance = 5;
    controls.maxDistance = 300;

    // LIGHTING (IMPORTANT FOR DEPTH)
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));

    const dir = new THREE.DirectionalLight(0xffffff, 2);
    dir.position.set(20, 30, 10);
    scene.add(dir);

    // LOAD MODEL
    const loader = new GLTFLoader();

    loader.load('./scene.gltf', (gltf) => {
        const model = gltf.scene;

        // CENTER MODEL (CRITICAL)
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        model.position.sub(center);

        // CAMERA POSITION BASED ON MODEL SIZE
        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.set(maxDim * 2, maxDim * 0.7, maxDim * 2);

        // FIX ORBIT TARGET
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        
        controls.update();

        // 👉 EXTRACT ENGINE MESHES (SAME AS YOUR MAIN CODE)
        const left = [];
        const right = [];

        model.traverse((child) => {
            if (!child.isMesh) return;

            if (
                child.name === "Object_12" ||
                child.name === "Object_13" ||
                child.name === "Object_14"
            ) {
                left.push(child);
            }

            if (
                child.name === "Object_19" ||
                child.name === "Object_21" ||
                child.name === "Object_23"
            ) {
                right.push(child);
            }
        });

        console.log("LEFT:", left.map(m => m.name));
        console.log("RIGHT:", right.map(m => m.name));

        // 👉 COLOR LEFT ENGINE (DIFFERENT COLORS)
        left.forEach((mesh, i) => {
            const color = new THREE.Color().setHSL(i * 0.2, 1, 0.5);

            mesh.material = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.4,
                metalness: 0.2
            });

            console.log(`LEFT ${mesh.name} → #${color.getHexString()}`);
        });

        // 👉 COLOR RIGHT ENGINE (DIFFERENT COLORS)
        right.forEach((mesh, i) => {
            const color = new THREE.Color().setHSL((i * 0.2) + 0.5, 1, 0.5);

            mesh.material = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.4,
                metalness: 0.2
            });

            console.log(`RIGHT ${mesh.name} → #${color.getHexString()}`);
        });

        // OPTIONAL: color rest of aircraft grey
        model.traverse((child) => {
            if (!child.isMesh) return;

            if (
                !left.includes(child) &&
                !right.includes(child)
            ) {
                child.material = new THREE.MeshStandardMaterial({
                    color: 0x888888,
                    roughness: 0.6
                });
            }
        });

        scene.add(model);
    });

    window.addEventListener('resize', onResize);

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}