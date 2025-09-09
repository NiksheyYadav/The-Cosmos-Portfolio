// Initialize Animate On Scroll (AOS) library
AOS.init();

// --- Three.js Scene Setup ---
let scene, camera, renderer, sceneObject, composer, tesseract, orbitingTorus, clock, particles, shootingStars = [], galaxyGroup, currentBassScale = 1;
let mouseX = 0, mouseY = 0;
let targetX = 0, targetY = 0; // For smooth interpolation
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

// --- Tesseract Constants ---
const tesseractVertices4D = [];
for (let i = 0; i < 16; i++) {
    tesseractVertices4D.push(new THREE.Vector4(
        (i & 1) ? 0.5 : -0.5, // x
        (i & 2) ? 0.5 : -0.5, // y
        (i & 4) ? 0.5 : -0.5, // z
        (i & 8) ? 0.5 : -0.5  // w
    ));
}
const tesseractEdges = [];
for (let i = 0; i < 16; i++) {
    for (let j = i + 1; j < 16; j++) {
        // An edge exists if the vertices differ in exactly one coordinate.
        // This is equivalent to the Hamming distance of their indices being 1.
        const diff = i ^ j;
        if ((diff & (diff - 1)) === 0) { // Check if diff is a power of 2
            tesseractEdges.push(i, j);
        }
    }
}

// --- Audio Logic Variables ---
const audio = document.getElementById('background-audio');
const soundBtn = document.getElementById('sound-toggle');
const iconOn = soundBtn.querySelector('.icon-sound-on');
const iconOff = soundBtn.querySelector('.icon-sound-off');
const nextTrackBtn = document.getElementById('next-track-btn');
const volumeSlider = document.getElementById('volume-slider');
const bassToggleButton = document.getElementById('bass-toggle-btn');

const soundtracks = [
    'meditation-yoga-relaxing-music-380330.mp3',
    'Interstellar LOFI.mp3',
    'Interstellar Main Theme.mp3'
];

let currentTrackIndex = parseInt(sessionStorage.getItem('currentTrackIndex')) || 0;
let isPlaying = sessionStorage.getItem('audioPlaying') === 'true';
let isBassEffectEnabled = false;
let audioContext, audioSource, analyser, dataArray;

audio.src = soundtracks[currentTrackIndex];
const savedVolume = localStorage.getItem('audioVolume');
if (savedVolume !== null) {
    audio.volume = savedVolume;
    volumeSlider.value = savedVolume * 100;
}
updateSoundIcon(); // Set initial icon state on page load

function init3D() {
    clock = new THREE.Clock();
    const container = document.getElementById('three-js-container');

    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // Renderer
    renderer = new THREE.WebGLRenderer({ alpha: true }); // alpha:true makes background transparent
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Improve quality on high-res screens
    container.appendChild(renderer.domElement);

    // Object
    const mainGeometry = new THREE.IcosahedronGeometry(2, 0); // A 20-sided shape
    const mainMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true }); // Neon Cyan
    sceneObject = new THREE.Mesh(mainGeometry, mainMaterial);
    scene.add(sceneObject);

    // Create Tesseract
    const tesseractGeometry = new THREE.BufferGeometry();
    const tesseractMaterial = new THREE.LineBasicMaterial({ color: 0xff00ff }); // Neon Magenta
    tesseract = new THREE.LineSegments(tesseractGeometry, tesseractMaterial);
    scene.add(tesseract);

    // Create the smaller, orbiting torus
    const torusGeometry = new THREE.TorusGeometry(0.4, 0.1, 16, 100);
    const torusMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true }); // Neon Magenta
    orbitingTorus = new THREE.Mesh(torusGeometry, torusMaterial);
    scene.add(orbitingTorus);

    // Create Interactive Particles
    const particleCount = 5000;
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 25; // x
        positions[i3 + 1] = (Math.random() - 0.5) * 25; // y
        positions[i3 + 2] = (Math.random() - 0.5) * 25; // z
    }

    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.015,
        color: 0xffffff,
        transparent: true,
        opacity: 0.6
    });
    particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);

    // Create a group to hold all distant galaxies, so they move as one unit
    galaxyGroup = new THREE.Group();
    scene.add(galaxyGroup);

    // Create a deep field of distant galaxies
    for (let i = 0; i < 25; i++) { // Added a few more for a denser field
        createDistantGalaxy();
    }


    // Post-processing for Glow Effect
    const renderScene = new THREE.RenderPass(scene, camera);
    const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0;
    bloomPass.strength = 1.5; // Increased intensity of the glow
    bloomPass.radius = 0.5;

    composer = new THREE.EffectComposer(renderer);
    composer.setSize(window.innerWidth, window.innerHeight);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);


    // Event Listeners
    document.addEventListener('mousemove', onDocumentMouseMove, false);
    document.addEventListener('touchmove', onTouchMove, false);
    window.addEventListener('deviceorientation', onDeviceOrientation, false);
    document.addEventListener('mousemove', onCursorMove);
    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

