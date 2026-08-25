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

let inventorySlots = Array(27).fill(null);

function addItem(type, count = 1) {
    // 1. Try to stack in existing slot
    for (let i = 0; i < inventorySlots.length; i++) {
        if (inventorySlots[i] && inventorySlots[i].type === type) {
            inventorySlots[i].count += count;
            updateInventoryUI();
            return true;
        }
    }
    // 2. Find empty slot
    for (let i = 0; i < inventorySlots.length; i++) {
        if (!inventorySlots[i]) {
            inventorySlots[i] = { type, count };
            updateInventoryUI();
            return true;
        }
    }
    console.log("Inventory full!");
    return false;
}

function countItem(type) {
    let total = 0;
    for (const slot of inventorySlots) {
        if (slot && slot.type === type) {
            total += slot.count;
        }
    }
    return total;
}

function consumeItem(type, count = 1) {
    let remainingToConsume = count;
    for (let i = 0; i < inventorySlots.length; i++) {
        const slot = inventorySlots[i];
        if (slot && slot.type === type) {
            if (slot.count >= remainingToConsume) {
                slot.count -= remainingToConsume;
                remainingToConsume = 0;
                if (slot.count === 0) inventorySlots[i] = null;
                break; // Done
            } else {
                remainingToConsume -= slot.count;
                inventorySlots[i] = null;
            }
        }
    }
    updateInventoryUI();
    return remainingToConsume === 0;
}
let isInventoryOpen = false;

let hasPickaxe = false;
let hasSword = false;
let hasAxe = false;
let equippedTool = 'rock'; // Start with rock
let pickaxeModel = null;
let swordModel = null;
let axeModel = null;
let rockModel = null;
let appleModel = null;
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
const cycleLength = 1440; // 24 minutes per day/night cycle
let isNight = false;
let monsters = [];
let droppedItems = [];
let nextMonsterSpawn = 0;

let playerCoins = 0;
let playerMaxHP = 100;
let powerups = { sneakers: 0, dumbbell: 0, dagger: 0 };

let bossSpawnedDay4 = false;
let currentBoss = null;

function getTerrainHeight(x, z) {
    return (Math.sin(x / 30) * Math.cos(z / 30) * 10) + (Math.sin(x / 10) * Math.cos(z / 10) * 2);
}

function addPowerup(type) {
    if (powerups[type] !== undefined) {
        powerups[type]++;
        if (type === 'dumbbell') {
            playerMaxHP += 10;
            playerHP += 10;
            document.getElementById('hp-bar').style.width = (playerHP / playerMaxHP * 100) + '%';
        }
        updatePowerupUI();
    }
}

function updatePowerupUI() {
    const container = document.getElementById('powerup-ui');
    if (!container) return;
    let html = '';
    if (powerups.sneakers > 0) html += `<div>👟 Sneakers x${powerups.sneakers}</div>`;
    if (powerups.dumbbell > 0) html += `<div>🏋️ Dumbbell x${powerups.dumbbell}</div>`;
    if (powerups.dagger > 0) html += `<div>🗡️ Crimson Dagger x${powerups.dagger}</div>`;
    container.innerHTML = html;
}

