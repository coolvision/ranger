
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

let r = {};
let parts = [];
let joints = [];
let gripper_v = 10;
let gripper_s = 0.001;
let gripper_f = 100;
let gripper_d = 10;
let gripper_open_1 = -0.05;
let gripper_closed_1 = -0.005;
let gripper_open_2 = 0.05;
let gripper_closed_2 = 0.005;
let r_d = 100;
let gripper_open = true;

let platform, gripper;

let init_position = new THREE.Vector3();
let target_position = new THREE.Vector3();
let init_rotation = new THREE.Quaternion();
let target_rotation = new THREE.Quaternion();

await init();

function getColliderDesc(world, scene, f, width, height, depth, color=0x333333) {

    let collider_desc = RAPIER.ColliderDesc.cuboid(width/2, height/2, depth/2);
    if (f > 0) {
        collider_desc.setFriction(f)
        collider_desc.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max);
    }

    let geometry = new THREE.BoxGeometry(width, height, depth);
    let mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({color: color}));

    scene.add(mesh);

    return {
        cd: collider_desc,
        m: mesh,
        i: mesh.geometry.parameters,
        w: width,
        h: height,
        d: depth
    }
}

function addBody(type, shape, world, scene, g, m, f, d, width, height, depth, x=0, y=0, z=0, color=0x333333) {

    let body_desc;
    if (type == "position") {
        body_desc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z);
    } else {
        body_desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z);
    }

    // body_desc.setCcdEnabled(true);
    body_desc.setCanSleep(false);

    let rigid_body = world.createRigidBody(body_desc);

    rigid_body.setAdditionalMass(m);
    rigid_body.setGravityScale(g);
    rigid_body.setAngularDamping(d);

    let cd = getColliderDesc(world, scene, f, width, height, depth, color);
    let collider = world.createCollider(cd.cd, rigid_body);

    return {
        r: rigid_body,
        c: collider,
        m: cd.m,
        i: cd.m.geometry.parameters,
        t: type,
        w: width,
        h: height,
        d: depth
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
function prismaticJoint(r1, r2, axis, l1, l2, x1=0, y1=0, z1=0, x2=0, y2=0, z2=0) {
    let params = RAPIER.JointData.prismatic(
        {x: x1, y: y1, z: z1}, {x: x2, y: y2, z: z2}, axis)
    params.limitsEnabled = true;
    params.limits = [l1, l2];
    return world.createImpulseJoint(params, r1, r2, true);
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
    // camera.position.set(2.5, 2.5, 2.5);

    camera.position.set(0, 1, 1.2);


    scene.add(camera);

//==============================================================================
    await RAPIER.init();
    let gravity = {x: 0.0, y: -9.81, z: 0.0};
    world = new RAPIER.World(gravity);
    eventQueue = new RAPIER.EventQueue(true);

    // let ip = new RAPIER.IntegrationParameters();
    // ip.erp = 1.0;

    let offset = 0.01;
    platform = world.createCharacterController(offset);
    gripper = world.createCharacterController(offset);

    // Create the ground
    let groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 1, 10.0);
    groundColliderDesc.setTranslation(0, -1, 0);
    // groundColliderDesc.setFriction(0);
    world.createCollider(groundColliderDesc);

    let arm_w = 0.05;
    r.base = addBody("position", "cuboid", world, scene, 0, 0, -1, r_d, 0.4, 0.15, 0.4);
    r.mast = addBody("dynamic", "cuboid", world, r.base.m, 0, 0, -1, r_d, 0.075, 1.5, 0.075);
    r.indicator = addBody("dynamic", "cuboid", world, r.base.m, 0, 0, -1, r_d, 0.02, 0.02, 0.02, 0, 0, 0, 0xff0000);
    r.arm_base = addBody("dynamic", "cuboid", world, r.mast.m, 0, 0, -1, r_d, arm_w*4, r.mast.w*Math.sqrt(2), r.mast.w*Math.sqrt(2));
    r.shoulder = addBody("dynamic", "cuboid", world, r.arm_base.m, 0, 0, -1, r_d, arm_w, arm_w, 0.4);
    r.elbow = addBody("dynamic", "cuboid", world, r.shoulder.m, 0, 0, -1, r_d, arm_w, arm_w, 0.2);
    r.forearm = addBody("dynamic", "cuboid", world, r.elbow.m, 0, 0, -1, r_d, arm_w, arm_w, 0.2);
    r.wrist = addBody("dynamic", "cuboid", world, r.forearm.m, 0, 0, -1, r_d, arm_w, arm_w, 0.1);
    r.g3 = addBody("position", "cuboid", world, scene, 0, 0, -1, r_d, 0.16, arm_w, 0.02, 0.5, 0.5, 0.5);
    r.g3.m.position.set(0.5, 0.5, 0.5);

    // r.g1 = addBody("-", "cuboid", world, r.g3.m, 0, 0.001, gripper_f, 0.02, 0.02, 0.1);
    // r.g2 = addBody("-", "cuboid", world, r.g3.m, 0, 0.001, gripper_f, 0.02, 0.02, 0.1);
    // parts.push(r.base, r.mast, r.indicator, r.arm_base, r.shoulder,
    //     r.elbow, r.forearm, r.wrist, r.g1, r.g2, r.g3);

    // r.g1 = getColliderDesc(world, r.g3.m, gripper_f, 0.01, 0.05, 0.1);
    // r.g2 = getColliderDesc(world, r.g3.m, gripper_f, 0.01, 0.05, 0.1);
    // r.g1.c = world.createCollider(r.g1.cd);
    // r.g2.c = world.createCollider(r.g2.cd);
    // r.g1.m.position.set(-0.05, 0, r.g1.d/2);
    // r.g2.m.position.set(0.05, 0, r.g2.d/2);

    r.g1 = addBody("position", "cuboid", world, r.g3.m, 0, 0, gripper_f, r_d, 0.01, 0.05, 0.1);
    r.g2 = addBody("position", "cuboid", world, r.g3.m, 0, 0, gripper_f, r_d, 0.01, 0.05, 0.1);
    r.g1.m.position.set(gripper_open_1, 0, r.g1.d/2);
    r.g2.m.position.set(gripper_open_2, 0, r.g2.d/2);

    r.g1_pad = addBody("position", "cuboid", world, r.g1.m, 0, 0, gripper_f, r_d, 0.001, 0.05*0.9, 0.1*0.9);
    r.g2_pad = addBody("position", "cuboid", world, r.g2.m, 0, 0, gripper_f, r_d, 0.001, 0.05*0.9, 0.1*0.9);
    r.g1_pad.m.position.set(0.01/2-0.001/2, 0, 0);
    r.g2_pad.m.position.set(-0.01/2+0.001/2, 0, 0);

    r.g1_pad.c.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
    r.g2_pad.c.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
    r.g1_pad.c.touch = "off";
    r.g2_pad.c.touch = "off";

    parts.push(r.base, r.mast, r.indicator, r.arm_base, r.shoulder,
        r.elbow, r.forearm, r.wrist, r.g3);

    let x = {x: 1.0, y: 0.0, z: 0.0};
    let y = {x: 0.0, y: 1.0, z: 0.0};
    let z = {x: 0.0, y: 0.0, z: 1.0};

    let j0 = fixedJoint(r.base.r, r.mast.r, 0, r.base.h/2, 0, 0, -r.mast.h/2, 0);
    let ji = fixedJoint(r.base.r, r.indicator.r, 0, r.base.h/2, r.base.w/2);
    let j1 = revoluteJoint(r.mast.r, r.arm_base.r, y, 0, 0, 0, -arm_w*0.75, 0, 0);
    let j2 = revoluteJoint(r.arm_base.r, r.shoulder.r, x, r.arm_base.w/2, 0, 0, -arm_w/2, 0, -r.shoulder.d/2);
    let j3 = revoluteJoint(r.shoulder.r, r.elbow.r, x,  -arm_w/2, 0, r.shoulder.d/2-arm_w/2,  arm_w/2, 0, -r.elbow.d/2);
    let j4 = revoluteJoint(r.elbow.r, r.forearm.r, z, 0, 0, r.elbow.d/2, 0, 0, -r.forearm.d/2);
    let j5 = revoluteJoint(r.forearm.r, r.wrist.r, x, arm_w/2, 0, r.forearm.d/2-arm_w/2, -arm_w/2, 0, -r.wrist.d/2);
    let j6 = revoluteJoint(r.wrist.r, r.g3.r, z, 0, 0, r.wrist.d/2, 0, 0, -r.g3.d/2);
    // let j7 = prismaticJoint(r.g3.r, r.g1.r, x, -0.05, -0.02, 0, 0, r.g3.d/2, 0, 0, -r.g1.d/2-0.02);
    // let j8 = prismaticJoint(r.g3.r, r.g2.r, x, 0.02, 0.05, 0, 0, r.g3.d/2, 0, 0, -r.g1.d/2-0.02);

    joints.push(j0, j1, j2, j3, j4, j5, j6);
    j1.setContactsEnabled(false);
    ji.setContactsEnabled(false);

    // joints[7].configureMotorModel(1);
    // joints[8].configureMotorModel(1);
    // joints[7].configureMotorVelocity(-gripper_v, gripper_s);
    // joints[8].configureMotorVelocity(gripper_v, gripper_s);

    // joints[7].configureMotorPosition(gripper_open_1, gripper_s, gripper_d);
    // joints[8].configureMotorPosition(gripper_open_2, gripper_s, gripper_d)

    r.base.r.setNextKinematicTranslation({x: 0, y: r.base.h/2, z: 0}, true);
    world.step(eventQueue);
    r.base.r.recomputeMassPropertiesFromColliders();

    r.base.m.add(pointer_target);
    // pointer_target.position.set(0.5, 0.5, 0.5);

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
    for (let i = 0; i < 1; i++) {
        // let p = new THREE.Vector3(Math.random() - 0.5, Math.random() * 2, Math.random() - 0.5 + 1);
        // p.multiplyScalar(1);
        let p = new THREE.Vector3(0, 1, 0.75);
        let c = new THREE.Color();
        c.setHex(0xffffff * Math.random());
        let box = addBody("dynamic", "cuboid", world, scene, 1, 0, -1, 100, size, size, size, p.x, p.y, p.z, c);
        boxes.push(box);
    }

    for (let i = 0; i < 100; i++) {
        world.step(eventQueue);
    }

    pointer_target.position.set(0.15, 0.455, 0.5);
    // r.g3.r.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
    // world.step(eventQueue);


    size = 0.05;
    for (let i = 1; i < 5; i++) {
        for (let j = 1; j < 5; j++) {
            let p = new THREE.Vector3(-0.25 + i/10, 1, -0.25 + j/10);
            // p.multiplyScalar(0.2);
            // p.y = 1;
            p.z += 0.75;
            let c = new THREE.Color();
            c.setHex(0xffffff * Math.random());
            let box = addBody("dynamic", "cuboid", world, scene, 1, 0, -1, 0, size, size, size, p.x, p.y, p.z, c);
            boxes.push(box);
        }
    }

    // size = 0.05;
    // for (let i = 0; i < 50; i++) {
    //     let p = new THREE.Vector3(Math.random() - 0.5, Math.random() * 2, Math.random() - 0.5);
    //     p.multiplyScalar(0.2);
    //     p.y = 1;
    //     p.z += 1;
    //     let c = new THREE.Color();
    //     c.setHex(0xffffff * Math.random());
    //     let box = addBody("dynamic", "cuboid", world, scene, 1, 0, 100, size, size, size, p.x, p.y, p.z, c);
    //     boxes.push(box);
    // }


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

function toggleGripper() {
    if (gripper_open) {
        // close
        // joints[7].configureMotorVelocity(gripper_v, gripper_s);
        // joints[8].configureMotorVelocity(-gripper_v, gripper_s);
    } else {
        // open
        // joints[7].configureMotorVelocity(-gripper_v, gripper_s);
        // joints[8].configureMotorVelocity(gripper_v, gripper_s);
    }
    gripper_open = !gripper_open;
}

let iter = 0;

function render() {

    // console.log("pointer_target", p)

    // let t = {x: p.x, y: p.y, z: p.z};
    // gripper.computeColliderMovement(r.g3.c, t);
    // let p1 = gripper.computedMovement();

    // console.log("computedMovement", t, p1)
    // r.g3.r.setNextKinematicTranslation({x: p1.x, y: p1.y, z: p1.z}, true);


    for (let i = 0; i < boxes.length; i++) {
        let p = boxes[i].r.translation();
        let q = boxes[i].r.rotation();
        boxes[i].m.position.set(p.x, p.y, p.z);
        boxes[i].m.quaternion.set(q.x, q.y, q.z, q.w);
    }

    for (let i in parts) {

        parts[i].r.wakeUp();

        let q = parts[i].r.rotation();
        let q1 = new THREE.Quaternion();
        q1.set(q.x, q.y, q.z, q.w);

        let p = parts[i].r.translation();
        let p1 = new THREE.Vector3();
        p1.set(p.x, p.y, p.z);

        let m_body = new THREE.Matrix4();
        m_body.compose(p1, q1, new THREE.Vector3(1, 1, 1));

        let m_parent = parts[i].m.parent.matrixWorld.clone();
        m_parent.invert();
        m_parent.multiply(m_body);

        parts[i].m.position.set(0, 0, 0);
        parts[i].m.quaternion.set(0, 0, 0, 1);
        parts[i].m.scale.set(1, 1, 1);
        parts[i].m.applyMatrix4(m_parent);

        parts[i].m.updateWorldMatrix(true, true);
    }

    // r.g1.c.v1 = r.g1.m.localToWorld(new THREE.Vector3(0, 0, 0));
    // r.g1.c.v2 = r.g1.m.localToWorld(new THREE.Vector3(-1, 0, 0));
    // r.g1.c.v = r.g1.c.v2.sub(r.g1.c.v1);
    //
    // r.g2.c.v1 = r.g2.m.localToWorld(new THREE.Vector3(0, 0, 0));
    // r.g2.c.v2 = r.g2.m.localToWorld(new THREE.Vector3(1, 0, 0));
    // r.g2.c.v = r.g2.c.v2.sub(r.g2.c.v1);

    // eventQueue.drainCollisionEvents((handle1, handle2, started) => {
    //     console.log("collision", handle1, handle2, started);
    // });

    r.g1_pad.c.touch = "off";
    r.g2_pad.c.touch = "off";
    let startTime = performance.now()
    eventQueue.drainContactForceEvents(event => {
        let d = event.maxForceDirection();
        let dv = new THREE.Vector3(d.x, d.y, d.z);
        let c1 = world.getCollider(event.collider1());
        let c2 = world.getCollider(event.collider2());
        c1.touch = "on";
        c2.touch = "on";
        let endTime = performance.now()
        // console.log("time", (endTime - startTime), r.g1_pad.c.touch, r.g2_pad.c.touch);
    });

    // console.log("touch", r.g1_pad.c.touch, r.g2_pad.c.touch)

    let gp1 = r.g1.m.position.clone();
    let gp2 = r.g2.m.position.clone();

    if (gripper_open) {
        if (gp1.x > gripper_open_1) {
            r.g1.m.position.set(gp1.x-gripper_s, gp1.y, gp1.z);
        }
        if (gp2.x < gripper_open_2) {
            r.g2.m.position.set(gp2.x+gripper_s, gp2.y, gp2.z);
        }
    } else {
        // console.log("position", gp1, gp2, r.g1_pad.c.touch, r.g2_pad.c.touch)
        if (gp1.x < gripper_closed_1 && r.g1_pad.c.touch == "off") {
            r.g1.m.position.set(gp1.x+gripper_s, gp1.y, gp1.z);
        }
        if (gp2.x > gripper_closed_2 && r.g2_pad.c.touch == "off") {
            r.g2.m.position.set(gp2.x-gripper_s, gp2.y, gp2.z);
        }
    }

    let p = new THREE.Vector3();
    let q = new THREE.Quaternion();
    pointer_target.getWorldPosition(p);
    pointer_target.getWorldQuaternion(q);

    r.g3.r.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
    world.step(eventQueue);
    r.g3.r.recomputeMassPropertiesFromColliders();
    r.g3.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);

    r.g1.m.updateWorldMatrix(true, true);
    r.g1_pad.m.updateWorldMatrix(true, true);

    r.g2.m.updateWorldMatrix(true, true);
    r.g2_pad.m.updateWorldMatrix(true, true);

    // let g0 = new THREE.Vector3(0, 0, 0);
    // let gy1 = new THREE.Vector3(0, -1, 0);
    // let gy2 = new THREE.Vector3(0, 1, 0);

    // console.log("r.g1.c.v", r.g1.c.v, r.g2.c.v )
    r.g1.m.getWorldPosition(p);
    r.g1.m.getWorldQuaternion(q);
    r.g1.r.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
    r.g1.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
    r.g1.r.recomputeMassPropertiesFromColliders();

    r.g1_pad.m.getWorldPosition(p);
    r.g1_pad.m.getWorldQuaternion(q);
    r.g1_pad.r.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
    r.g1_pad.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
    r.g1_pad.r.recomputeMassPropertiesFromColliders();

    r.g2.m.getWorldPosition(p);
    r.g2.m.getWorldQuaternion(q);
    r.g2.r.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
    r.g2.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
    r.g2.r.recomputeMassPropertiesFromColliders();

    r.g2_pad.m.getWorldPosition(p);
    r.g2_pad.m.getWorldQuaternion(q);
    r.g2_pad.r.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
    r.g2_pad.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
    r.g2_pad.r.recomputeMassPropertiesFromColliders();

    let R = r.base.r.rotation();
    q.set(R.x, R.y, R.z, R.w);
    q.rotateTowards(target_rotation, THREE.MathUtils.degToRad(1));
    r.base.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);

    // console.log("target", q, target_rotation);

    // for (let i = 0; i < 10; i++) {
    //     world.step(eventQueue);
    // }

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    render();
}

