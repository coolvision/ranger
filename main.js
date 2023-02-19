
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

let robot = {};
let parts = [];

// const matrix = new THREE.Matrix4();
// const color = new THREE.Color();

await init();

function addBox(world, scene, width, height, depth, x=0, y=0, z=0, color=0x333333) {

RAPIER.RigidBodyDesc.dynamic()

    let body_desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z);
    let rigid_body = world.createRigidBody(body_desc);

    let collider = RAPIER.ColliderDesc.cuboid(width/2, height/2, depth/2);
    world.createCollider(collider, rigid_body);

    let geometry = new THREE.BoxGeometry(width, height, depth);
    let mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({color: color}));

    scene.add(mesh);

    return {
        r: rigid_body,
        m: mesh,
        i: mesh.geometry.parameters
    }
}

function fixedJoint(r1, r2, x1=0, y1=0, z1=0, x2=0, y2=0, z2=0) {
    return world.createImpulseJoint(RAPIER.JointData.fixed(
        {x: x1, y: y1, z: z1}, {w: 1.0, x: 0.0, y: 0.0, z: 0.0},
        {x: x2, y: y2, z: z2}, {w: 1.0, x: 0.0, y: 0.0, z: 0.0}), r1, r2, true);
}
function sphericalJoint(r1, r2, x1, y1, z1, x2=0, y2=0, z2=0) {
    return world.createImpulseJoint(RAPIER.JointData.spherical(
        {x: x1, y: y1, z: z1}, {x: x2, y: y2, z: z2}), r1, r2, true);
}