function updateInventoryUI() {
    // 1. Update Crafting Recipes Availability
    const woodCount = countItem('wood');
    const rockCount = countItem('rock');

    const craftPick = document.getElementById('btn-craft-pickaxe');
    if (craftPick) {
        if (woodCount >= 10 && rockCount >= 10 && !hasPickaxe) craftPick.classList.remove('disabled');
        else craftPick.classList.add('disabled');
    }
    
    const craftWorkbench = document.getElementById('btn-craft-workbench');
    if (craftWorkbench) {
        if (woodCount >= 10) craftWorkbench.classList.remove('disabled');
        else craftWorkbench.classList.add('disabled');
    }
    
    const craftWall = document.getElementById('btn-craft-wall');
    if (craftWall) {
        if (woodCount >= 5) craftWall.classList.remove('disabled');
        else craftWall.classList.add('disabled');
    }
    
    const craftFloor = document.getElementById('btn-craft-floor');
    if (craftFloor) {
        if (woodCount >= 5) craftFloor.classList.remove('disabled');
        else craftFloor.classList.add('disabled');
    }

    const craftSword = document.getElementById('btn-craft-sword');
    if (craftSword) {
        if (woodCount >= 5 && rockCount >= 5 && !hasSword) craftSword.classList.remove('disabled');
        else craftSword.classList.add('disabled');
    }

    const craftCampfire = document.getElementById('btn-craft-campfire');
    if (craftCampfire) {
        if (woodCount >= 10 && rockCount >= 5) craftCampfire.classList.remove('disabled');
        else craftCampfire.classList.add('disabled');
    }

    // 2. Generate Inventory Grid (3x9 = 27 slots)
    const invGrid = document.getElementById('mc-inventory-slots');
    if (invGrid) {
        invGrid.innerHTML = ''; // clear
        for (let i = 0; i < 27; i++) {
            const slot = inventorySlots[i];
            if (slot) {
                const countHtml = slot.count > 1 ? `<div class="count">${slot.count}</div>` : '';
                // Add dragging attributes
                invGrid.innerHTML += `<div class="mc-slot" title="${slot.type}" draggable="true" ondragstart="dragStart(event, ${i})" ondragover="dragOver(event)" ondrop="drop(event, ${i})">${slot.type}${countHtml}</div>`;
            } else {
                invGrid.innerHTML += `<div class="mc-slot empty" ondragover="dragOver(event)" ondrop="drop(event, ${i})"></div>`;
            }
        }
    }

    // 3. Update Hotbar (1-5 slots)
    for (let i = 0; i < 7; i++) {
        const slot = inventorySlots[i];
        const uiIndex = i + 1;
        const domSlot = document.querySelector(`.hotbar-slot:nth-child(${uiIndex})`);
        if (domSlot) {
            const isActive = domSlot.classList.contains('active') ? ' active' : '';
            if (slot) {
                const countHtml = slot.count > 1 ? `<div class="count">${slot.count}</div>` : '';
                domSlot.className = `hotbar-slot${isActive}`;
                domSlot.innerHTML = `${slot.type}${countHtml}`;
            } else {
                domSlot.className = `hotbar-slot${isActive} empty`;
                domSlot.innerHTML = '';
            }
        }
    }
}

window.dragStart = function(event, index) {
    event.dataTransfer.setData("text/plain", index);
};

window.dragOver = function(event) {
    event.preventDefault(); // allow drop
};

window.drop = function(event, dropIndex) {
    event.preventDefault();
    const dragIndex = parseInt(event.dataTransfer.getData("text/plain"));
    if (dragIndex === dropIndex) return;

    // Swap items in inventory array
    const temp = inventorySlots[dragIndex];
    inventorySlots[dragIndex] = inventorySlots[dropIndex];
    inventorySlots[dropIndex] = temp;

    // Refresh UI
    updateInventoryUI();
    
    // Refresh model if active slot changed
    if (dragIndex === currentSlot - 1 || dropIndex === currentSlot - 1) {
        selectSlot(currentSlot);
    }
};

let currentSlot = 1;

