
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

    let rigid_body = world.createRigidBody(body_desc);

    rigid_body.setAdditionalMass(m);
    rigid_body.setGravityScale(g);
    rigid_body.setAngularDamping(100);

    let collider = RAPIER.ColliderDesc.cuboid(width/2, height/2, depth/2);
    world.createCollider(collider, rigid_body);

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
    let arm_base_w = arm_w*4;
    let arm_base_d = mast_w*Math.sqrt(2);
    let arm_base_h = mast_w*Math.sqrt(2);

    let shoulder_l = 0.4;

    let elbow_l = 0.2;
    let forearm_l = 0.2;
    let wrist_l = 0.1;
    let g3_l = 0.02;
    let g1_l = 0.1;
    let m = 0;

    robot.base = addBox("position", world, scene, 0, 0, base_w, base_h, base_w);
    robot.mast = addBox("dynamic", world, robot.base.m, 0, 0, mast_w, mast_h, mast_w);// 0, mast_h/2+base_h, 0);
    robot.arm_base = addBox("dynamic", world, robot.mast.m, 0, 0, arm_base_w, arm_base_h, arm_base_d);
    robot.shoulder = addBox("dynamic", world, robot.arm_base.m, 0, 0, arm_w, arm_w, shoulder_l);
    robot.elbow = addBox("dynamic", world, robot.shoulder.m, 0, 0, arm_w, arm_w, elbow_l);
    robot.forearm = addBox("dynamic", world, robot.elbow.m, 0, 0, arm_w, arm_w, forearm_l);
    robot.wrist = addBox("dynamic", world, robot.forearm.m, 0, 0, arm_w, arm_w, wrist_l);
    robot.g3 = addBox("position", world, scene, 0, 0, 0.12, arm_w, g3_l, 0.5, 0.5, 0.5);
    robot.g1 = addBox("dynamic", world, robot.g3.m, 0, 0, 0.01, arm_w, g1_l);
    robot.g2 = addBox("dynamic", world, robot.g3.m, 0, 0, 0.01, arm_w, g1_l);
    robot.g3.m.position.set(0.5, 0.5, 0.5);

    parts.push(robot.base, robot.mast, robot.arm_base, robot.shoulder,
        robot.elbow, robot.forearm, robot.wrist, robot.g1, robot.g2, robot.g3);

    let x = {x: 1.0, y: 0.0, z: 0.0};
    let y = {x: 0.0, y: 1.0, z: 0.0};
    let z = {x: 0.0, y: 0.0, z: 1.0};

    let j0 = fixedJoint(robot.base.r, robot.mast.r, 0, base_h/2, 0, 0, -mast_h/2, 0);
    let j1 = revoluteJoint(robot.mast.r, robot.arm_base.r, y, 0, 0, 0, -arm_w*0.75, 0, 0);
    let j2 = revoluteJoint(robot.arm_base.r, robot.shoulder.r, x, arm_base_w/2, 0, 0, -arm_w/2, 0, -shoulder_l/2);
    let j3 = revoluteJoint(robot.shoulder.r, robot.elbow.r, x,  -arm_w/2, 0, shoulder_l/2-arm_w/2,  arm_w/2, 0, -elbow_l/2);
    let j4 = revoluteJoint(robot.elbow.r, robot.forearm.r, z, 0, 0, elbow_l/2, 0, 0, -forearm_l/2);
    let j5 = revoluteJoint(robot.forearm.r, robot.wrist.r, x, arm_w/2, 0, forearm_l/2-arm_w/2, -arm_w/2, 0, -wrist_l/2);
    let j6 = revoluteJoint(robot.wrist.r, robot.g3.r, z, 0, 0, wrist_l/2, 0, 0, -g3_l/2);
    let j7 = fixedJoint(robot.g3.r, robot.g1.r, 0, 0, g3_l/2, 0.035, 0, -g1_l/2);
    let j8 = fixedJoint(robot.g3.r, robot.g2.r, 0, 0, g3_l/2, -0.035, 0, -g1_l/2);

    j1.setContactsEnabled(false);
    robot.base.r.setNextKinematicTranslation({x: 0, y: base_h/2, z: 0}, true);

    // robot.base.m.add(pointer_target);
    // pointer_target.position.set(0.5, 0.5, 0.5);
    //
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

