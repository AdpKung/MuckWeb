import './style.css'
import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'

let camera, scene, renderer, controls;
let dirLight, hemiLight, stars, appleModel;

const objects = [];
let raycaster;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

const inventory = {
    wood: 0,
    rock: 0,
    apple: 0,
    wall: 0,
    floor: 0
};
let isInventoryOpen = false;

let hasPickaxe = false;
let equippedTool = 'hand';
let pickaxeModel = null;
let ghostMesh = null;
let isSwinging = false;
let swingTime = 0;

let playerHP = 100;
let playerHunger = 100;
let playerStamina = 100;
let isSprinting = false;

let isDead = false;
let dayTime = 0;
let dayCount = 1;
const cycleLength = 60; // 60 seconds per day/night cycle
let isNight = false;
let monsters = [];
let nextMonsterSpawn = 0;

function updateInventoryUI() {
    // 1. Update Crafting Recipes Availability
    const craftPick = document.getElementById('btn-craft-pickaxe');
    if (craftPick) {
        if (inventory.wood >= 10 && !hasPickaxe) craftPick.classList.remove('disabled');
        else craftPick.classList.add('disabled');
    }
    
    const craftWall = document.getElementById('btn-craft-wall');
    if (craftWall) {
        if (inventory.wood >= 5) craftWall.classList.remove('disabled');
        else craftWall.classList.add('disabled');
    }
    
    const craftFloor = document.getElementById('btn-craft-floor');
    if (craftFloor) {
        if (inventory.wood >= 5) craftFloor.classList.remove('disabled');
        else craftFloor.classList.add('disabled');
    }

    // 2. Generate Inventory Grid (3x9 = 27 slots)
    const invGrid = document.getElementById('mc-inventory-slots');
    if (invGrid) {
        invGrid.innerHTML = ''; // clear
        let itemsToRender = [];
        if (inventory.wood > 0) itemsToRender.push({ name: 'Wood', count: inventory.wood });
        if (inventory.rock > 0) itemsToRender.push({ name: 'Rock', count: inventory.rock });
        if (inventory.apple > 0) itemsToRender.push({ name: 'Apple', count: inventory.apple });
        if (inventory.wall > 0) itemsToRender.push({ name: 'Wall', count: inventory.wall });
        if (inventory.floor > 0) itemsToRender.push({ name: 'Floor', count: inventory.floor });
        if (hasPickaxe) itemsToRender.push({ name: 'Pick', count: 1 });

        for (let i = 0; i < 27; i++) {
            const item = itemsToRender[i];
            if (item) {
                const countHtml = item.count > 1 ? `<div class="count">${item.count}</div>` : '';
                invGrid.innerHTML += `<div class="mc-slot" title="${item.name}">${item.name}${countHtml}</div>`;
            } else {
                invGrid.innerHTML += `<div class="mc-slot empty"></div>`;
            }
        }
    }

    // 3. Update Hotbar (1-5 slots)
    const updateHotbarSlot = (index, name, count) => {
        const slot = document.querySelector(`.hotbar-slot:nth-child(${index})`);
        if (slot) {
            if (count > 0 || name === 'Hand') {
                const countHtml = count > 1 ? `<div class="count">${count}</div>` : '';
                // Keep the active class if it has it
                const isActive = slot.classList.contains('active') ? ' active' : '';
                slot.className = `hotbar-slot${isActive}`;
                slot.innerHTML = `${name}${countHtml}`;
            } else {
                const isActive = slot.classList.contains('active') ? ' active' : '';
                slot.className = `hotbar-slot${isActive} empty`;
                slot.innerHTML = '';
            }
        }
    };

    updateHotbarSlot(1, 'Hand', 1); // Always have hand
    updateHotbarSlot(2, 'Pick', hasPickaxe ? 1 : 0);
    updateHotbarSlot(3, 'Apple', inventory.apple);
    updateHotbarSlot(4, 'Wall', inventory.wall);
    updateHotbarSlot(5, 'Floor', inventory.floor);
}

let currentSlot = 1;

