
import * as THREE from 'three';
import RAPIER from '../lib/rapier3d-compat';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { S1 } from './robots/s1.js'
import * as utils from './rapier_utils.js'

import URDFLoader from 'urdf-loader';

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
    v: 0,
};
let render_i = 0;

function scene_setup() {

    container = document.querySelector('body');

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

}


await init();
async function init() {

	scene_setup();

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

    robot = new S1(world, scene);

    robot.base.r.setNextKinematicTranslation({x: 0, y: robot.base.h/2, z: 0}, true);
    world.step(eventQueue);
    robot.base.r.recomputeMassPropertiesFromColliders();
    robot.base.m.add(pointer_target);

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

	pointer_target.position.set(0.15, 0.455, 0.5);



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
    scene.add( plane );;

    const helper = new THREE.GridHelper(20, 20);
    helper.material.opacity = 0.25;
    helper.material.transparent = true;
    scene.add( helper );

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.damping = 0.2;
    controls.addEventListener('change', render);

    renderer.setAnimationLoop(render);
}

function render() {

    render_i++;

	if (!motion_task.done) {
		console.log("motion_task", motion_task)
	}

	if (!motion_task.done && motion_task.type == "rotation") {
        let angle = THREE.MathUtils.degToRad(motion_task.v);
        let q = new THREE.Quaternion();
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        q.multiply(robot.base.m.quaternion);
        robot.setPlatformRotation(q);
		target_rotation.copy(q);
		motion_task.done = true;
		robot.base.m.quaternion.copy(q);
		robot.base.m.updateWorldMatrix(true, true);
    }

	if (!motion_task.done && motion_task.type == "g_rotation") {
		pointer_target.rotateY(motion_task.v[0]);
		pointer_target.rotateX(motion_task.v[1]);
		pointer_target.rotateZ(motion_task.v[2]);
		motion_task.done = true;
	}
    robot.setGripperRotation(pointer_target);

	if (!motion_task.done && motion_task.type == "translation") {
		let p = new THREE.Vector3(0, 0, motion_task.v);
		console.log("call setPlatformTranslation", p)
		let r = robot.setPlatformTranslation(p);
		motion_task.done = true;
		robot.base.m.position.copy(r);
		robot.base.m.updateWorldMatrix(true, true);
	}

	if (!motion_task.done && motion_task.type == "g_translation") {
		pointer_target.position.x += motion_task.v[0];
		pointer_target.position.y += motion_task.v[1];
		pointer_target.position.z += motion_task.v[2];
		motion_task.done = true;
	}
	robot.setGripperTranslation(pointer_target);

    robot.resetGripperSensors();
    eventQueue.drainContactForceEvents(event => {
        let d = event.maxForceDirection();
        let dv = new THREE.Vector3(d.x, d.y, d.z);
        let c1 = world.getCollider(event.collider1());
        let c2 = world.getCollider(event.collider2());
        c1.touch = "on";
        c2.touch = "on";
    });
    robot.updateGripperState();

    world.step(eventQueue);

	robot.updateModels();


	for (let i = 0; i < boxes.length; i++) {
        let p = boxes[i].r.translation();
        let q = boxes[i].r.rotation();
        boxes[i].m.position.set(p.x, p.y, p.z);
        boxes[i].m.quaternion.set(q.x, q.y, q.z, q.w);
    }

    // console.log("target_rotation", render_i, target_rotation);
    // console.log("robot", robot.base.r.rotation(), robot.base.m.quaternion);
    // console.log("pointer", robot.g3.r.translation(), pointer_target.position);

    renderer.render(scene, camera);
    if (socket && socket.readyState == 1) {
        let imgData = renderer2.domElement.toDataURL('image/png');
        // socket.send(imgData);
    }

	// console.log("motion_task after", motion_task)
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

    let update_position = false;
    let update_rotation = false;

	console.log("keydown", event.code)

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
			task("translation", 0.1);
            break;
        case "KeyS":
			task("translation", -0.1);
            break;
        case "KeyA":
     		task("rotation", 5);
            break;
        case "KeyD":
            task("rotation", -5);
            update_rotation = true;
            break;
    }

});

function task(type, v) {
	motion_task.done = false;
	motion_task.type = type;
	motion_task.v = v;
}

function connect() {
    socket = new WebSocket("ws://localhost:8000/websocket");

    socket.addEventListener("message", (event) => {
        console.log(event.data,  JSON.parse(event.data));
        let e = JSON.parse(event.data);

        if (e.left) task("rotation", 1);
        if (e.right) task("rotation", -1);
        if (e.up) task("translation", 0.01);
        if (e.down) task("translation", -0.01);

		let t = 0.01;
		if (e.g_left) task("g_translation", [t, 0, 0]);
        if (e.g_right) task("g_translation", [-t, 0, 0]);
        if (e.g_up) task("g_translation", [0, t, 0]);
        if (e.g_down) task("g_translation", [0, -t, 0]);
		if (e.g_fw) task("g_translation", [0, 0, t]);
        if (e.g_bw) task("g_translation", [0, 0, -t]);

    	let a = THREE.MathUtils.degToRad(5);
		if (e.g_yaw1) task("g_rotation", [a, 0, 0]);
        if (e.g_yaw2) task("g_rotation", [-a, 0, 0]);
        if (e.g_pitch1) task("g_rotation", [0, -a, 0]);
        if (e.g_pitch2) task("g_rotation", [0, a, 0]);
		if (e.g_roll1) task("g_rotation", [0, 0, -a]);
        if (e.g_roll2) task("g_rotation", [0, 0, a]);

		if (e.gripper_toggle) robot.gripper_open = !robot.gripper_open;

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
// connect();