let iter = 0;

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

    // iter++;
    // if (iter < 20) {
    //     console.log("iter", iter, "*************************************************************************************");
    //     console.log("***************************************************************************************************");


        for (let i in parts) {

            // if (i > 3) break;

            parts[i].r.wakeUp();
            let p = parts[i].r.translation();

            // console.log("part", i);

            let v = new THREE.Vector3();
            v.set(p.x, p.y, p.z);
            let vl = v.clone();
            parts[i].m.parent.worldToLocal(vl);
            // console.log("R", v.x.toFixed(3), v.y.toFixed(3), v.z.toFixed(3), "L", vl.x.toFixed(3), vl.y.toFixed(3), vl.z.toFixed(3));

            // let v3 = new THREE.Vector3();
            // parts[i].m.getWorldPosition(v3)
            // console.log("w1", i, v3.x.toFixed(3), v3.y.toFixed(3), v3.z.toFixed(3));

            parts[i].m.position.set(vl.x, vl.y, vl.z);

            let pwq = new THREE.Quaternion();
            parts[i].m.parent.getWorldQuaternion(pwq);
            pwq.invert();

            let rbq = new THREE.Quaternion();
            let q = parts[i].r.rotation();
            rbq.set(q.x, q.y, q.z, q.w);
            rbq.multiply(pwq);

            // let v4 = new THREE.Vector3();
            // parts[i].m.getWorldPosition(v4)
            // console.log("w2", i, v4.x.toFixed(3), v4.y.toFixed(3), v4.z.toFixed(3));

            // parts[i].m.position.set(p.x, p.y, p.z);
            parts[i].m.quaternion.set(rbq.x, rbq.y, rbq.z, rbq.w);


            let pq = new THREE.Quaternion();
            parts[i].m.parent.getWorldQuaternion(pq);

            const m = new THREE.Matrix4();
            m.compose(pq, parts[i].m.parent.position.clone(), new THREE.Vector3(1, 1, 1));

            console.log("m", m);






            // parts[i].m.updateWorldMatrix(true, true)
        }
    // }


    // let p = new THREE.Vector3();
    // let q = new THREE.Quaternion();
    // pointer_target.getWorldPosition(p);
    // pointer_target.getWorldQuaternion(q);
    // robot.g3.r.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
    // robot.g3.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);


    // for (let i in parts) {
    //     parts[i].r.wakeUp();
    //     let p = parts[i].r.translation();
    //     let q = parts[i].r.rotation();
    //     // let pl = parts[i].m.worldToLocal(p);
    //
    //     let v = new THREE.Vector3();
    //     v.set(p.x, p.y, p.z);
    //     let vl = parts[i].m.worldToLocal(v);
    //
    //     console.log("part", i, v, vl);
    //
    //     parts[i].m.position.set(vl.x, vl.y, vl.z);
    //
    //     // parts[i].m.quaternion.set(q.x, q.y, q.z, q.w);
    // }

    // for (let i in parts) {
    //     parts[i].r.wakeUp();
    //     let p = parts[i].r.translation();
    //     let q = parts[i].r.rotation();
    //     let v = new THREE.Vector3();
    //     v.set(p.x, p.y, p.z);
    //     let vl = parts[i].m.worldToLocal(v);
    //     parts[i].m.position.set(vl.x, vl.y, vl.z);
    //     parts[i].m.quaternion.set(q.x, q.y, q.z, q.w);
    // }


    // g1.getWorldPosition(p);
    // g1.body.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
    //
    // g2.getWorldPosition(p);
    // g2.body.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);

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
        p.add(robot.base.m.position);
        // robot.base.m.position.set(p.x, p.y, p.z);
        // robot.base.m.updateWorldMatrix();
        robot.base.r.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
    }

    if (update_rotation) {
        angle = THREE.MathUtils.degToRad(angle);
        robot.base.m.rotateY(angle);
        q = robot.base.m.quaternion;
        robot.base.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
    }

    // if (pointer_target.position.length() < 1.0) {
        // pointer_target.getWorldPosition(p);
        // robot.g3.r.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
        // pointer_target.getWorldQuaternion(q);
        // robot.g3.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
        // for (let i = 0; i < 100; i++) {
        //     world.step(eventQueue);
        // }
    // }

} );
