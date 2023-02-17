
import * as THREE from 'three';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';

let container;
let camera, scene, renderer;
const splineHelperObjects = [];
let splinePointsLength = 4;
const positions = [];
const point = new THREE.Vector3();

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const onUpPosition = new THREE.Vector2();
const onDownPosition = new THREE.Vector2();

const geometry = new THREE.BoxGeometry( 20, 20, 20 );
let transform_ctrl;

let world;
let eventQueue;
let boxes = [];

// let gripper;
// let g1, g2, g3;

let arm = {};
let parts = [];

// const matrix = new THREE.Matrix4();
// const color = new THREE.Color();

await init();

function addBox(world, width, height, depth, color) {

    let rigid_body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
    let collider = RAPIER.ColliderDesc.cuboid(width/2, height/2, depth/2);
    world.createCollider(collider, rigid_body);

    let geometry = new THREE.BoxGeometry(width, height, depth);
    let mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({color: color}));

    return {
        r: rigid_body,
        m: mesh
    }
}

async function init() {

    container = document.getElementById( 'app' );

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 5, 5);
    scene.add(camera);

//==============================================================================
    await RAPIER.init();
    let gravity = {x: 0.0, y: -9.81, z: 0.0};
    world = new RAPIER.World(gravity);
    eventQueue = new RAPIER.EventQueue(true);


    arm.shoulder = addBox(world, 0.3, 0.3, 5, 0x333333);
    scene.add(arm.shoulder.m)

    arm.forearm = addBox(world, 0.4, 0.4, 5, 0x333333);
    scene.add(arm.forearm.m)

    let params = RAPIER.JointData.revolute(
        {x: 0.0, y: 0.0, z: 2.75},
        {x: 0.0, y: 0.0, z: -2.75},
        {x: 1.0, y: 0.0, z: 0.0});
    let joint = world.createImpulseJoint(params, arm.shoulder.r, arm.forearm.r, true);

    parts.push(arm.shoulder, arm.forearm);


    // let x = { x: 1.0, y: 0.0, z: 0.0 };
    // let z = { x: 0.0, y: 0.0, z: 1.0 };

    // joint.configureMotorVelocity(5.0, 5);

    // console.log("joint", joint)

    // (joint as RAPIER.RevoluteImpulseJoint).configureMotorVelocity(1.0, 0.5);


    // let shoulder = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
    // let shoulder_collider = RAPIER.ColliderDesc.cuboid(0.4, 0.4, 5);
    // world.createCollider(shoulder_collider, shoulder);
    //
    // let gripperGeometry = new THREE.BoxGeometry();
    // let material = new THREE.MeshLambertMaterial();
    // material.color.setHex(0x333333);
    // g1 = new THREE.Mesh(gripperGeometry1, material);
    // // g1.position.set(-0.3, 0, -0.5);
    //
    //
    //
    //
    //
    // let forearm = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
    // let forearm_collider = RAPIER.ColliderDesc.cuboid(0.4, 0.4, 5);
    // world.createCollider(forearm_collider, forearm);
    //
    // let wrist = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
    // let wrist_collider = RAPIER.ColliderDesc.cuboid(0.4, 0.4, 1.5);
    // world.createCollider(wrist_collider, wrist);
    //
    // let g1_desc = RAPIER.RigidBodyDesc.kinematicPositionBased()
    // let g1_body = world.createRigidBody(g1_desc);
    // let g1_collider = RAPIER.ColliderDesc.cuboid(0.1, 0.5, 1);
    // world.createCollider(g1_collider, g1_body);
    //
    // let g2_desc = RAPIER.RigidBodyDesc.kinematicPositionBased()
    // let g2_body = world.createRigidBody(g2_desc);
    // let g2_collider = RAPIER.ColliderDesc.cuboid(0.1, 0.5, 1);
    // world.createCollider(g2_collider, g2_body);
    //
    // let g3_desc = RAPIER.RigidBodyDesc.kinematicPositionBased()
    // let g3_body = world.createRigidBody(g3_desc);
    // let g3_collider = RAPIER.ColliderDesc.cuboid(1.2, 0.5, 0.1);
    // world.createCollider(g3_collider, g3_body);
    //
    //
    //
    //
    //
    // let gripperGeometry1 = new THREE.BoxGeometry();
    // let material = new THREE.MeshLambertMaterial();
    // material.color.setHex(0x333333);
    // g1 = new THREE.Mesh(gripperGeometry1, material);
    // g1.position.set(-0.3, 0, -0.5);
    //
    // g2 = new THREE.Mesh(gripperGeometry1, material);
    // g2.position.set(0.3, 0, -0.5);
    //
    // let gripperGeometry2 = new THREE.BoxGeometry(1.2, 0.5, 0.1);
    // g3 = new THREE.Mesh(gripperGeometry2, material);
    //
    //
    //



    // Create the ground
    let groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 1, 10.0)
        .setTranslation(0, -1, 0)
    world.createCollider(groundColliderDesc);

    let size = 0.5
    const geometryBox = new THREE.BoxGeometry(size, size, size);
    for (let i = 0; i < 5; i++) {
        let material = new THREE.MeshLambertMaterial();
        let box = new THREE.Mesh(geometryBox, material);

        box.position.set(Math.random() - 0.5, Math.random() * 2, Math.random() - 0.5);
        box.position.multiplyScalar(5);
        box.material.color.setHex(0xffffff * Math.random());

        let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(box.position.x, box.position.y, box.position.z)
                // .setCcdEnabled(true);
        let rigidBody = world.createRigidBody(rigidBodyDesc);
        let colliderDesc = RAPIER.ColliderDesc.cuboid(size/2, size/2, size/2);
        let collider = world.createCollider(colliderDesc, rigidBody);

        box.rigidBody = rigidBody;

        scene.add(box);
        boxes.push(box);
    }


    // let gripperGeometry1 = new THREE.BoxGeometry(0.1, 0.5, 1);
    // let material = new THREE.MeshLambertMaterial();
    // material.color.setHex(0x333333);
    // g1 = new THREE.Mesh(gripperGeometry1, material);
    // g1.position.set(-0.3, 0, -0.5);
    //
    // g2 = new THREE.Mesh(gripperGeometry1, material);
    // g2.position.set(0.3, 0, -0.5);
    //
    // let gripperGeometry2 = new THREE.BoxGeometry(1.2, 0.5, 0.1);
    // g3 = new THREE.Mesh(gripperGeometry2, material);
    //
    // gripper = new THREE.Group();
    // gripper.position.set(0, 2, 0);
    // gripper.add(g1);
    // gripper.add(g2);
    // gripper.add(g3);
    // scene.add(gripper);
    //
    // g1.body = g1_body;
    // g2.body = g2_body;
    // g3.body = g3_body;

    // transform_ctrl = new TransformControls(camera, renderer.domElement);
    // transform_ctrl.addEventListener('change', render);
    // transform_ctrl.addEventListener('dragging-changed', function (event) {
    //     controls.enabled = ! event.value;
    // });
    // transform_ctrl.size = 0.75
    // transform_ctrl.attach(gripper);
    // scene.add(transform_ctrl);

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
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.damping = 0.2;
    controls.addEventListener('change', render);

    renderer.setAnimationLoop(render);
}