function onDocumentMouseMove(event) {
    targetX = (event.clientX - windowHalfX) * 0.02;
    targetY = (event.clientY - windowHalfY) * 0.02;
}

function onTouchMove(event) {
    if (event.touches.length === 1) {
        // Prevent scrolling on touch devices while interacting with the background
        event.preventDefault();
        targetX = (event.touches[0].clientX - windowHalfX) * 0.02;
        targetY = (event.touches[0].clientY - windowHalfY) * 0.02;
    }
}

function onCursorMove(event) {
    const cursor = document.querySelector('.custom-cursor');
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
}

function onDeviceOrientation(event) {
    // Check if the device provides orientation data
    if (event.beta !== null && event.gamma !== null) {
        // Gamma is the left-to-right tilt in degrees, where right is positive. Range: [-90, 90]
        // We'll map this to our targetX. A divisor adjusts sensitivity.
        targetX = event.gamma * 0.08; // Increased sensitivity

        // Beta is the front-to-back tilt. Range: [-180, 180]
        // We'll subtract a baseline (e.g., 60) to set a comfortable "zero" point.
        targetY = (event.beta - 60) * 0.08; // Increased sensitivity
    }
}

function createDistantGalaxy() {
    const count = Math.random() * 500 + 200; // Reduced to 200-700 particles
    const radius = Math.random() * 0.8 + 0.4; // Significantly smaller radius for a tighter cluster

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    
    // Give each galaxy a slightly different color tint
    const centerColor = new THREE.Color(0xfff8e7); // Bright, slightly yellow core
    const outerColor = new THREE.Color().setHSL(Math.random(), 0.8, 0.5); // Random vibrant color for the edge

    for (let i = 0; i < count; i++) {
        const i3 = i * 3;

        // Create a denser core using a power function
        const r = Math.pow(Math.random(), 2) * radius;
        const angle = Math.random() * Math.PI * 2;

        // Create a flattened, lens-like shape
        positions[i3] = Math.cos(angle) * r;
        positions[i3 + 1] = (Math.random() - 0.5) * r * 0.3; // Much flatter on Y-axis
        positions[i3 + 2] = Math.sin(angle) * r;

        // Color
        const mixedColor = centerColor.clone();
        mixedColor.lerp(outerColor, r / radius);

        colors[i3] = mixedColor.r;
        colors[i3 + 1] = mixedColor.g;
        colors[i3 + 2] = mixedColor.b;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.015, // Make particles smaller to appear more distant
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true
    });

    const galaxy = new THREE.Points(geometry, material);
    // Position them far away and scattered
    const posX = (Math.random() - 0.5) * 250; // Increased spread on X-axis
    const posY = (Math.random() - 0.5) * 150; // Increased spread on Y-axis
    const posZ = (Math.random() - 0.5) * 250 - 180; // Increased spread and pushed further back on Z-axis
    const position = new THREE.Vector3(posX, posY, posZ);
    galaxy.position.copy(position);
    galaxy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0); // Random orientation
    
    // Add custom data for independent animation
    galaxy.userData.rotationSpeed = (Math.random() - 0.5) * 0.005; // A small, random speed and direction

    galaxyGroup.add(galaxy);
}

