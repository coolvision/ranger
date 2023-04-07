
import * as THREE from 'three';
import RAPIER from './rapier3d-compat';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { Robot } from './robot.js'
import * as utils from './rapier_utils.js'

let container;
let camera, scene, renderer, controls;
let camera2, renderer2;
let fp_image_size = 512;
let transform_ctrl;
let pointer_target = new THREE.Mesh();

let world;
let eventQueue;
let ground_collider;
let boxes = [];

let robot;
let target_direction = new THREE.Vector3();
let target_rotation = new THREE.Quaternion();

let socket;
let motion_task = {
	done: true,
	type: "",
    translation: 0,
    rotation: 0
};


let render_i = 0;


await init();
async function init() {

    console.log("motion_task", motion_task)

    container = document.querySelector('body');

    renderer2 = new THREE.WebGLRenderer({antialias: true});
    renderer2.setPixelRatio(1);
    renderer2.shadowMap.enabled = true;
    renderer2.domElement.className = 'overflow-hidden absolute ba';
    renderer2.setSize(fp_image_size, fp_image_size);
    container.appendChild(renderer2.domElement);

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    let w = window.visualViewport.width;
    let h = window.visualViewport.height;
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    window.addEventListener('resize', function() {
        let w = window.visualViewport.width;
        let h = window.visualViewport.height;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        render();
    });

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    camera = new THREE.PerspectiveCamera(70, w / h, 0.1, 100);
    camera.position.set(0, 1.5, 2.2);
    scene.add(camera);

    await RAPIER.init();
    let gravity = {x: 0.0, y: -9.81, z: 0.0};
    world = new RAPIER.World(gravity);
    eventQueue = new RAPIER.EventQueue(true);
    let ip = world.integrationParameters;
    ip.erp = 1.0;
    ip.maxStabilizationIterations = 10;

    let groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 1, 10.0);
    groundColliderDesc.setTranslation(0, -1, 0);
    ground_collider = world.createCollider(groundColliderDesc);
    ground_collider.ignore_controller = true;

    robot = new Robot(world, scene);

    robot.base.r.setNextKinematicTranslation({x: 0, y: robot.base.h/2, z: 0}, true);
    world.step(eventQueue);
    robot.base.r.recomputeMassPropertiesFromColliders();
    robot.base.m.add(pointer_target);


    camera2 = new THREE.PerspectiveCamera(70,1, 0.1, 100);
    robot.base.m.add(camera2);
    camera2.position.set(0, 1.5, 0);
    camera2.rotateY(Math.PI);
    camera2.rotateX(-Math.PI / 4);


    transform_ctrl = new TransformControls(camera, renderer.domElement);
    transform_ctrl.addEventListener('change', render);
    transform_ctrl.addEventListener('dragging-changed', function (event) {
        controls.enabled = ! event.value;
    });
    transform_ctrl.size = 0.75
    transform_ctrl.setSpace("local");
    transform_ctrl.attach(pointer_target);

    scene.add(transform_ctrl);

    let size = 0.5
    let p = new THREE.Vector3(0, 1, 0.75);
    let c = new THREE.Color();
    c.setHex(0xffffff * Math.random());
    let box = utils.addBody("dynamic", "cuboid", world, scene, 1, 0, -1, 100, size, size, size, p.x, p.y, p.z, c);
    boxes.push(box);

    size = 0.4
    p.set(0.55, 1, 0.5);
    c.setHex(0xffffff * Math.random());
    let box2 = utils.addBody("dynamic", "cuboid", world, scene, 1, 0, -1, 100, size, size, size, p.x, p.y, p.z, c);
    boxes.push(box2);

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

//==============================================================================
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
    scene.add( helper );

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.damping = 0.2;
    // controls.enableZoom = false;
    controls.addEventListener('change', render);

    renderer.setAnimationLoop(render);

}

