
import * as THREE from 'three';
import RAPIER from '../lib/rapier3d-compat';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { S1 } from './robots/s1.js'
import * as utils from './rapier_utils.js'

// import URDFLoader from 'urdf-loader';
import URDFLoader from '../lib/URDFLoader.js';

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
    // scene.background = new THREE.Color(0xf0f0f0);
	scene.background = new THREE.Color(0x999999);

    camera = new THREE.PerspectiveCamera(70, w / h, 0.1, 100);
    camera.position.set(0, 1.5, 2.2);
    scene.add(camera);
}

function env_setup() {

    scene.add(new THREE.AmbientLight(0xf0f0f0));
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

    // const planeGeometry = new THREE.PlaneGeometry(20, 20);
    // planeGeometry.rotateX(- Math.PI / 2);
    // const planeMaterial = new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.2});
    //
    // const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    // // plane.position.y = - 2;
    // plane.receiveShadow = true;
    // scene.add( plane );;

    const helper = new THREE.GridHelper(20, 20);
    helper.material.opacity = 0.25;
    helper.material.transparent = true;
    scene.add( helper );

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.damping = 0.2;
    controls.addEventListener('change', render);

}


let a1_robot = {
    links: {}
};

await init();
async function init() {

    scene_setup();

    await RAPIER.init();
    let gravity = {x: 0.0, y: -9.81, z: 0.0};
    world = new RAPIER.World(gravity);
    eventQueue = new RAPIER.EventQueue(true);
    let ip = world.integrationParameters;
    // ip.erp = 1.0;
    // ip.maxStabilizationIterations = 10;

    let groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 1, 10.0);
    groundColliderDesc.setTranslation(0, -1, 0);
    ground_collider = world.createCollider(groundColliderDesc);
    ground_collider.ignore_controller = true;

    env_setup();

    const manager = new THREE.LoadingManager();
    const loader = new URDFLoader(manager);
    let urdf;
    loader.packages = {
        'a1_description' : '/src/robots/a1_description'            // The equivalent of a (list of) ROS package(s):// directory
    };
    loader.parseCollision = true;
    loader.load(
      '/src/robots/a1_description/urdf/a1.urdf',                    // The path to the URDF within the package OR absolute
      result => {
          urdf = result;
      }
    );

    manager.onLoad = () => {

        // The robot is loaded!
        // console.log("add robot", robot);
        // robot.rotateX(- Math.PI / 2);
        // scene.add(robot);

        // console.log("links", robot.links);
        let x = 0;
        for (let l in urdf.links) {
            // if (l == "base") continue;
            // if (l != "trunk") continue;
            console.log("link", l, urdf.links[l]);

            if (urdf.links[l].children.length >= 2) {

                // is it the same for all URDFs?
                let v = urdf.links[l].children[0].children[0].children[0];
                let c = urdf.links[l].children[1].children[0];

                if (v && c) {
                    console.log("visual", v);
                    console.log("collider", c);

                    a1_robot.links[l] = utils.addLink("dynamic", v, c, world, scene);
                }
            }
        }

        console.log("a1_robot", a1_robot)

        // robot.rotation.x = Math.PI / 2;
        // robot.traverse(c => {
        //     c.castShadow = true;
        // });
        // for (let i = 1; i <= 6; i++) {
        //
        //     robot.joints[`HP${ i }`].setJointValue(MathUtils.degToRad(30));
        //     robot.joints[`KP${ i }`].setJointValue(MathUtils.degToRad(120));
        //     robot.joints[`AP${ i }`].setJointValue(MathUtils.degToRad(-60));
        //
        // }
        // robot.updateMatrixWorld(true);
        //
        // const bb = new Box3();
        // bb.setFromObject(robot);
        //
        // robot.position.y -= bb.min.y;
        // scene.add(robot);

    };


    renderer.setAnimationLoop(render);
}