function createShootingStar() {
    // Use a stretched sphere to create a tail effect
    const geometry = new THREE.SphereGeometry(0.02, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const star = new THREE.Mesh(geometry, material);

    // Stretch the sphere to create a tail
    star.scale.set(30, 1, 1);

    // Start from a random position off-screen
    star.position.x = (Math.random() - 0.5) * 30;
    star.position.y = Math.random() * 10 + 5;
    star.position.z = (Math.random() - 0.5) * 10;

    // Set a velocity
    star.velocity = new THREE.Vector3(-0.1 - Math.random() * 0.1, -0.05 - Math.random() * 0.05, 0);

    // Orient the star to point in the direction of its velocity
    star.lookAt(star.position.clone().add(star.velocity));

    scene.add(star);
    shootingStars.push(star);
    // Remove the star after a while to save memory
    setTimeout(() => {
        scene.remove(star);
        shootingStars = shootingStars.filter(s => s !== star); // Correctly remove the star
    }, 10000); // Remove after 10 seconds
}

function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();

    // Smoothly interpolate mouse/gyro position for a softer effect
    mouseX += (targetX - mouseX) * 0.02;
    mouseY += (targetY - mouseY) * 0.02;

    // Animate the main object based on mouse movement
    sceneObject.rotation.x += 0.002 + (mouseY * 0.05); // Reduced base rotation
    sceneObject.rotation.y += 0.002 + (mouseX * 0.05); // Reduced base rotation

    // Animate Tesseract
    const angle = elapsedTime * 0.5;
    const projectedVertices = [];

    for (const v4 of tesseractVertices4D) {
        const v = v4.clone();

        // 4D rotation on two planes (xw and yz) for a complex rotation
        const xw_angle = angle * 1.1;
        const yz_angle = angle * 1.3;

        // xw rotation
        let x1 = v.x, w1 = v.w;
        v.x = x1 * Math.cos(xw_angle) - w1 * Math.sin(xw_angle);
        v.w = x1 * Math.sin(xw_angle) + w1 * Math.cos(xw_angle);

        // yz rotation
        let y2 = v.y, z2 = v.z;
        v.y = y2 * Math.cos(yz_angle) - z2 * Math.sin(yz_angle);
        v.z = y2 * Math.sin(yz_angle) + z2 * Math.cos(yz_angle);

        // Project 4D to 3D
        const distance = 2;
        let w_proj = 1 / (distance - v.w);

        // Clamp the projection factor to prevent extreme values which can lead to NaN.
        // This happens if a vertex gets too close to the camera's 4D position.
        w_proj = Math.max(-1000, Math.min(1000, w_proj));
        projectedVertices.push(new THREE.Vector3(v.x * w_proj, v.y * w_proj, v.z * w_proj));
    }

    const points = [];
    for (let i = 0; i < tesseractEdges.length; i++) {
        points.push(projectedVertices[tesseractEdges[i]]);
    }
    tesseract.geometry.setFromPoints(points);
    tesseract.position.x = Math.cos(elapsedTime * 0.3) * 3.8;
    tesseract.position.z = Math.sin(elapsedTime * 0.2) * 3.8;
    tesseract.position.y = Math.sin(elapsedTime * 0.5) * 1.0;

    // Animate orbiting torus
    const torusAngle = elapsedTime * 0.4;
    orbitingTorus.position.x = Math.cos(torusAngle) * 4.2;
    orbitingTorus.position.y = Math.sin(torusAngle * 1.5) * 1.8;
    orbitingTorus.position.z = Math.sin(torusAngle * 0.8) * 4.2;
    orbitingTorus.rotation.x += 0.01;
    orbitingTorus.rotation.y += 0.02;

    // Animate particles based on mouse movement for a parallax effect
    particles.rotation.y = -mouseX * 0.1 + elapsedTime * 0.005; // Added slow drift
    particles.rotation.x = -mouseY * 0.1 + elapsedTime * 0.002; // Added slow drift

    // Animate the entire galaxy group to move with the particles
    galaxyGroup.rotation.y = -mouseX * 0.03 + elapsedTime * 0.005; // Added slow drift
    galaxyGroup.rotation.x = -mouseY * 0.03 + elapsedTime * 0.002; // Added slow drift

    // Animate individual galaxies to spin on their own axis for a more "live" feel
    galaxyGroup.children.forEach(galaxy => {
        galaxy.rotation.z += galaxy.userData.rotationSpeed;
    });

    // Bass reaction effect
    if (isBassEffectEnabled && analyser) {
        analyser.getByteFrequencyData(dataArray);

        // Get bass frequencies (e.g., first 4 bins for simplicity)
        const bassFrequencies = dataArray.slice(0, 4);
        const averageBass = bassFrequencies.reduce((sum, value) => sum + value, 0) / bassFrequencies.length;

        // Normalize the value (0-255) to a smaller scale factor
        const scaleFactor = (averageBass / 255) * 0.4; // Max scale increase of 0.4

        // Smoothly transition to the new scale
        const targetScale = 1 + scaleFactor;
        currentBassScale += (targetScale - currentBassScale) * 0.1; // Smoothing factor

        sceneObject.scale.set(currentBassScale, currentBassScale, currentBassScale);
    } else if (sceneObject.scale.x !== 1) { // Only run if scaling is needed
        // Smoothly return to normal size if effect is disabled
        currentBassScale += (1 - currentBassScale) * 0.1;
        sceneObject.scale.set(currentBassScale, currentBassScale, currentBassScale);
    }

    // Animate shooting stars
    shootingStars.forEach(star => {
        star.position.add(star.velocity);
    });

    composer.render(); // Use composer to render with post-processing
}

init3D();
animate();
setInterval(createShootingStar, 30000); // Create a new star every 30 seconds

// --- Dynamic Copyright Year ---
const yearSpan = document.getElementById('copyright-year');
if (yearSpan) yearSpan.textContent = new Date().getFullYear();