async function init() {

    container = document.getElementById('app');

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(2.5, 2.5, 2.5);
    scene.add(camera);

//==============================================================================
    await RAPIER.init();
    let gravity = {x: 0.0, y: -9.81, z: 0.0};
    world = new RAPIER.World(gravity);
    eventQueue = new RAPIER.EventQueue(true);

    // Create the ground
    let groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 1, 10.0)
        .setTranslation(0, -1, 0)
    world.createCollider(groundColliderDesc);

    let base_w = 0.4;
    let base_h = 0.15;
    let mast_w = 0.075;
    let mast_h = 1.5;
    let arm_w = 0.05;
    let arm_base_w = arm_w*2;
    let arm_base_h = arm_w*3;
    let shoulder_l = 0.4;
    let elbow_l = 0.1;
    let forearm_l = 0.4;
    let wrist_l = 0.1;

    robot.base = addBox(world, scene, base_w, base_h, base_w, 0, base_h/2, 0);
    robot.mast = addBox(world, scene, mast_w, mast_h, mast_w, 0, mast_h/2+base_h, 0);

    robot.arm_base = addBox(world, scene, arm_base_w, arm_base_h, arm_base_w);

    robot.shoulder = addBox(world, scene, arm_w, arm_w, shoulder_l);

    robot.elbow = addBox(world, scene, arm_w, arm_w, elbow_l);

    robot.forearm = addBox(world, scene, arm_w, arm_w, forearm_l);

    robot.wrist = addBox(world, scene, arm_w, arm_w, wrist_l);

    robot.g1 = addBox(world, scene, 0.01, arm_w, 0.1);
    robot.g2 = addBox(world, scene, 0.01, arm_w, 0.1);
    robot.g3 = addBox(world, scene, 0.12, arm_w, 0.02);

    parts.push(robot.base, robot.mast, robot.arm_base);
    parts.push(robot.shoulder, robot.elbow, robot.forearm);
    parts.push(robot.wrist, robot.g1, robot.g2, robot.g3);

    robot.base.r.setAdditionalMass(100000);
    robot.mast.r.setAdditionalMass(100000);
    robot.arm_base.r.setAdditionalMass(1000);
    robot.shoulder.r.setAdditionalMass(1000);
    robot.elbow.r.setAdditionalMass(100);
    robot.forearm.r.setAdditionalMass(100);
    robot.wrist.r.setAdditionalMass(100);
    robot.g3.r.setAdditionalMass(1);

    let j0 = fixedJoint(robot.base.r, robot.mast.r, 0, base_h/2, 0, 0, -mast_h/2, 0);
    let j1 = fixedJoint(robot.mast.r, robot.arm_base.r).setContactsEnabled(false);

    let j2 = fixedJoint(robot.arm_base.r, robot.shoulder.r,
        0, 0, arm_base_w/2+0.01, 0, 0, -shoulder_l/2).setContactsEnabled(false);

    let j3 = fixedJoint(robot.shoulder.r, robot.elbow.r,
        0, 0, shoulder_l/2+0.01, 0, 0, -elbow_l/2).setContactsEnabled(false);

    // let j4 = fixedJoint(robot.elbow.r, robot.forearm.r,
    //     0, 0, elbow_l, 0, 0, -forearm_l).setContactsEnabled(false);


    // let j4 = fixedJoint(robot.elbow.r, robot.forearm.r, 0, 0, 0.21, 0, 0, -0.2).setContactsEnabled(false);
    //
    // let j5 = fixedJoint(robot.forearm.r, robot.wrist.r, 0, 0, 0.21, 0, 0, -0.05).setContactsEnabled(false);
    //
    // let j6 = fixedJoint(robot.wrist.r, robot.g3.r,
    //     0, 0, robot.wrist.i.depth/2, 0, 0, -robot.g3.i.depth/2).setContactsEnabled(false);
    // let j7 = fixedJoint(robot.g3.r, robot.g1.r,
    //     0, 0, robot.g3.i.depth/2, 0.035, 0, -robot.g1.i.depth/2).setContactsEnabled(false);
    // let j8 = fixedJoint(robot.g3.r, robot.g2.r,
    //     0, 0, robot.g3.i.depth/2, -0.035, 0, -robot.g2.i.depth/2).setContactsEnabled(false);

    // for (let i = 0; i < 1000; i++) {
    //     world.step(eventQueue);
    // }
    // for (let i in parts) {
    //     parts[i].r.setAdditionalMass(0);
    // }




    let x = {x: 1.0, y: 0.0, z: 0.0};
    let y = {x: 0.0, y: 1.0, z: 0.0};
    let z = {x: 0.0, y: 0.0, z: 1.0};

    // let j1 = world.createImpulseJoint(RAPIER.JointData.revolute(
    //     {x: 0.0, y: 0, z: 0}, {x: 0.0, y: 0.0, z: -0.3}, x),
    //     robot.mast.r, robot.shoulder.r, true);
    //
    // let j2 = world.createImpulseJoint(RAPIER.JointData.revolute(
    //     {x: 0.0, y: 0, z: 0.25}, {x: 0.0, y: 0.0, z: -0.25}, x),
    //     robot.shoulder.r, robot.forearm.r, true);
    //
    // let j3 = world.createImpulseJoint(RAPIER.JointData.revolute(
    //     {x: 0.0, y: 0, z: 0.25}, {x: 0.0, y: 0.0, z: -0.1}, x),
    //     robot.forearm.r, robot.wrist.r, true);







    // let x = { x: 1.0, y: 0.0, z: 0.0 };
    // let z = { x: 0.0, y: 0.0, z: 1.0 };

    // joint.configureMotorVelocity(5.0, 5);

    console.log(robot.base, robot.mast)

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





    let size = 0.5
    // const geometryBox = new THREE.BoxGeometry(size, size, size);
    // for (let i = 0; i < 5; i++) {
    //     let material = new THREE.MeshLambertMaterial();
    //     let box = new THREE.Mesh(geometryBox, material);
    //
    //     box.position.set(Math.random() - 0.5, Math.random() * 2, Math.random() - 0.5);
    //     box.position.multiplyScalar(5);
    //     box.material.color.setHex(0xffffff * Math.random());
    //
    //     let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    //             .setTranslation(box.position.x, box.position.y, box.position.z)
    //             // .setCcdEnabled(true);
    //     let rigidBody = world.createRigidBody(rigidBodyDesc);
    //     let colliderDesc = RAPIER.ColliderDesc.cuboid(size/2, size/2, size/2);
    //     let collider = world.createCollider(colliderDesc, rigidBody);
    //
    //     box.rigidBody = rigidBody;
    //
    //     scene.add(box);
    //     boxes.push(box);
    // }


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

    // eventQueue.drainCollisionEvents((handle1, handle2, started) => {
    //     console.log("collision", handle1, handle2, started, g1.body, g2.body);
    // });

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
            // transform_ctrl.setTranslationSnap( 100 );
            // transform_ctrl.setRotationSnap( THREE.MathUtils.degToRad( 15 ) );
            // transform_ctrl.setScaleSnap( 0.25 );
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