window.addEventListener('keydown', function(event) {

    let p = new THREE.Vector3();
    let angle = 0;
    // let q = new THREE.Quaternion();
    let update_position = false;
    let update_rotation = false;

    let gp1 = r.g1.m.position.clone();
    let gp2 = r.g2.m.position.clone();

    switch ( event.code ) {
        case "KeyO":
            if (gp1.x > gripper_open_1) {
                r.g1.m.position.set(gp1.x-gripper_s, gp1.y, gp1.z);
            }
            if (gp2.x < gripper_open_2) {
                r.g2.m.position.set(gp2.x+gripper_s, gp2.y, gp2.z);
            }
            break;
        case "KeyP":
            if (gp1.x < gripper_closed_1 && r.g1_pad.c.touch == "off") {
                r.g1.m.position.set(gp1.x+gripper_s, gp1.y, gp1.z);
            }
            if (gp2.x > gripper_closed_2 && r.g2_pad.c.touch == "off") {
                r.g2.m.position.set(gp2.x-gripper_s, gp2.y, gp2.z);
            }
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
            angle = 1;
            update_rotation = true;
            break;
        case "KeyD":
            angle = -1;
            update_rotation = true;
            break;
    }

    if (update_position) {

        let T = r.base.r.translation();
        let p1 = new THREE.Vector3();
        p1.set(T.x, T.y, T.z);
        init_position = p1;

        // let p = new THREE.Vector3();
        p.applyQuaternion(r.base.m.quaternion);
        p.add(r.base.m.position);
        target_position = p;

        r.base.r.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
        world.step(eventQueue);
        r.base.r.recomputeMassPropertiesFromColliders();
    }

    if (update_rotation) {

        // let R = r.base.r.rotation();
        // let q1 = new THREE.Quaternion();
        // q1.set(R.x, R.y, R.z, R.w);
        // init_rotation = q1;

        angle = THREE.MathUtils.degToRad(angle);
        let q = new THREE.Quaternion();
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        q.multiply(r.base.m.quaternion);
        target_rotation = q;

        // console.log("set target", target_rotation)

        // r.base.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
    }

});