// --- Hamburger Menu Logic ---
const hamburger = document.querySelector(".hamburger");
const navMenu = document.querySelector(".nav-menu");

function toggleMenu() {
    hamburger.classList.toggle("active");
    navMenu.classList.toggle("active");
}

function closeMenu() {
    hamburger.classList.remove("active");
    navMenu.classList.remove("active");
}

hamburger.addEventListener("click", toggleMenu);

function changeTrack() {
    // Ensure AudioContext is initialized
    if (!audioContext) {
        initAudioContext(); // Initialize if not already
    }
    // Cycle to the next track
    currentTrackIndex = (currentTrackIndex + 1) % soundtracks.length;
    sessionStorage.setItem('currentTrackIndex', currentTrackIndex);
    audio.src = soundtracks[currentTrackIndex];
    audio.load();
    // If music was playing, play the new track
    if (isPlaying) {
        audio.play();
    }
}

function initAudioContext() {
    if (audioContext) return; // Exit if already initialized

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioSource = audioContext.createMediaElementSource(audio);
    analyser = audioContext.createAnalyser();

    // Connect the nodes: source -> analyser -> destination
    audioSource.connect(analyser);
    analyser.connect(audioContext.destination);

    analyser.fftSize = 128; // Lower size is fine for bass detection and better for performance
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
}

function handleVolumeChange() {
    const newVolume = this.value / 100;
    audio.volume = newVolume;
    localStorage.setItem('audioVolume', newVolume);
}

function toggleAudio() {
    // Ensure AudioContext is initialized on the first interaction with this button
    if (!audioContext) {
        initAudioContext();
    }
    // On mobile, AudioContext must be resumed after a user gesture
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    isPlaying = !isPlaying;
    sessionStorage.setItem('audioPlaying', isPlaying);
    // If it should be playing, play it. Otherwise, pause it.
    if (isPlaying) {
        audio.play();
    } else {
        audio.pause();
    }
    updateSoundIcon();
}

function updateSoundIcon() {
    iconOn.style.display = isPlaying ? 'none' : 'block';
    iconOff.style.display = isPlaying ? 'block' : 'none';
}

soundBtn.addEventListener('click', toggleAudio);
volumeSlider.addEventListener('input', handleVolumeChange);

bassToggleButton.addEventListener('click', () => {
    isBassEffectEnabled = !isBassEffectEnabled;
    bassToggleButton.classList.toggle('active', isBassEffectEnabled);
});

if (nextTrackBtn) {
    nextTrackBtn.addEventListener('click', changeTrack);
}

// --- Modal Logic ---
const modalTriggers = document.querySelectorAll('[data-modal-target]');
const closeButtons = document.querySelectorAll('.close-modal');
const modalOverlays = document.querySelectorAll('.modal-overlay');

modalTriggers.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
        e.preventDefault();
        const modal = document.querySelector(trigger.dataset.modalTarget);
        modal.classList.add('active');
        closeMenu(); // Close hamburger menu when opening a modal
    });
});

modalOverlays.forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) { // Only close if clicking the overlay itself
            overlay.classList.remove('active');
        }
    });
});

closeButtons.forEach(button => {
    button.addEventListener('click', () => {
        button.closest('.modal-overlay').classList.remove('active');
    });
});

// --- Fullscreen Logic for Mobile ---
const fullscreenBtn = document.getElementById('fullscreen-btn');

function toggleFullScreen() {
    const doc = window.document;
    const docEl = doc.documentElement;

    const requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
    const cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

    if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        requestFullScreen.call(docEl);
    } else {
        cancelFullScreen.call(doc);
    }
}

// Only add the event listener if the button exists
if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', toggleFullScreen);
}

// --- Welcome Screen Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const welcomeScreen = document.getElementById('welcome-screen');
    const enterBtn = document.getElementById('enter-btn');
    const siteWrapper = document.getElementById('site-wrapper');

    if (enterBtn) {
        enterBtn.addEventListener('click', () => {
            // Fade out the welcome screen
            welcomeScreen.classList.add('hidden');
            // Fade in the main site content
            siteWrapper.classList.add('loaded');

            // Initialize audio context and play if needed, now that we have a user gesture.
            initAudioContext();
            audio.load();
            if (isPlaying) {
                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.error("Audio autoplay failed:", error);
                        // If autoplay fails (e.g., on some mobile browsers), reset the state
                        // so the user can click the button to start it manually.
                        isPlaying = false;
                        sessionStorage.setItem('audioPlaying', 'false');
                        updateSoundIcon();
                    });
                }
            }

            // Remove the welcome screen from the DOM after the transition for performance
            welcomeScreen.addEventListener('transitionend', () => welcomeScreen.remove());
        });
    }
});