let gripper_open = true;
function toggleGripper() {
    if (gripper_open) {
        // close
        g1.position.set(-0.2, 0, -0.5);
        g2.position.set(0.2, 0, -0.5);
    } else {
        // open
        g1.position.set(-0.4, 0, -0.5);
        g2.position.set(0.4, 0, -0.5);
    }
    gripper_open = !gripper_open;
    console.log("toggleGripper");
}

function render() {

    world.step(eventQueue);

    eventQueue.drainCollisionEvents((handle1, handle2, started) => {
        console.log("collision", handle1, handle2, started, g1.body, g2.body);
    });

    for (let i = 0; i < boxes.length; i++) {
        let p = boxes[i].rigidBody.translation();
        let q = boxes[i].rigidBody.rotation();

        boxes[i].position.set(p.x, p.y, p.z);
        boxes[i].quaternion.set(q.x, q.y, q.z, q.w);
    }

    for (let i in parts) {
        let p = parts[i].r.translation();
        let q = parts[i].r.rotation();
        parts[i].m.position.set(p.x, p.y, p.z);
        parts[i].m.quaternion.set(q.x, q.y, q.z, q.w);
    }

    // let p = new THREE.Vector3();
    // g1.getWorldPosition(p);
    // g1.body.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
    //
    // g2.getWorldPosition(p);
    // g2.body.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
    //
    // g3.getWorldPosition(p);
    // g3.body.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    render();
}

window.addEventListener( 'keydown', function ( event ) {



    switch ( event.code ) {
        case "KeyG":
            toggleGripper();
            break;
        // case "Digit1":
        //     openGripper();
        //     break;
    }

    switch ( event.keyCode ) {

        case 81: // Q
            transform_ctrl.setSpace( transform_ctrl.space === 'local' ? 'world' : 'local' );
            break;


        case 81: // Q
            transform_ctrl.setSpace( transform_ctrl.space === 'local' ? 'world' : 'local' );
            break;

        case 16: // Shift
            transform_ctrl.setTranslationSnap( 100 );
            transform_ctrl.setRotationSnap( THREE.MathUtils.degToRad( 15 ) );
            transform_ctrl.setScaleSnap( 0.25 );
            break;

        case 87: // W
            transform_ctrl.setMode( 'translate' );
            break;

        case 69: // E
            transform_ctrl.setMode( 'rotate' );
            break;

        case 187:
        case 107: // +, =, num+
            transform_ctrl.setSize( transform_ctrl.size + 0.1 );
            break;

        case 189:
        case 109: // -, _, num-
            transform_ctrl.setSize( Math.max( transform_ctrl.size - 0.1, 0.1 ) );
            break;
    }
} );