function equipTool(tool, slotIndex) {
    equippedTool = tool;
    
    // UI update
    for (let i = 1; i <= 5; i++) {
        const slot = document.querySelector(`.hotbar-slot:nth-child(${i})`);
        if (slot) slot.classList.remove('active');
    }
    
    let activeSlot = slotIndex;
    if (!activeSlot) {
        if (tool === 'hand') activeSlot = 1;
        else if (tool === 'pickaxe') activeSlot = 2;
        else if (tool === 'apple') activeSlot = 3;
        else if (tool === 'wall') activeSlot = 4;
        else if (tool === 'floor') activeSlot = 5;
        else activeSlot = 1;
    }
    currentSlot = activeSlot;
    
    const slotElement = document.querySelector(`.hotbar-slot:nth-child(${activeSlot})`);
    if (slotElement) slotElement.classList.add('active');
    
    if (pickaxeModel) pickaxeModel.visible = false;
    if (appleModel) appleModel.visible = false;
    if (ghostMesh) ghostMesh.visible = false;

    if (tool === 'pickaxe') {
        if (pickaxeModel) pickaxeModel.visible = true;
    } else if (tool === 'apple') {
        if (appleModel) appleModel.visible = true;
    } else if (tool === 'wall') {
        if (ghostMesh) {
            ghostMesh.geometry = new THREE.BoxGeometry(4, 4, 0.5);
            ghostMesh.visible = true;
        }
    } else if (tool === 'floor') {
        if (ghostMesh) {
            ghostMesh.geometry = new THREE.BoxGeometry(4, 0.5, 4);
            ghostMesh.visible = true;
        }
    }
}

function selectSlot(index) {
    if (index < 1) index = 5;
    if (index > 5) index = 1;
    currentSlot = index;
    
    if (currentSlot === 1) {
        equipTool('hand', 1);
    } else if (currentSlot === 2) {
        if (hasPickaxe) equipTool('pickaxe', 2);
        else equipTool('empty', 2);
    } else if (currentSlot === 3) {
        if (inventory.apple > 0) equipTool('apple', 3);
        else equipTool('empty', 3);
    } else if (currentSlot === 4) {
        if (inventory.wall > 0) equipTool('wall', 4);
        else equipTool('empty', 4);
    } else if (currentSlot === 5) {
        if (inventory.floor > 0) equipTool('floor', 5);
        else equipTool('empty', 5);
    }
}

let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

init();
animate();