function equipTool(tool, slotIndex) {
    equippedTool = tool;
    
    // UI update
    for (let i = 1; i <= 7; i++) {
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
    if (swordModel) swordModel.visible = false;
    if (axeModel) axeModel.visible = false;
    if (rockModel) rockModel.visible = false;
    if (appleModel) appleModel.visible = false;
    if (ghostMesh) ghostMesh.visible = false;

    if (tool === 'pickaxe') {
        if (pickaxeModel) pickaxeModel.visible = true;
    } else if (tool === 'axe') {
        if (axeModel) axeModel.visible = true;
    } else if (tool === 'rock') {
        if (rockModel) rockModel.visible = true;
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
    } else if (tool === 'sword') {
        if (swordModel) swordModel.visible = true;
    } else if (tool === 'campfire') {
        if (ghostMesh) {
            ghostMesh.geometry = new THREE.CylinderGeometry(1, 1, 0.5, 8);
            ghostMesh.visible = true;
        }
    } else if (tool === 'workbench') {
        if (ghostMesh) {
            ghostMesh.geometry = new THREE.BoxGeometry(2, 1.5, 2);
            ghostMesh.visible = true;
        }
    }
}

function selectSlot(index) {
    if (index < 1) index = 7;
    if (index > 7) index = 1;
    currentSlot = index;
    
    const slotData = inventorySlots[index - 1];
    if (slotData) {
        equipTool(slotData.type, index);
    } else {
        equipTool('hand', index);
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

    // Create Sword View Model
    swordModel = new THREE.Group();
    const swordHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2), new THREE.MeshLambertMaterial({ color: 0x8B4513 }));
    swordHandle.position.y = -0.2;
    const swordBlade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.02), new THREE.MeshLambertMaterial({ color: 0xaaaaaa }));
    swordBlade.position.y = 0.2;
    const swordGuard = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.05), new THREE.MeshLambertMaterial({ color: 0x555555 }));
    swordGuard.position.y = -0.1;
    swordModel.add(swordHandle);
    swordModel.add(swordBlade);
    swordModel.add(swordGuard);
    swordModel.position.set(0.3, -0.2, -0.4);
    swordModel.rotation.x = 0.5;
    swordModel.rotation.y = Math.PI / 4;
    swordModel.visible = false;
    camera.add(swordModel);

    // Create Axe View Model
    axeModel = new THREE.Group();
    const axeHandleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5);
    const axeHandleMat = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
    const axeHandle = new THREE.Mesh(axeHandleGeo, axeHandleMat);
    const axeHeadGeo = new THREE.BoxGeometry(0.2, 0.15, 0.05);
    const axeHeadMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const axeHead = new THREE.Mesh(axeHeadGeo, axeHeadMat);
    axeHead.position.set(0.1, 0.2, 0);
    axeModel.add(axeHandle);
    axeModel.add(axeHead);
    axeModel.position.set(0.3, -0.2, -0.4);
    axeModel.rotation.x = 0.5;
    axeModel.rotation.y = -Math.PI / 4;
    axeModel.visible = false;
    camera.add(axeModel);

    // Create Rock View Model (Starting tool)
    rockModel = new THREE.Group();
    const rockHandGeo = new THREE.DodecahedronGeometry(0.1);
    const rockHandMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const rockHand = new THREE.Mesh(rockHandGeo, rockHandMat);
    rockModel.add(rockHand);
    rockModel.position.set(0.3, -0.2, -0.4);
    rockModel.visible = false;
    camera.add(rockModel);

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
            const benchUI = document.getElementById('workbench-ui');
            
            if (isInventoryOpen) {
                controls.unlock();
                invUI.style.display = 'flex'; // Tab opens normal inventory
                benchUI.style.display = 'none';
                updateInventoryUI();
            } else {
                invUI.style.display = 'none';
                benchUI.style.display = 'none';
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
                    velocity.y += 15 + (powerups.sneakers * 2); // Sneakers add jump height
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
    const floorGeometry = new THREE.PlaneGeometry(1000, 1000, 150, 150);
    floorGeometry.rotateX(-Math.PI / 2);

    // Displace vertices to make simple terrain
    const positionAttribute = floorGeometry.attributes.position;
    for (let i = 0; i < positionAttribute.count; i++) {
        const x = positionAttribute.getX(i);
        const z = positionAttribute.getZ(i);
        // Procedural hills
        const y = getTerrainHeight(x, z);
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

    for (let i = 0; i < 200; i++) {
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.x = Math.random() * 1000 - 500;
        trunk.position.z = Math.random() * 1000 - 500;
        // Basic height placement based on flat world (will clip through bumpy terrain a bit)
        const groundHeight = getTerrainHeight(trunk.position.x, trunk.position.z);
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
    for (let i = 0; i < 150; i++) {
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.position.x = Math.random() * 1000 - 500;
        rock.position.z = Math.random() * 1000 - 500;
        const groundHeight = getTerrainHeight(rock.position.x, rock.position.z);
        rock.position.y = groundHeight + 1;
        rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        rock.castShadow = true;
        rock.receiveShadow = true;
        rock.userData = { type: 'rock' };
        scene.add(rock);
        objects.push(rock);
    }

    // Chest Generation
    const chestGeo = new THREE.BoxGeometry(1.5, 1, 1.5);
    for (let i = 0; i < 100; i++) {
        let chestType, chestColor, cost, powerup;
        const r = Math.random();
        if (r < 0.6) {
            chestType = 'chest_white'; chestColor = 0xffffff; cost = 25; powerup = 'sneakers';
        } else if (r < 0.9) {
            chestType = 'chest_blue'; chestColor = 0x4444ff; cost = 50; powerup = 'dumbbell';
        } else {
            chestType = 'chest_gold'; chestColor = 0xffd700; cost = 100; powerup = 'dagger';
        }
        const chestMat = new THREE.MeshLambertMaterial({ color: chestColor });
        const chest = new THREE.Mesh(chestGeo, chestMat);
        chest.position.x = Math.random() * 1000 - 500;
        chest.position.z = Math.random() * 1000 - 500;
        const groundHeight = getTerrainHeight(chest.position.x, chest.position.z);
        chest.position.y = groundHeight + 0.5;
        chest.rotation.y = Math.random() * Math.PI;
        chest.castShadow = true;
        chest.receiveShadow = true;
        chest.userData = { type: chestType, cost: cost, powerup: powerup };
        scene.add(chest);
        objects.push(chest);
    }

    // Renderer Setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    addItem('rock', 1); // Start with a rock

    window.addEventListener('resize', onWindowResize);

    // Interaction - Mining
    document.addEventListener('mousedown', (e) => {
        if (!controls.isLocked) return;
        if (e.button === 0) { // Left click
            if (['rock', 'axe', 'pickaxe', 'sword'].includes(equippedTool)) {
                isSwinging = true;
                swingTime = 0;
            } else if (equippedTool === 'apple') {
                if (countItem('apple') > 0) {
                    isSwinging = true;
                    swingTime = 0;
                    consumeItem('apple', 1);
                    playerHunger = Math.min(100, playerHunger + 20);
                    if (countItem('apple') === 0) {
                        setTimeout(() => {
                            selectSlot(currentSlot); // Auto unequip if no apples left
                        }, 500); // Wait for swing animation to finish roughly
                    }
                    return; // Don't mine when eating
                }
            } else if (equippedTool === 'wall' || equippedTool === 'floor' || equippedTool === 'campfire' || equippedTool === 'workbench') {
                if (ghostMesh && ghostMesh.material.color.getHex() === 0x00ff00 && countItem(equippedTool) > 0) {
                    consumeItem(equippedTool, 1);
                    
                    const buildGeo = ghostMesh.geometry.clone();
                    let buildMat;
                    if (equippedTool === 'campfire') {
                        buildMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
                    } else if (equippedTool === 'workbench') {
                        buildMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
                    } else {
                        buildMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
                    }
                    const buildMesh = new THREE.Mesh(buildGeo, buildMat);
                    buildMesh.position.copy(ghostMesh.position);
                    buildMesh.rotation.copy(ghostMesh.rotation);
                    buildMesh.castShadow = true;
                    buildMesh.receiveShadow = true;
                    buildMesh.userData = { type: equippedTool, hp: 50 };
                    
                    if (equippedTool === 'campfire') {
                        const fireLight = new THREE.PointLight(0xffa500, 1, 30);
                        fireLight.position.y = 1;
                        buildMesh.add(fireLight);
                        
                        // Add some visual fire (small orange box)
                        const fireVis = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0xff4500 }));
                        fireVis.position.y = 0.5;
                        buildMesh.add(fireVis);
                    }
                    
                    scene.add(buildMesh);
                    objects.push(buildMesh);
                    
                    if (countItem(equippedTool) === 0) {
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
                
                // Workbench Interaction
                if (obj.userData && obj.userData.type === 'workbench' && equippedTool === 'hand') {
                    isInventoryOpen = true;
                    controls.unlock();
                    document.getElementById('workbench-ui').style.display = 'flex';
                    updateInventoryUI();
                    return; // Don't punch the workbench when opening it
                }

                // Chest Interaction
                if (obj.userData && obj.userData.type.startsWith('chest_')) {
                    if (playerCoins >= obj.userData.cost) {
                        playerCoins -= obj.userData.cost;
                        document.getElementById('coin-ui').innerText = '💰 ' + playerCoins;
                        
                        // Spawn powerup
                        spawnDroppedItem(obj.userData.powerup, obj.position);
                        
                        // Remove chest
                        scene.remove(obj);
                        objects.splice(objects.indexOf(obj), 1);
                    } else {
                        // Flash red
                        const oldColor = obj.material.color.getHex();
                        obj.material.color.setHex(0xff0000);
                        setTimeout(() => {
                            if (obj.parent) obj.material.color.setHex(oldColor);
                        }, 200);
                    }
                    return;
                }

                if (obj !== floor) {
                    let isCrit = false;
                    let objDamage = 5; // Base hand damage to objects
                    let mobDamage = 5; // Base hand damage to mobs
                    
                    if (equippedTool === 'axe') {
                        objDamage = obj.userData.type === 'wood' ? 25 : 5;
                        mobDamage = 15;
                        if (obj.userData.type === 'wood') isCrit = true;
                    } else if (equippedTool === 'pickaxe') {
                        objDamage = obj.userData.type === 'rock' ? 25 : 5;
                        mobDamage = 15;
                        if (obj.userData.type === 'rock') isCrit = true;
                    } else if (equippedTool === 'sword') {
                        objDamage = 2; // Bad at mining
                        mobDamage = 35; // Great at fighting
                        if (obj.userData.type === 'monster' || obj.userData.type === 'boss') isCrit = true;
                    }

                    if (obj.userData.type === 'monster' || obj.userData.type === 'boss') {
                        obj.userData.hp -= mobDamage;
                        showDamageNumber(mobDamage, obj.position, isCrit);
                        
                        // Lifesteal from Dagger
                        if (powerups.dagger > 0) {
                            playerHP = Math.min(playerMaxHP, playerHP + powerups.dagger);
                            document.getElementById('hp-bar').style.width = (playerHP / playerMaxHP * 100) + '%';
                        }
                        
                        // Visual feedback for hit
                        const defaultColor = obj.userData.type === 'boss' ? 0x333333 : 0xff0000;
                        obj.material.color.setHex(0xffffff);
                        setTimeout(() => { if (obj.parent) obj.material.color.setHex(defaultColor); }, 100);
                        
                        // Pushback
                        const dx = obj.position.x - camera.position.x;
                        const dz = obj.position.z - camera.position.z;
                        const dist = Math.sqrt(dx*dx + dz*dz);
                        const knockback = obj.userData.type === 'boss' ? 0.2 : 1; // Boss takes less knockback
                        obj.position.x += (dx / dist) * knockback;
                        obj.position.z += (dz / dist) * knockback;
                    } else if (obj.userData.type === 'wood' || obj.userData.type === 'rock') {
                        if (obj.userData.hp === undefined) obj.userData.hp = 100;
                        obj.userData.hp -= objDamage;
                        showDamageNumber(objDamage, obj.position, isCrit);
                        
                        // Wiggle animation
                        const originalRotZ = obj.rotation.z;
                        obj.rotation.z += 0.1;
                        setTimeout(() => { if (obj.parent) obj.rotation.z = originalRotZ; }, 100);
                        
                        // Shrink slightly instead of full sink
                        obj.scale.y = Math.max(0.1, obj.userData.hp / 100);
                        
                        if (obj.userData.hp <= 0) {
                            scene.remove(obj);
                            const index = objects.indexOf(obj);
                            if (index > -1) objects.splice(index, 1);
                            
                            if (obj.userData.type === 'wood') {
                                spawnDroppedItem('wood', obj.position);
                                if (Math.random() < 0.3) {
                                    spawnDroppedItem('apple', obj.position);
                                }
                            } else if (obj.userData.type === 'rock') {
                                spawnDroppedItem('rock', obj.position);
                            }
                        }
                    }
                }
            }
        }
    });

    document.getElementById('btn-craft-workbench').addEventListener('click', (e) => {
        if (countItem('wood') >= 10) {
            consumeItem('wood', 10);
            addItem('workbench', 1);
        }
    });

    document.getElementById('btn-craft-pickaxe').addEventListener('click', (e) => {
        if (countItem('wood') >= 10 && countItem('rock') >= 10 && !hasPickaxe) {
            consumeItem('wood', 10);
            consumeItem('rock', 10);
            hasPickaxe = true;
            addItem('pickaxe', 1);
            document.getElementById('btn-craft-pickaxe').style.display = 'none';
        }
    });

    document.getElementById('btn-craft-axe').addEventListener('click', (e) => {
        if (countItem('wood') >= 5 && !hasAxe) {
            consumeItem('wood', 5);
            hasAxe = true;
            addItem('axe', 1);
            document.getElementById('btn-craft-axe').style.display = 'none';
        }
    });

    document.getElementById('btn-craft-sword').addEventListener('click', (e) => {
        if (countItem('wood') >= 5 && countItem('rock') >= 5 && !hasSword) {
            consumeItem('wood', 5);
            consumeItem('rock', 5);
            hasSword = true;
            addItem('sword', 1);
            document.getElementById('btn-craft-sword').style.display = 'none';
        }
    });

    document.getElementById('btn-craft-campfire').addEventListener('click', (e) => {
        if (countItem('wood') >= 10 && countItem('rock') >= 5) {
            consumeItem('wood', 10);
            consumeItem('rock', 5);
            addItem('campfire', 1);
        }
    });

    document.getElementById('btn-craft-wall').addEventListener('click', () => {
        if (countItem('wood') >= 5) {
            consumeItem('wood', 5);
            addItem('wall', 1);
        }
    });

    document.getElementById('btn-craft-floor').addEventListener('click', () => {
        if (countItem('wood') >= 5) {
            consumeItem('wood', 5);
            addItem('floor', 1);
        }
    });
}

function spawnDroppedItem(type, position) {
    let geo, mat;
    if (type === 'wood') {
        geo = new THREE.CylinderGeometry(0.2, 0.2, 0.8);
        mat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    } else if (type === 'rock') {
        geo = new THREE.DodecahedronGeometry(0.3);
        mat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    } else if (type === 'apple') {
        geo = new THREE.SphereGeometry(0.2);
        mat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    } else if (type === 'coin') {
        geo = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 8);
        geo.rotateX(Math.PI / 2); // coin stands up
        mat = new THREE.MeshLambertMaterial({ color: 0xffd700 }); // Gold
    } else if (type === 'sneakers' || type === 'dumbbell' || type === 'dagger') {
        geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const pColor = type === 'sneakers' ? 0xffffff : (type === 'dumbbell' ? 0x555555 : 0xff0000);
        mat = new THREE.MeshLambertMaterial({ color: pColor });
    } else {
        return;
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.position.y += 2; // pop up
    
    // Random toss velocity
    mesh.userData = {
        type: type,
        vx: (Math.random() - 0.5) * 5,
        vy: 5 + Math.random() * 5,
        vz: (Math.random() - 0.5) * 5,
        life: 0
    };
    
    scene.add(mesh);
    droppedItems.push(mesh);
}

function updateDroppedItems(delta) {
    for (let i = droppedItems.length - 1; i >= 0; i--) {
        const item = droppedItems[i];
        item.userData.life += delta;
        
        // Physics
        item.userData.vy -= 15 * delta; // gravity
        item.position.x += item.userData.vx * delta;
        item.position.y += item.userData.vy * delta;
        item.position.z += item.userData.vz * delta;
        
        // Floor collision
        const groundHeight = getTerrainHeight(item.position.x, item.position.z);
        if (item.position.y < groundHeight + 0.2) {
            item.position.y = groundHeight + 0.2;
            item.userData.vy *= -0.5; // bounce
            item.userData.vx *= 0.5; // friction
            item.userData.vz *= 0.5;
        }

        // Collection logic & Magnet effect
        if (item.userData.life > 0.5) {
            const dist = camera.position.distanceTo(item.position);
            
            // Magnet effect (pull towards player if within 8 units)
            if (dist < 8) {
                const dir = new THREE.Vector3().subVectors(camera.position, item.position).normalize();
                item.position.add(dir.multiplyScalar(15 * delta));
            }
            
            // Actually collect if within 3 units
            if (dist < 3) {
                let collected = false;
                if (item.userData.type === 'coin') {
                    playerCoins += 1;
                    document.getElementById('coin-ui').innerText = '💰 ' + playerCoins;
                    collected = true;
                } else if (['sneakers', 'dumbbell', 'dagger'].includes(item.userData.type)) {
                    addPowerup(item.userData.type);
                    collected = true;
                } else {
                    // Normal inventory item
                    collected = addItem(item.userData.type, 1);
                }
                
                if (collected) {
                    scene.remove(item);
                    droppedItems.splice(i, 1);
                }
            }
        }
    }
}

function spawnBoss() {
    // Big Chunk Boss
    const bossGeo = new THREE.BoxGeometry(8, 12, 8); // Huge box for now
    const bossMat = new THREE.MeshLambertMaterial({ color: 0x333333 }); // Dark grey rock
    const boss = new THREE.Mesh(bossGeo, bossMat);
    
    // Spawn 80 units away from player
    const angle = Math.random() * Math.PI * 2;
    boss.position.x = camera.position.x + Math.cos(angle) * 80;
    boss.position.z = camera.position.z + Math.sin(angle) * 80;
    boss.position.y = getTerrainHeight(boss.position.x, boss.position.z) + 6;
    
    boss.castShadow = true;
    boss.receiveShadow = true;
    
    boss.userData = { type: 'boss', hp: 500, maxHp: 500, nextAttack: 0 };
    scene.add(boss);
    objects.push(boss);
    monsters.push(boss);
    
    currentBoss = boss;
    
    // Show UI
    document.getElementById('boss-ui').style.display = 'block';
    document.getElementById('boss-hp-bar').style.width = '100%';
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
            
            // Drop coins/loot
            if (mob.userData.type === 'boss') {
                document.getElementById('boss-ui').style.display = 'none';
                currentBoss = null;
                // Loot explosion
                for (let c = 0; c < 25; c++) spawnDroppedItem('coin', mob.position);
                for (let c = 0; c < 5; c++) spawnDroppedItem('wood', mob.position);
                for (let c = 0; c < 3; c++) spawnDroppedItem('apple', mob.position);
                spawnDroppedItem('dagger', mob.position); // Guaranteed dagger
            } else {
                // Normal monster drop
                const coinCount = Math.floor(Math.random() * 4) + 2;
                for (let c = 0; c < coinCount; c++) {
                    spawnDroppedItem('coin', mob.position);
                }
            }
            
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
            const attackRange = mob.userData.type === 'boss' ? 6 : 2.5;
            if (dist > attackRange) { // stop at attack range
                const moveSpeed = mob.userData.type === 'boss' ? (4 * delta) : (10 * delta);
                mob.position.x += dirX * moveSpeed;
                mob.position.z += dirZ * moveSpeed;
            } else {
                // Attack player
                if (performance.now() > mob.userData.nextAttack) {
                    const atkCooldown = mob.userData.type === 'boss' ? 2500 : 1500;
                    mob.userData.nextAttack = performance.now() + atkCooldown;
                    const dmg = mob.userData.type === 'boss' ? 35 : 10;
                    takeDamage(dmg);
                }
            }
        }
        
        // Simple terrain height follow
        const groundHeight = getTerrainHeight(mob.position.x, mob.position.z);
        const yOffset = mob.userData.type === 'boss' ? 6 : 1; // Boss is taller (height 12, so center is 6)
        mob.position.y = groundHeight + yOffset;
        
        // Update Boss HP UI
        if (mob.userData.type === 'boss') {
            document.getElementById('boss-hp-bar').style.width = Math.max(0, (mob.userData.hp / mob.userData.maxHp) * 100) + '%';
        }
    }
}