function render() {

    // if (!motion_task.done && motion_task.type == "rotation") {
    //     let angle = THREE.MathUtils.degToRad(motion_task.v);
    //     let q = new THREE.Quaternion();
    //     q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    //     q.multiply(robot.base.m.quaternion);
    //     robot.setPlatformRotation(q);
    //     target_rotation.copy(q);
    //     motion_task.done = true;
    //     robot.base.m.quaternion.copy(q);
    //     robot.base.m.updateWorldMatrix(true, true);
    // }
    //
    // if (!motion_task.done && motion_task.type == "g_rotation") {
    //     pointer_target.rotateY(motion_task.v[0]);
    //     pointer_target.rotateX(motion_task.v[1]);
    //     pointer_target.rotateZ(motion_task.v[2]);
    //     motion_task.done = true;
    // }
    // robot.setGripperRotation(pointer_target);
    //
    // if (!motion_task.done && motion_task.type == "translation") {
    //     let p = new THREE.Vector3(0, 0, motion_task.v);
    //     console.log("call setPlatformTranslation", p)
    //     let r = robot.setPlatformTranslation(p);
    //     motion_task.done = true;
    //     robot.base.m.position.copy(r);
    //     robot.base.m.updateWorldMatrix(true, true);
    // }
    //
    // if (!motion_task.done && motion_task.type == "g_translation") {
    //     pointer_target.position.x += motion_task.v[0];
    //     pointer_target.position.y += motion_task.v[1];
    //     pointer_target.position.z += motion_task.v[2];
    //     motion_task.done = true;
    // }
    // robot.setGripperTranslation(pointer_target);
    //
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
    //
    world.step(eventQueue);
    //
    // robot.updateModels();

    utils.updateLinks(a1_robot);


    renderer.render(scene, camera);
}

// window.addEventListener('keyup', function(event) {
//     if (event.code == "KeyW" || event.code == "KeyS") {
//         target_direction.set(0, 0, 0);
//     }
//     if (event.code == "KeyA" || event.code == "KeyD") {
//         let R = robot.base.r.rotation();
//         target_rotation.set(R.x, R.y, R.z, R.w);
//     }
// });
//
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
//
// function task(type, v) {
//     motion_task.done = false;
//     motion_task.type = type;
//     motion_task.v = v;
// }
//
// function connect() {
//     socket = new WebSocket("ws://localhost:8000/websocket");
//
//     socket.addEventListener("message", (event) => {
//         console.log(event.data,  JSON.parse(event.data));
//         let e = JSON.parse(event.data);
//
//         if (e.left) task("rotation", 1);
//         if (e.right) task("rotation", -1);
//         if (e.up) task("translation", 0.01);
//         if (e.down) task("translation", -0.01);
//
//         let t = 0.01;
//         if (e.g_left) task("g_translation", [t, 0, 0]);
//         if (e.g_right) task("g_translation", [-t, 0, 0]);
//         if (e.g_up) task("g_translation", [0, t, 0]);
//         if (e.g_down) task("g_translation", [0, -t, 0]);
//         if (e.g_fw) task("g_translation", [0, 0, t]);
//         if (e.g_bw) task("g_translation", [0, 0, -t]);
//
//         let a = THREE.MathUtils.degToRad(5);
//         if (e.g_yaw1) task("g_rotation", [a, 0, 0]);
//         if (e.g_yaw2) task("g_rotation", [-a, 0, 0]);
//         if (e.g_pitch1) task("g_rotation", [0, -a, 0]);
//         if (e.g_pitch2) task("g_rotation", [0, a, 0]);
//         if (e.g_roll1) task("g_rotation", [0, 0, -a]);
//         if (e.g_roll2) task("g_rotation", [0, 0, a]);
//
//         if (e.gripper_toggle) robot.gripper_open = !robot.gripper_open;
//
//     });
//     socket.addEventListener("close", (event) => {
//         console.log(event);
//         setTimeout(function() {
//             connect();
//         }, 1000);
//     });
//     socket.addEventListener("close", (event) => {
//         console.log(event);
//         socket.close();
//     });
// }
// connect();
