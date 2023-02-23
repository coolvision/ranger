
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
let pointer_target = new THREE.Mesh();

let world;
let eventQueue;
let boxes = [];

let robot = {};
let parts = [];
let joints = [];

await init();

function addBox(type, world, scene, g, m, width, height, depth, x=0, y=0, z=0, color=0x333333) {

    let body_desc;
    if (type == "position") {
        body_desc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z);
    } else {
        body_desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z);

    }

    // body_desc.setCcdEnabled(true);
    // body_desc.setCanSleep(false);

    let rigid_body = world.createRigidBody(body_desc);

    rigid_body.setAdditionalMass(m);
    rigid_body.setGravityScale(g);

    let collider = RAPIER.ColliderDesc.cuboid(width/2, height/2, depth/2);

    let geometry = new THREE.BoxGeometry(width, height, depth);
    let mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({color: color}));

    scene.add(mesh);

    return {
        r: rigid_body,
        c: collider,
        m: mesh,
        i: mesh.geometry.parameters,
        t: type
    }
}

function fixedJoint(r1, r2, x1=0, y1=0, z1=0, x2=0, y2=0, z2=0) {
    return world.createImpulseJoint(RAPIER.JointData.fixed(
        {x: x1, y: y1, z: z1}, {w: 1.0, x: 0.0, y: 0.0, z: 0.0},
        {x: x2, y: y2, z: z2}, {w: 1.0, x: 0.0, y: 0.0, z: 0.0}), r1, r2, true);
}
function revoluteJoint(r1, r2, axis, x1=0, y1=0, z1=0, x2=0, y2=0, z2=0) {
    return world.createImpulseJoint(RAPIER.JointData.revolute(
        {x: x1, y: y1, z: z1}, {x: x2, y: y2, z: z2}, axis), r1, r2, true);
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

    let ip = new RAPIER.IntegrationParameters();
    ip.erp = 1.0;

    // Create the ground
    let groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 1, 10.0);
    groundColliderDesc.setTranslation(0, -1, 0);
    groundColliderDesc.setFriction(0);
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
    let g3_l = 0.02;
    let g1_l = 0.1;
    let m = 0;

    robot.base = addBox("position", world, scene, 1, 100000, base_w, base_h, base_w, 0, base_h/2, 0);
    world.createCollider(robot.base.c, robot.base.r);
    robot.mast = addBox("dynamic", world, scene, 1, 100000, mast_w, mast_h, mast_w, 0, mast_h/2+base_h, 0);
    robot.arm_base = addBox("dynamic", world, scene, 0, 1, arm_base_w, arm_base_h, arm_base_w);
    robot.shoulder = addBox("dynamic", world, scene, 0, 1, arm_w, arm_w, shoulder_l);
    robot.elbow = addBox("dynamic", world, scene, 0, 1, arm_w, arm_w, elbow_l);
    robot.forearm = addBox("dynamic", world, scene, 0, 1, arm_w, arm_w, forearm_l);
    robot.wrist = addBox("dynamic", world, scene, 0, 1, arm_w, arm_w, wrist_l);
    robot.g1 = addBox("dynamic", world, scene, 0, 1, 0.01, arm_w, g1_l);
    robot.g2 = addBox("dynamic", world, scene, 0, 1, 0.01, arm_w, g1_l);
    robot.g3 = addBox("position", world, scene, 0, 1, 0.12, arm_w, g3_l, 0.5, 0.5, 0.5);
    robot.g3.m.position.set(0.5, 0.5, 0.5);

    robot.base.r.lockRotations(true, true);
    robot.mast.r.lockRotations(true, true);

    parts.push(robot.base, robot.mast, robot.arm_base, robot.shoulder,
        robot.elbow, robot.forearm, robot.wrist, robot.g1, robot.g2, robot.g3);

    let x = {x: 1.0, y: 0.0, z: 0.0};
    let y = {x: 0.0, y: 1.0, z: 0.0};
    let z = {x: 0.0, y: 0.0, z: 1.0};

    let j0 = fixedJoint(robot.base.r, robot.mast.r, 0, base_h/2, 0, 0, -mast_h/2, 0);
    let j1 = revoluteJoint(robot.mast.r, robot.arm_base.r, y);
    let j2 = revoluteJoint(robot.arm_base.r, robot.shoulder.r, x, 0, 0, arm_base_w/2+m, 0, 0, -shoulder_l/2);
    let j3 = revoluteJoint(robot.shoulder.r, robot.elbow.r, x, 0, 0, shoulder_l/2+m, 0, 0, -elbow_l/2);
    let j4 = revoluteJoint(robot.elbow.r, robot.forearm.r, z, 0, 0, elbow_l/2+m, 0, 0, -forearm_l/2);
    let j5 = revoluteJoint(robot.forearm.r, robot.wrist.r, x, 0, 0, forearm_l/2+m, 0, 0, -wrist_l/2);
    let j6 = revoluteJoint(robot.wrist.r, robot.g3.r, z, 0, 0, wrist_l/2, 0, 0, -g3_l/2);
    let j7 = fixedJoint(robot.g3.r, robot.g1.r, 0, 0, g3_l/2, 0.035, 0, -g1_l/2);
    let j8 = fixedJoint(robot.g3.r, robot.g2.r, 0, 0, g3_l/2, -0.035, 0, -g1_l/2);

    joints.push(j1, j2, j3, j4, j5, j6, j7, j8);
    // joints.push(j1);

    for (let j in joints) {
        joints[j].setContactsEnabled(false);
    }
    // for (let i = 0; i < 1000; i++) {
    //     world.step(eventQueue);
    // }

    for (let i in parts) {
        parts[i].r.setAdditionalMass(0);
        // parts[i].r.setGravityScale(1);
        parts[i].r.setAngularDamping(100);

        // if (i >= 2) parts[i].r.setGravityScale(0);

        if (parts[i].r.numColliders() == 0) world.createCollider(parts[i].c, parts[i].r);

        // parts[i].c.setFriction(0);
    }

    console.log("j1", j1, world.timestep);


    robot.base.m.add(pointer_target);

    // scene.add(pointer_target);
    pointer_target.position.set(0.5, 0.5, 0.5);


    transform_ctrl = new TransformControls(camera, renderer.domElement);
    transform_ctrl.addEventListener('change', render);
    transform_ctrl.addEventListener('dragging-changed', function (event) {
        controls.enabled = ! event.value;
    });
    transform_ctrl.size = 0.75

    transform_ctrl.attach(pointer_target);

    scene.add(transform_ctrl);

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
    // if (gripper_open) {
    //     // close
    //     g1.position.set(-0.2, 0, -0.5);
    //     g2.position.set(0.2, 0, -0.5);
    // } else {
    //     // open
    //     g1.position.set(-0.4, 0, -0.5);
    //     g2.position.set(0.4, 0, -0.5);
    // }
    // gripper_open = !gripper_open;
    // console.log("toggleGripper");
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
        if (parts[i].t == "dynamic") {
            parts[i].r.wakeUp();
            let p = parts[i].r.translation();
            let q = parts[i].r.rotation();
            parts[i].m.position.set(p.x, p.y, p.z);
            parts[i].m.quaternion.set(q.x, q.y, q.z, q.w);
        }
    }

    let p = new THREE.Vector3();
    // g1.getWorldPosition(p);
    // g1.body.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
    //
    // g2.getWorldPosition(p);
    // g2.body.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);

    // if (pointer_target.position.distanceTo(robot.arm_base.m.position) < 1.0) {
        pointer_target.getWorldPosition(p);
        robot.g3.m.position.set(p.x, p.y, p.z);
        robot.g3.r.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
    // }

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    render();
}

window.addEventListener( 'keydown', function ( event ) {

    let p = new THREE.Vector3();
    let angle = 0;
    let q = new THREE.Quaternion();
    let update_position = false;
    let update_rotation = false;

    switch ( event.code ) {

        case "KeyG":
            toggleGripper();
            break;
        case "KeyW":
            p.set(0, 0, 0.05);
            update_position = true;
            break;
        case "KeyS":
            p.set(0, 0, -0.05);
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

        p.applyQuaternion(robot.base.m.quaternion);
        // pointer_target.position.add(p);

        p.add(robot.base.m.position);
        robot.base.m.position.set(p.x, p.y, p.z);

        robot.base.m.updateWorldMatrix();

        robot.base.r.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
    }
    if (update_rotation) {
        angle = THREE.MathUtils.degToRad(angle);

        // let pl = pointer_target.position.clone().sub(robot.base.m.position);
        // pl.rotateY(angle);
        // pl.add(robot.base.m.position);
        // pointer_target.position.set(pl.x, pl.y, pl.z);

        robot.base.m.rotateY(angle);
        q = robot.base.m.quaternion;
        robot.base.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
    }
} );