function init() {
    // Setup Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky color
    scene.fog = new THREE.Fog(0x87CEEB, 0, 150);

    // Setup Light
    hemiLight = new THREE.HemisphereLight(0xeeeeff, 0x444455, 0.75);
    hemiLight.position.set(0.5, 1, 0.75);
    scene.add(hemiLight);

    dirLight = new THREE.DirectionalLight(0xffeedd, 0.8);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 200;
    dirLight.shadow.camera.left = -50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = -50;
    dirLight.shadow.bias = -0.0001;
    scene.add(dirLight);

    // Setup Stars
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1000;
    const starArray = new Float32Array(starCount * 3);
    for(let i=0; i < starCount * 3; i++) {
        starArray[i] = (Math.random() - 0.5) * 500;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starArray, 3));
    const starMat = new THREE.PointsMaterial({color: 0xffffff, size: 0.5, transparent: true, opacity: 0});
    stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Setup Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = 2; // Player height

    // Create Pickaxe View Model
    pickaxeModel = new THREE.Group();
    
    const handleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5);
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = -0.1;
    
    const headGeo = new THREE.BoxGeometry(0.4, 0.05, 0.05);
    const headMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.15;
    
    pickaxeModel.add(handle);
    pickaxeModel.add(head);
    
    // Position it in bottom right of screen
    pickaxeModel.position.set(0.3, -0.2, -0.4);
    pickaxeModel.rotation.x = 0.5;
    pickaxeModel.rotation.y = Math.PI / 4;
    pickaxeModel.visible = false; // Hidden until crafted
    camera.add(pickaxeModel);

    // Create Apple View Model
    appleModel = new THREE.Group();
    const appleGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const appleMat = new THREE.MeshLambertMaterial({ color: 0xff1111 });
    const appleBody = new THREE.Mesh(appleGeo, appleMat);
    
    const stemGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.04);
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
    const appleStem = new THREE.Mesh(stemGeo, stemMat);
    appleStem.position.y = 0.08;
    
    appleModel.add(appleBody);
    appleModel.add(appleStem);
    
    appleModel.position.set(0.3, -0.2, -0.4);
    appleModel.visible = false;
    camera.add(appleModel);

    // Create Ghost Mesh for building preview
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5, wireframe: true });
    ghostMesh = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 0.5), ghostMat);
    ghostMesh.visible = false;
    scene.add(ghostMesh);

    scene.add(camera); // Must add camera to scene to render its children

    // Setup Controls
    controls = new PointerLockControls(camera, document.body);

    const blocker = document.getElementById('blocker');
    const instructions = document.getElementById('instructions');

    instructions.addEventListener('click', function () {
        if (!isDead) {
            controls.lock();
        }
    });

    controls.addEventListener('lock', function () {
        instructions.style.display = 'none';
        blocker.style.display = 'none';
    });

    controls.addEventListener('unlock', function () {
        if (!isInventoryOpen) {
            blocker.style.display = 'flex';
            instructions.style.display = '';
        }
    });

    scene.add(controls.object);

    // Movement Input
    const onKeyDown = function (event) {
        if (event.code === 'KeyE' || event.code === 'Tab') {
            event.preventDefault(); // Prevent tab from changing focus
            isInventoryOpen = !isInventoryOpen;
            const invUI = document.getElementById('inventory-ui');
            if (isInventoryOpen) {
                controls.unlock();
                invUI.style.display = 'flex';
                updateInventoryUI();
            } else {
                invUI.style.display = 'none';
                try {
                    // Try to lock, catch if browser blocks it (rate limit)
                    const promise = document.body.requestPointerLock();
                    if (promise) {
                        promise.catch(err => {
                            console.warn("Pointer lock blocked by browser:", err);
                            const blocker = document.getElementById('blocker');
                            const instructions = document.getElementById('instructions');
                            if (blocker && instructions) {
                                blocker.style.display = 'flex';
                                instructions.style.display = '';
                            }
                        });
                    }
                } catch(e) {
                    // Ignore fallback
                }
            }
            return;
        }

        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = true;
                break;
            case 'Space':
                if (canJump === true && playerStamina >= 10) {
                    velocity.y += 15;
                    playerStamina -= 10;
                }
                canJump = false;
                break;
            case 'ShiftLeft':
                isSprinting = true;
                break;
            case 'Digit1':
                selectSlot(1);
                break;
            case 'Digit2':
                selectSlot(2);
                break;
            case 'Digit3':
                selectSlot(3);
                break;
            case 'Digit4':
                selectSlot(4);
                break;
            case 'Digit5':
                selectSlot(5);
                break;
        }
    };

    const onKeyUp = function (event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = false;
                break;
            case 'ShiftLeft':
                isSprinting = false;
                break;
        }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    
    document.addEventListener('wheel', (e) => {
        if (!controls.isLocked) return;
        if (e.deltaY > 0) {
            selectSlot(currentSlot + 1); // scroll down
        } else {
            selectSlot(currentSlot - 1); // scroll up
        }
    });

    raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 2.5);

    // Setup World Floor
    const floorGeometry = new THREE.PlaneGeometry(500, 500, 50, 50);
    floorGeometry.rotateX(-Math.PI / 2);

    // Displace vertices to make simple terrain
    const positionAttribute = floorGeometry.attributes.position;
    for (let i = 0; i < positionAttribute.count; i++) {
        const x = positionAttribute.getX(i);
        const z = positionAttribute.getZ(i);
        // Simple procedural hills
        const y = Math.sin(x / 20) * Math.cos(z / 20) * 5;
        positionAttribute.setY(i, y);
    }
    floorGeometry.computeVertexNormals();

    const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x55aa55 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.receiveShadow = true;
    scene.add(floor);
    objects.push(floor);

    // Generate trees/rocks
    const trunkGeometry = new THREE.CylinderGeometry(0.6, 0.9, 5, 7);
    const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x6e3d22 });
    // Use Dodecahedron for low-poly leafy top instead of a box
    const leafGeometry = new THREE.DodecahedronGeometry(3.5);
    const leafMaterial = new THREE.MeshLambertMaterial({ color: 0x2e8c33 });

    for (let i = 0; i < 50; i++) {
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.x = Math.random() * 200 - 100;
        trunk.position.z = Math.random() * 200 - 100;
        // Basic height placement based on flat world (will clip through bumpy terrain a bit)
        const groundHeight = Math.sin(trunk.position.x / 20) * Math.cos(trunk.position.z / 20) * 5;
        trunk.position.y = groundHeight + 2.5; 
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        trunk.userData = { type: 'wood' };
        scene.add(trunk);
        objects.push(trunk);
        
        // Leaves (Bottom layer)
        const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
        leaf.position.copy(trunk.position);
        leaf.position.y += 3.0;
        // Randomize leaf rotation
        leaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        leaf.castShadow = true;
        leaf.userData = { type: 'wood' };
        scene.add(leaf);
        objects.push(leaf); // For basic raycast collision

        // Leaves (Top layer)
        const leafTop = new THREE.Mesh(leafGeometry, leafMaterial);
        leafTop.position.copy(trunk.position);
        leafTop.position.y += 5.5;
        leafTop.scale.set(0.7, 0.7, 0.7);
        leafTop.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        leafTop.castShadow = true;
        leafTop.userData = { type: 'wood' };
        scene.add(leafTop);
        objects.push(leafTop);
    }

    const rockGeometry = new THREE.DodecahedronGeometry(2);
    const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
    for (let i = 0; i < 30; i++) {
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.position.x = Math.random() * 200 - 100;
        rock.position.z = Math.random() * 200 - 100;
        const groundHeight = Math.sin(rock.position.x / 20) * Math.cos(rock.position.z / 20) * 5;
        rock.position.y = groundHeight + 1;
        rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        rock.castShadow = true;
        rock.receiveShadow = true;
        rock.userData = { type: 'rock' };
        scene.add(rock);
        objects.push(rock);
    }

    // Renderer Setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    window.addEventListener('resize', onWindowResize);

    // Interaction - Mining
    document.addEventListener('mousedown', (e) => {
        if (!controls.isLocked) return;
        if (e.button === 0) { // Left click
            if (equippedTool === 'pickaxe') {
                isSwinging = true;
                swingTime = 0;
            } else if (equippedTool === 'apple') {
                if (inventory.apple > 0) {
                    isSwinging = true;
                    swingTime = 0;
                    inventory.apple--;
                    playerHunger = Math.min(100, playerHunger + 20);
                    if (inventory.apple === 0) {
                        setTimeout(() => {
                            selectSlot(currentSlot); // Auto unequip if no apples left
                        }, 500); // Wait for swing animation to finish roughly
                    }
                    updateInventoryUI();
                    return; // Don't mine when eating
                }
            } else if (equippedTool === 'wall' || equippedTool === 'floor') {
                if (ghostMesh && ghostMesh.material.color.getHex() === 0x00ff00 && inventory[equippedTool] > 0) {
                    inventory[equippedTool]--;
                    
                    const buildGeo = ghostMesh.geometry.clone();
                    const buildMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
                    const buildMesh = new THREE.Mesh(buildGeo, buildMat);
                    buildMesh.position.copy(ghostMesh.position);
                    buildMesh.rotation.copy(ghostMesh.rotation);
                    buildMesh.castShadow = true;
                    buildMesh.receiveShadow = true;
                    buildMesh.userData = { type: equippedTool, hp: 50 };
                    
                    scene.add(buildMesh);
                    objects.push(buildMesh);
                    
                    if (inventory[equippedTool] === 0) {
                        selectSlot(currentSlot);
                    }
                    updateInventoryUI();
                    return; // Don't mine when building
                }
            }

            // Mining logic (raycast forward)
            const interactRay = new THREE.Raycaster();
            interactRay.setFromCamera(new THREE.Vector2(0, 0), camera); // Center of screen
            
            const intersects = interactRay.intersectObjects(objects, false);
            
            if (intersects.length > 0 && intersects[0].distance < 10) { // Mining range
                const obj = intersects[0].object;
                if (obj !== floor) { // Can't mine floor in this prototype easily
                    // Simulate mining visually (shrink)
                    let damage = 0.15;
                    if (equippedTool === 'pickaxe') {
                        damage = obj.userData.type === 'rock' ? 0.6 : 0.3; // Pickaxe is great for rocks
                    }

                    if (obj.userData.type === 'monster') {
                        obj.userData.hp -= damage * 5; // Tools deal more damage to monsters for simplicity
                        // Visual feedback for hit
                        obj.material.color.setHex(0xffffff);
                        setTimeout(() => { if (obj.parent) obj.material.color.setHex(0xff0000); }, 100);
                        
                        // Pushback
                        const dx = obj.position.x - camera.position.x;
                        const dz = obj.position.z - camera.position.z;
                        const dist = Math.sqrt(dx*dx + dz*dz);
                        obj.position.x += (dx / dist) * 1;
                        obj.position.z += (dz / dist) * 1;
                    } else {
                        obj.scale.y -= damage;
                        obj.scale.x -= damage / 2;
                        obj.scale.z -= damage / 2;
                        obj.position.y -= damage; // Keep grounded roughly
                    }
                    
                    if (obj.userData.type !== 'monster' && obj.scale.y <= 0.1) {
                        scene.remove(obj);
                        const index = objects.indexOf(obj);
                        if (index > -1) objects.splice(index, 1);
                        
                        if (obj.userData.type === 'wood') {
                            inventory.wood += 1;
                            if (Math.random() < 0.3) {
                                inventory.apple += 1;
                            }
                        } else if (obj.userData.type === 'rock') {
                            inventory.rock += 1;
                        }
                        updateInventoryUI();
                        console.log("Mined resource! Wood:", inventory.wood, "Rock:", inventory.rock);
                    }
                }
            }
        }
    });

    document.getElementById('btn-craft-pickaxe').addEventListener('click', (e) => {
        if (inventory.wood >= 10 && !hasPickaxe) {
            inventory.wood -= 10;
            hasPickaxe = true;
            selectSlot(2);
            // Hide the craft pickaxe slot since you only need one
            document.getElementById('btn-craft-pickaxe').style.display = 'none';
            updateInventoryUI();
        }
    });

    document.getElementById('btn-craft-wall').addEventListener('click', () => {
        if (inventory.wood >= 5) {
            inventory.wood -= 5;
            inventory.wall++;
            updateInventoryUI();
        }
    });

    document.getElementById('btn-craft-floor').addEventListener('click', () => {
        if (inventory.wood >= 5) {
            inventory.wood -= 5;
            inventory.floor++;
            updateInventoryUI();
        }
    });
}
function updateMonsters(delta) {
    // Spawning logic
    if (isNight && performance.now() > nextMonsterSpawn && monsters.length < 15) { // max 15 monsters
        nextMonsterSpawn = performance.now() + Math.random() * 2000 + 1000; // Spawn every 1-3 seconds
        
        const mobGeo = new THREE.BoxGeometry(2, 2, 2);
        const mobMat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        const mob = new THREE.Mesh(mobGeo, mobMat);
        
        // Spawn around player
        const angle = Math.random() * Math.PI * 2;
        const distance = 40 + Math.random() * 20; // 40-60 units away
        mob.position.x = camera.position.x + Math.cos(angle) * distance;
        mob.position.z = camera.position.z + Math.sin(angle) * distance;
        mob.position.y = 1;
        mob.castShadow = true;
        mob.receiveShadow = true;
        
        mob.userData = { type: 'monster', hp: 3, nextAttack: 0 };
        scene.add(mob);
        objects.push(mob);
        monsters.push(mob);
    }

    // Monster AI logic
    for (let i = monsters.length - 1; i >= 0; i--) {
        const mob = monsters[i];
        
        // Check dead
        if (mob.userData.hp <= 0) {
            scene.remove(mob);
            objects.splice(objects.indexOf(mob), 1);
            monsters.splice(i, 1);
            continue;
        }
        
        // Move towards player
        const dx = camera.position.x - mob.position.x;
        const dz = camera.position.z - mob.position.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        const dirX = dx / dist;
        const dirZ = dz / dist;
        
        // Raycast to check for walls in the way
        const mobRay = new THREE.Raycaster(mob.position, new THREE.Vector3(dirX, 0, dirZ).normalize());
        const intersects = mobRay.intersectObjects(objects, false);
        
        let hitWall = false;
        if (intersects.length > 0 && intersects[0].distance < 2.5) {
            const hitObj = intersects[0].object;
            if (hitObj.userData && hitObj.userData.type === 'wall') {
                hitWall = true;
                // Attack the wall
                if (performance.now() > mob.userData.nextAttack) {
                    mob.userData.nextAttack = performance.now() + 1500;
                    hitObj.userData.hp -= 10;
                    
                    // Visual feedback
                    hitObj.material.color.setHex(0xffaaaa);
                    setTimeout(() => { if (hitObj.parent) hitObj.material.color.setHex(0x8B4513); }, 100);
                    
                    if (hitObj.userData.hp <= 0) {
                        scene.remove(hitObj);
                        objects.splice(objects.indexOf(hitObj), 1);
                    }
                }
            }
        }
        
        if (!hitWall) {
            if (dist > 2.5) { // stop at 2.5 units from player
                const moveSpeed = 10 * delta;
                mob.position.x += dirX * moveSpeed;
                mob.position.z += dirZ * moveSpeed;
            } else {
                // Attack player
                if (performance.now() > mob.userData.nextAttack) {
                    mob.userData.nextAttack = performance.now() + 1500; // Attack every 1.5s
                    takeDamage(10); // Deal 10 damage
                }
            }
        }
        
        // Simple terrain height follow
        const groundHeight = Math.sin(mob.position.x / 20) * Math.cos(mob.position.z / 20) * 5;
        mob.position.y = groundHeight + 1;
    }
}