function takeDamage(amount) {
    if (isDead) return;
    playerHP -= amount;
    const hpBar = document.getElementById('hp-bar');
    hpBar.style.width = Math.max(0, (playerHP / playerMaxHP) * 100) + '%';
    
    // flash red
    document.body.style.backgroundColor = 'red';
    setTimeout(() => { document.body.style.backgroundColor = ''; }, 100);
    
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

function showDamageNumber(amount, position, isCrit = false) {
    const container = document.getElementById('damage-container');
    if (!container) return;
    
    // Project 3D position to 2D screen space
    const vector = position.clone();
    vector.y += 1; // Show slightly above
    vector.project(camera);
    
    // Only show if in front of camera
    if (vector.z > 1) return;
    
    const x = (vector.x * .5 + .5) * window.innerWidth;
    const y = (vector.y * -.5 + .5) * window.innerHeight;
    
    const el = document.createElement('div');
    el.className = 'damage-text';
    el.innerText = '-' + amount;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    if (isCrit) {
        el.style.color = '#ffcc00';
        el.style.fontSize = '32px';
    }
    
    container.appendChild(el);
    setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
    }, 1000);
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
        
        // Update Day UI Bar
        const dayBar = document.getElementById('day-bar');
        if (isNight) {
            dayBar.style.backgroundColor = '#4444ff';
            dayBar.style.width = ((cycleProgress - 0.5) * 200) + '%';
        } else {
            dayBar.style.backgroundColor = '#ffd700';
            dayBar.style.width = (cycleProgress * 200) + '%';
        }
        
        if (dayCount >= 4 && isNight && !bossSpawnedDay4) {
            bossSpawnedDay4 = true;
            spawnBoss();
        }

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
        updateDroppedItems(globalDelta);

        // Hunger Logic
        playerHunger = Math.max(0, playerHunger - globalDelta * 0.15); // drain 0.15 per second
        
        // Campfire Healing Logic
        let nearCampfire = false;
        for (const obj of objects) {
            if (obj.userData && obj.userData.type === 'campfire') {
                const distSq = camera.position.distanceToSquared(obj.position);
                if (distSq < 100) { // within 10 units
                    nearCampfire = true;
                    break;
                }
            }
        }
        
        if (nearCampfire) {
            playerHP = Math.min(playerMaxHP, playerHP + globalDelta * 2); // Heal 2 HP/s
            document.getElementById('hp-bar').style.width = (playerHP / playerMaxHP * 100) + '%';
        }

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

        // Terrain Collision
        const groundHeight = getTerrainHeight(camera.position.x, camera.position.z);
        const playerHeight = groundHeight + 2;

        if (camera.position.y < playerHeight) {
            velocity.y = 0;
            camera.position.y = playerHeight;
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
                } else {
                    // Default for campfire, workbench, etc.
                    ghostMesh.position.y = hitPoint.y + (ghostMesh.geometry.parameters.height / 2); 
                    ghostMesh.position.z = Math.round(pos.z / gridSize) * gridSize;
                    ghostMesh.rotation.set(0, 0, 0);
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
    else if (equippedTool === 'sword' && swordModel) activeModel = swordModel;
    else if (equippedTool === 'axe' && axeModel) activeModel = axeModel;
    else if (equippedTool === 'rock' && rockModel) activeModel = rockModel;
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

// Initial UI Setup
updateInventoryUI();
