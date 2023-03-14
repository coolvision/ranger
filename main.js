
import * as THREE from 'three';
import RAPIER from './rapier3d-compat';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { Robot } from './robot.js'
import * as utils from './rapier_utils.js'

let container;
let camera, scene, renderer;

let transform_ctrl;
let pointer_target = new THREE.Mesh();

let world;
let eventQueue;
let boxes = [];

let robot;
let target_direction = new THREE.Vector3();
let target_rotation = new THREE.Quaternion();

await init();
async function init() {

    container = document.getElementById('app');
    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    sceneSetup();

    await RAPIER.init();
    let gravity = {x: 0.0, y: -9.81, z: 0.0};
    world = new RAPIER.World(gravity);
    eventQueue = new RAPIER.EventQueue(true);
    let ip = world.integrationParameters;
    ip.erp = 1.0;
    ip.maxStabilizationIterations = 10;

    robot = new Robot();

    // r.base.r.setNextKinematicTranslation({x: 0, y: r.base.h/2, z: 0}, true);
    // world.step(eventQueue);
    // r.base.r.recomputeMassPropertiesFromColliders();
    // r.base.m.add(pointer_target);

    // transform_ctrl = new TransformControls(camera, renderer.domElement);
    // transform_ctrl.addEventListener('change', render);
    // transform_ctrl.addEventListener('dragging-changed', function (event) {
    //     controls.enabled = ! event.value;
    // });
    // transform_ctrl.size = 0.75
    // transform_ctrl.setSpace("local");
    // transform_ctrl.attach(pointer_target);
    //
    // scene.add(transform_ctrl);

    let size = 0.5
    for (let i = 0; i < 1; i++) {
        let p = new THREE.Vector3(0, 1, 0.75);
        let c = new THREE.Color();
        c.setHex(0xffffff * Math.random());
        let box = utils.addBody("dynamic", "cuboid", world, scene, 1, 0, -1, 100, size, size, size, p.x, p.y, p.z, c);
        boxes.push(box);
    }

    for (let i = 0; i < 100; i++) {
        world.step(eventQueue);
    }

    pointer_target.position.set(0.15, 0.455, 0.5);

    size = 0.05;
    for (let i = 1; i < 5; i++) {
        for (let j = 1; j < 5; j++) {
            let p = new THREE.Vector3(-0.25 + i/10, 1, -0.25 + j/10);
            p.z += 0.75;
            let c = new THREE.Color();
            c.setHex(0xffffff * Math.random());
            let box = utils.addBody("dynamic", "cuboid", world, scene, 1, 0, -1, 0, size, size, size, p.x, p.y, p.z, c);
            box.c.ignore_controller = true;
            boxes.push(box);
        }
    }

    renderer.setAnimationLoop(render);
}

function sceneSetup() {

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1, 1.2);
    scene.add(camera);

    scene.add( new THREE.AmbientLight(0xf0f0f0));
    const light = new THREE.SpotLight(0xffffff, 1.5);
    light.position.set(0, 15, 2);
    light.angle = Math.PI * 0.2;
    light.castShadow = true;
    light.shadow.camera.near = 2;
    light.shadow.camera.far = 20;
    light.shadow.bias = - 0.000222;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    scene.add(light);

    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    planeGeometry.rotateX(- Math.PI / 2);
    const planeMaterial = new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.2});

    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.position.y = - 2;
    plane.receiveShadow = true;
    scene.add( plane );

    const helper = new THREE.GridHelper(20, 20);
    helper.material.opacity = 0.25;
    helper.material.transparent = true;
    scene.add(helper);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.damping = 0.2;
    controls.addEventListener('change', render);
}

function render() {

    for (let i = 0; i < boxes.length; i++) {
        let p = boxes[i].r.translation();
        let q = boxes[i].r.rotation();
        boxes[i].m.position.set(p.x, p.y, p.z);
        boxes[i].m.quaternion.set(q.x, q.y, q.z, q.w);
    }

    world.step(eventQueue);

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    render();
}

window.addEventListener('keyup', function(event) {
    if (event.code == "KeyW" || event.code == "KeyS") {
        target_direction.set(0, 0, 0);
    }
    if (event.code == "KeyA" || event.code == "KeyD") {
        let R = r.base.r.rotation();
        target_rotation.set(R.x, R.y, R.z, R.w);
    }
});

window.addEventListener('keydown', function(event) {

    let p = new THREE.Vector3();
    let angle = 0;
    let update_position = false;
    let update_rotation = false;

    switch ( event.code ) {
        case "KeyN":
            robot.saveState();
            break;
        case "KeyM":
            robot.restoreState();
            break;
        case "KeyT":
            transform_ctrl.setMode('translate');
            break;
        case "KeyR":
            transform_ctrl.setMode('rotate');
            break;
        case "KeyZ":
            world.step(eventQueue);
            break;
        case "KeyG":
            gripper_open = !gripper_open;
            break;
        case "KeyW":
            p.set(0, 0, 0.01);
            update_position = true;
            break;
        case "KeyS":
            p.set(0, 0, -0.01);
            update_position = true;
            break;
        case "KeyA":
            angle = 90;
            update_rotation = true;
            break;
        case "KeyD":
            angle = -90;
            update_rotation = true;
            break;
    }

    if (update_position) {
        target_direction = p;
    }

    if (update_rotation) {
        angle = THREE.MathUtils.degToRad(angle);
        let q = new THREE.Quaternion();
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        q.multiply(r.base.m.quaternion);
        target_rotation = q;
    }
});