function takeDamage(amount) {
    if (isDead) return;
    
    playerHP -= amount;
    const hpBar = document.getElementById('hp-bar');
    hpBar.style.width = Math.max(0, playerHP) + '%';
    
    // Flash screen red
    const originalBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = 'red';
    setTimeout(() => { document.body.style.backgroundColor = originalBg; }, 100);
    
    if (playerHP <= 0) {
        die();
    }
}

function die() {
    isDead = true;
    controls.unlock();
    document.getElementById('game-over-text').style.display = 'block';
    document.getElementById('click-to-play-text').style.display = 'none';
}
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const globalDelta = Math.min((time - prevTime) / 1000, 0.1);

    if (!isDead) {
        dayTime += globalDelta;
        if (dayTime > cycleLength) {
            dayTime = 0;
            dayCount++;
            document.getElementById('day-ui').innerText = 'Day ' + dayCount;
        }

        // 0 to 0.5 is day, 0.5 to 1.0 is night
        const cycleProgress = dayTime / cycleLength;
        isNight = cycleProgress > 0.5;

        // Interpolate sky color and lighting
        let skyColor = new THREE.Color(0x87CEEB); // Day
        let lightIntensity = 0.8;
        let starOpacity = 0;
        
        if (isNight) {
            skyColor = new THREE.Color(0x050520); // Night
            lightIntensity = 0.1;
            starOpacity = 1;
        } else {
            const transitionNight = Math.max(0, Math.min(1, (cycleProgress - 0.4) * 10)); // fade to night at 0.4-0.5
            skyColor.lerp(new THREE.Color(0x050520), transitionNight);
            
            const transitionDay = Math.max(0, Math.min(1, (cycleProgress - 0.9) * 10)); // fade to day at 0.9-1.0
            skyColor.lerp(new THREE.Color(0x87CEEB), transitionDay);
            
            if (cycleProgress > 0.4 && cycleProgress < 0.5) {
                lightIntensity = 0.8 - (transitionNight * 0.7);
                starOpacity = transitionNight;
            } else if (cycleProgress > 0.9 && cycleProgress < 1.0) {
                lightIntensity = 0.1 + (transitionDay * 0.7);
                starOpacity = 1 - transitionDay;
            }
        }
        
        scene.background = skyColor;
        scene.fog.color = skyColor;
        if (dirLight) dirLight.intensity = lightIntensity;
        if (stars) stars.material.opacity = starOpacity;

        // Monster Logic
        updateMonsters(globalDelta);

        // Hunger Logic
        playerHunger = Math.max(0, playerHunger - globalDelta * 1.5); // drain 1.5 per second
        document.getElementById('hunger-bar').style.width = playerHunger + '%';
        if (playerHunger <= 0) {
            takeDamage(globalDelta * 5); // starve 5 HP per sec
        }
    }

    if (controls.isLocked === true) {
        raycaster.ray.origin.copy(camera.position);
        // Cast a ray down from player's feet
        raycaster.ray.origin.y -= 2; 

        // Very basic terrain follow/collision
        const intersections = raycaster.intersectObjects(objects, false);
        const onObject = intersections.length > 0;

        const delta = Math.min((time - prevTime) / 1000, 0.1); // clamp delta to max 100ms

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 35.0 * delta; // 100.0 = mass

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); // this ensures consistent movements in all directions

        let speed = 40.0;
        const isMoving = moveForward || moveBackward || moveLeft || moveRight;

        if (isSprinting && isMoving && playerStamina > 0) {
            speed = 70.0;
            playerStamina = Math.max(0, playerStamina - delta * 20); // drain 20 per sec
        } else {
            playerStamina = Math.min(100, playerStamina + delta * 15); // regen 15 per sec
        }
        document.getElementById('stamina-bar').style.width = playerStamina + '%';

        if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;

        if (onObject === true) {
            velocity.y = Math.max(0, velocity.y);
            canJump = true;
            // Snapping to terrain roughly
            if (intersections[0].distance < 0.5) {
               camera.position.y += (0.5 - intersections[0].distance);
            }
        }

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        camera.position.y += (velocity.y * delta);

        if (camera.position.y < 2) { // Minimum height safety net
            velocity.y = 0;
            camera.position.y = 2;
            canJump = true;
        }

        // Ghost Mesh Building preview
        if (ghostMesh && ghostMesh.visible) {
            const buildRay = new THREE.Raycaster();
            buildRay.setFromCamera(new THREE.Vector2(0, 0), camera);
            
            // To prevent snapping to walls/floors we're looking through, we could filter objects
            const intersects = buildRay.intersectObjects(objects, false);
            
            if (intersects.length > 0 && intersects[0].distance < 15) { // Placement range
                const hit = intersects[0];
                
                // Snap to grid (rough)
                const gridSize = 4;
                const hitPoint = hit.point;
                // Offset slightly based on normal to build attached to surfaces
                const pos = hitPoint.clone().add(hit.face.normal.clone().multiplyScalar(2));
                
                ghostMesh.position.x = Math.round(pos.x / gridSize) * gridSize;
                
                // Floor snaps differently than Wall
                if (equippedTool === 'floor') {
                    ghostMesh.position.y = hitPoint.y + 0.25; // Floor height offset
                    ghostMesh.position.z = Math.round(pos.z / gridSize) * gridSize;
                    ghostMesh.rotation.set(0, 0, 0);
                } else if (equippedTool === 'wall') {
                    // Try to snap wall vertically
                    ghostMesh.position.y = Math.max(2, Math.round(pos.y / gridSize) * gridSize);
                    ghostMesh.position.z = Math.round(pos.z / gridSize) * gridSize;
                    
                    // Simple rotation based on looking angle
                    const dir = new THREE.Vector3(0, 0, -1);
                    dir.applyQuaternion(camera.quaternion);
                    if (Math.abs(dir.x) > Math.abs(dir.z)) {
                        ghostMesh.rotation.y = Math.PI / 2; // face X axis
                    } else {
                        ghostMesh.rotation.y = 0; // face Z axis
                    }
                }
                ghostMesh.material.color.setHex(0x00ff00);
            } else {
                ghostMesh.material.color.setHex(0xff0000); // Too far
                // Keep it in front of player but red
                buildRay.ray.at(10, ghostMesh.position);
            }
        }
    }

    prevTime = time;

    let activeModel = null;
    if (equippedTool === 'pickaxe' && pickaxeModel) activeModel = pickaxeModel;
    else if (equippedTool === 'apple' && appleModel) activeModel = appleModel;

    if (activeModel) {
        if (isSwinging) {
            swingTime += 0.15; // Animation speed
            // Simple swing math
            activeModel.rotation.x = 0.5 - Math.sin(swingTime) * 1.5;
            if (swingTime > Math.PI) {
                isSwinging = false;
                swingTime = 0;
                activeModel.rotation.x = 0.5; // Reset to idle
            }
        }
        
        // Idle bobbing when walking
        if (!isSwinging && controls.isLocked) {
            const speedMagnitude = Math.abs(velocity.x) + Math.abs(velocity.z);
            if (speedMagnitude > 2) {
                activeModel.position.y = -0.2 + Math.sin(time / 100) * 0.05;
                activeModel.position.x = 0.3 + Math.cos(time / 100) * 0.02;
            } else {
                activeModel.position.y = -0.2;
                activeModel.position.x = 0.3;
            }
        }
    }

    renderer.render(scene, camera);
}
