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
    apple: 0
};
let isInventoryOpen = false;

let hasPickaxe = false;
let equippedTool = 'hand';
let pickaxeModel = null;
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
    document.getElementById('inv-wood').innerText = inventory.wood;
    document.getElementById('inv-rock').innerText = inventory.rock;
    document.getElementById('inv-apple').innerText = inventory.apple;
    
    const craftBtn = document.getElementById('btn-craft-pickaxe');
    if (inventory.wood >= 10 && !hasPickaxe) {
        craftBtn.disabled = false;
    } else {
        craftBtn.disabled = true;
    }
}

function equipTool(tool) {
    equippedTool = tool;
    
    // UI update
    for (let i = 1; i <= 3; i++) {
        document.querySelector(`.hotbar-slot:nth-child(${i})`).classList.remove('active');
    }
    
    if (tool === 'hand') {
        document.querySelector('.hotbar-slot:nth-child(1)').classList.add('active');
        if (pickaxeModel) pickaxeModel.visible = false;
        if (appleModel) appleModel.visible = false;
    } else if (tool === 'pickaxe') {
        document.querySelector('.hotbar-slot:nth-child(2)').classList.add('active');
        if (pickaxeModel) pickaxeModel.visible = true;
        if (appleModel) appleModel.visible = false;
    } else if (tool === 'apple') {
        document.querySelector('.hotbar-slot:nth-child(3)').classList.add('active');
        if (pickaxeModel) pickaxeModel.visible = false;
        if (appleModel) appleModel.visible = true;
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
                controls.lock();
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
                equipTool('hand');
                break;
            case 'Digit2':
                if (hasPickaxe) equipTool('pickaxe');
                break;
            case 'Digit3':
                if (inventory.apple > 0) equipTool('apple');
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
    const boxGeometry = new THREE.BoxGeometry(2, 5, 2);
    const boxMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const leafGeometry = new THREE.BoxGeometry(4, 4, 4);
    const leafMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });

    for (let i = 0; i < 50; i++) {
        const trunk = new THREE.Mesh(boxGeometry, boxMaterial);
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
        
        // Leaves
        const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
        leaf.position.copy(trunk.position);
        leaf.position.y += 3.5;
        leaf.castShadow = true;
        leaf.userData = { type: 'wood' };
        scene.add(leaf);
        objects.push(leaf); // For basic raycast collision
    }

    const rockGeometry = new THREE.DodecahedronGeometry(2);
    const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
    for (let i = 0; i < 30; i++) {
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.position.x = Math.random() * 200 - 100;
        rock.position.z = Math.random() * 200 - 100;
        const groundHeight = Math.sin(rock.position.x / 20) * Math.cos(rock.position.z / 20) * 5;
        rock.position.y = groundHeight + 1; 
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
                            equipTool('hand'); // Auto equip hand if no apples left
                            document.querySelector('.hotbar-slot:nth-child(3)').innerText = '3';
                        }, 500); // Wait for swing animation to finish roughly
                    }
                    updateInventoryUI();
                    return; // Don't mine when eating
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
                                document.querySelector('.hotbar-slot:nth-child(3)').innerText = 'Apple';
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
            equipTool('pickaxe');
            
            // Hide craft button
            e.target.style.display = 'none';
            
            // Update hotbar UI text
            document.querySelector('.hotbar-slot:nth-child(2)').innerText = 'Pick';
            
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
        
        if (dist > 2.5) { // stop at 2.5 units
            const moveSpeed = 10 * delta;
            mob.position.x += (dx / dist) * moveSpeed;
            mob.position.z += (dz / dist) * moveSpeed;
        } else {
            // Attack player
            if (performance.now() > mob.userData.nextAttack) {
                mob.userData.nextAttack = performance.now() + 1500; // Attack every 1.5s
                takeDamage(10); // Deal 10 damage
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