function render() {

    render_i++;

    for (let i = 0; i < boxes.length; i++) {
        let p = boxes[i].r.translation();
        let q = boxes[i].r.rotation();
        boxes[i].m.position.set(p.x, p.y, p.z);
        boxes[i].m.quaternion.set(q.x, q.y, q.z, q.w);
    }

    robot.setGripperTranslation(pointer_target);

    robot.updateModels();

    // robot.resetGripperSensors();
    // eventQueue.drainContactForceEvents(event => {
    //     let d = event.maxForceDirection();
    //     let dv = new THREE.Vector3(d.x, d.y, d.z);
    //     let c1 = world.getCollider(event.collider1());
    //     let c2 = world.getCollider(event.collider2());
    //     c1.touch = "on";
    //     c2.touch = "on";
    // });
    // robot.updateGripperState();

    robot.setPlatformTranslation(target_direction);

    world.step(eventQueue);

    if (!motion_task.done && motion_task.type == "rotation") {
        let angle = THREE.MathUtils.degToRad(motion_task.angle);
        let q = new THREE.Quaternion();
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        q.multiply(robot.base.m.quaternion);
        robot.setPlatformRotation(q);
		target_rotation.copy(q);

		motion_task.done = true;

		

		robot.base.m.quaternion.copy(q);
		robot.base.m.updateWorldMatrix(true, true);
    }

    robot.setGripperRotation(pointer_target);

    console.log("target_rotation", render_i, target_rotation);
    console.log("robot", robot.base.r.rotation(), robot.base.m.quaternion);
    console.log("pointer", robot.g3.r.translation(), pointer_target.position);


    renderer.render(scene, camera);

    scene.remove(transform_ctrl);
    renderer2.render(scene, camera2);
	scene.add(transform_ctrl);

    if (socket && socket.readyState == 1) {
        // var gl = renderer2.getContext();
        // var pixels = new Uint8Array(256 * 256 * 4);
        // gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        // socket.send(pixels);
        let imgData = renderer2.domElement.toDataURL('image/png');
        // console.log("imgData", imgData)
        socket.send(imgData);
    }
}

window.addEventListener('keyup', function(event) {
    if (event.code == "KeyW" || event.code == "KeyS") {
        target_direction.set(0, 0, 0);
    }
    if (event.code == "KeyA" || event.code == "KeyD") {
        let R = robot.base.r.rotation();
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
            // controls.enableZoom = !controls.enableZoom;
            world.step(eventQueue);
            break;
        case "KeyG":
            robot.gripper_open = !robot.gripper_open;
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
            angle = 5;
            update_rotation = true;
            break;
        case "KeyD":
            angle = -5;
            update_rotation = true;
            break;
    }

    if (update_position) {
        target_direction = p;
    }

    if (update_rotation) {
        // angle = THREE.MathUtils.degToRad(angle);
        // let q = new THREE.Quaternion();
        // q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        // q.multiply(robot.base.m.quaternion);
        // target_rotation = q;

		motion_task.done = false;
		motion_task.type = "rotation";
		motion_task.angle = angle;
    }
});


function connect() {
    socket = new WebSocket("ws://localhost:8000/websocket");

    socket.addEventListener("message", (event) => {
        // console.log(event.data,  JSON.parse(event.data));
        let e = JSON.parse(event.data);
        let p = new THREE.Vector3();
        let angle = 0;
        let update_position = false;
        let update_rotation = false;

        if (e.left) {
            motion_task.done = false;
            motion_task.type = "rotation";
            motion_task.angle = 1;
        }
        if (e.right) {
            motion_task.done = false;
            motion_task.type = "rotation";
            motion_task.angle = -1;
        }
        if (e.up) {
            motion_task.done = false;
            motion_task.type = "translation";
            motion_task.translation = 0.01;
        }
        if (e.down) {
            motion_task.done = false;
            motion_task.type = "translation";
            motion_task.translation = -0.01;
        }

    });
    socket.addEventListener("close", (event) => {
        console.log(event);
        setTimeout(function() {
            connect();
        }, 1000);
    });
    socket.addEventListener("close", (event) => {
        console.log(event);
        socket.close();
    });
}
connect();
