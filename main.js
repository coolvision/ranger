
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
let gripper_s = 10;
let gripper_f = 100;
let gripper_d = 10;
let gripper_open_1 = -0.05;
let gripper_closed_1 = -0.01;
let gripper_open_2 = 0.05;
let gripper_closed_2 = 0.01;

let platform, gripper;

await init();

function addBody(type, shape, world, scene, g, m, f, width, height, depth, x=0, y=0, z=0, color=0x333333) {

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
    rigid_body.setAngularDamping(100);
    // rigid_body.setDominanceGroup(0);

    let collider_desc;
    if (shape == 'cylinder') {
        collider_desc = RAPIER.ColliderDesc.cylinder(depth/2, width/2);
    } else {
        collider_desc = RAPIER.ColliderDesc.cuboid(width/2, height/2, depth/2);
    }

    if (f > 0) {
        collider_desc.setFriction(f)
        collider_desc.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max);
    }

    let collider = world.createCollider(collider_desc, rigid_body);
    if (shape == 'cylinder') {
        let q = new THREE.Quaternion();
        q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI/2);
        collider.setRotationWrtParent({w: q.w, x: q.x, y: q.y, z: q.z});
    }


    // collider_desc.setDensity(1);
    console.log("mass", type, collider.mass(), collider.density());



    let geometry = new THREE.BoxGeometry(width, height, depth);
    let mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({color: color}));

    scene.add(mesh);

    return {
        r: rigid_body,
        c: collider,
        m: mesh,
        i: mesh.geometry.parameters,
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
    r.base = addBody("position", "cuboid", world, scene, 0, 0, -1, 0.4, 0.15, 0.4);
    r.mast = addBody("dynamic", "cuboid", world, r.base.m, 0, 0, -1, 0.075, 1.5, 0.075);
    r.indicator = addBody("dynamic", "cuboid", world, r.base.m, 0, 0, -1, 0.02, 0.02, 0.02, 0, 0, 0, 0xff0000);
    r.arm_base = addBody("dynamic", "cuboid", world, r.mast.m, 0, 0, -1, arm_w*4, r.mast.w*Math.sqrt(2), r.mast.w*Math.sqrt(2));
    r.shoulder = addBody("dynamic", "cuboid", world, r.arm_base.m, 0, 0, -1, arm_w, arm_w, 0.4);
    r.elbow = addBody("dynamic", "cuboid", world, r.shoulder.m, 0, 0, -1, arm_w, arm_w, 0.2);
    r.forearm = addBody("dynamic", "cuboid", world, r.elbow.m, 0, 0, -1, arm_w, arm_w, 0.2);
    r.wrist = addBody("dynamic", "cuboid", world, r.forearm.m, 0, 0, -1, arm_w, arm_w, 0.1);
    r.g3 = addBody("position", "cuboid", world, r.wrist.m, 0, 0, -1, 0.16, arm_w, 0.02, 0.5, 0.5, 0.5);
    r.g1 = addBody("dynamic", "cuboid", world, r.g3.m, 0, 0.001, gripper_f, 0.02, 0.02, 0.1);
    r.g2 = addBody("dynamic", "cuboid", world, r.g3.m, 0, 0.001, gripper_f, 0.02, 0.02, 0.1);
    r.g3.m.position.set(0.5, 0.5, 0.5);

    // r.g1.r.setLinearDamping(100);
    // r.g2.r.setLinearDamping(100);


    r.g1.cd2 = RAPIER.ColliderDesc.cuboid(0.01, r.g1.h/8, r.g1.d/8)
        .setTranslation(r.g1.w/2, 0.0, 0.0)
        .setSensor(true)
        // .setDensity(100)
        .setMass(0.005)
    // r.g1.cd2.setFriction(gripper_f)
    // r.g1.cd2.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max);
    // r.g1.c2 = world.createCollider(r.g1.cd2, r.g1.r);

    r.g2.cd2 = RAPIER.ColliderDesc.cuboid(0.01, r.g2.h/8, r.g2.d/8)
        .setTranslation(-r.g2.w/2, 0.0, 0.0)
        .setSensor(true)
        // .setDensity(100)
        .setMass(0.005)

        // .setMass(0.01)
    // r.g2.cd2.setFriction(gripper_f)
    // r.g2.cd2.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max);
    // r.g2.c2 = world.createCollider(r.g2.cd2, r.g2.r);

    // console.log("g1 c2 mass", r.g1.c2.mass(), r.g1.c2.density());
    // console.log("g2 c2 mass", r.g2.c2.mass(), r.g2.c2.density());


    // r.g1.r.setAngularDamping(1000);
    // r.g2.r.setAngularDamping(1000);
    // r.g1.c.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    // r.g2.c.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    // r.g1.c2.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    // r.g2.c2.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);


    parts.push(r.base, r.mast, r.indicator, r.arm_base, r.shoulder,
        r.elbow, r.forearm, r.wrist, r.g1, r.g2, r.g3);

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
    let j7 = prismaticJoint(r.g3.r, r.g1.r, x, -0.05, -0.02, 0, 0, r.g3.d/2, 0, 0, -r.g1.d/2-0.02);
    let j8 = prismaticJoint(r.g3.r, r.g2.r, x, 0.02, 0.05, 0, 0, r.g3.d/2, 0, 0, -r.g1.d/2-0.02);

    joints.push(j0, j1, j2, j3, j4, j5, j6, j7, j8);
    j1.setContactsEnabled(false);
    ji.setContactsEnabled(false);

    // joints[7].configureMotorModel(1);
    // joints[8].configureMotorModel(1);
    joints[7].configureMotorVelocity(-gripper_v, gripper_s);
    joints[8].configureMotorVelocity(gripper_v, gripper_s);

    // joints[7].configureMotorPosition(gripper_open_1, gripper_s, gripper_d);
    // joints[8].configureMotorPosition(gripper_open_2, gripper_s, gripper_d)

    r.base.r.setNextKinematicTranslation({x: 0, y: r.base.h/2, z: 0}, true);
    world.step(eventQueue);
    r.base.r.recomputeMassPropertiesFromColliders();

    r.base.m.add(pointer_target);
    pointer_target.position.set(0.5, 0.5, 0.5);

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
        let box = addBody("dynamic", "cuboid", world, scene, 1, 0, -1, size, size, size, p.x, p.y, p.z, c);
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
            let box = addBody("dynamic", "cuboid", world, scene, 1, 0, -1, size, size, size, p.x, p.y, p.z, c);
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

let gripper_open = true;
function toggleGripper() {
    if (gripper_open) {
        // close
        joints[7].configureMotorVelocity(gripper_v, gripper_s);
        joints[8].configureMotorVelocity(-gripper_v, gripper_s);
    } else {
        // open
        joints[7].configureMotorVelocity(-gripper_v, gripper_s);
        joints[8].configureMotorVelocity(gripper_v, gripper_s);
    }
    gripper_open = !gripper_open;
}

let iter = 0;

function render() {

    // world.step(eventQueue);
    eventQueue.drainCollisionEvents((handle1, handle2, started) => {
        console.log("collision", handle1, handle2, started);
    });


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

    let p = new THREE.Vector3();
    let q = new THREE.Quaternion();
    pointer_target.getWorldPosition(p);
    pointer_target.getWorldQuaternion(q);

    // console.log("pointer_target", p)


    let t = {x: p.x, y: p.y, z: p.z};
    gripper.computeColliderMovement(r.g3.c, t);
    let p1 = gripper.computedMovement();

    // console.log("computedMovement", t, p1)
    // r.g3.r.setNextKinematicTranslation({x: p1.x, y: p1.y, z: p1.z}, true);
    r.g3.r.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
    world.step(eventQueue);
    r.g3.r.recomputeMassPropertiesFromColliders();
    r.g3.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);

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
    let q = new THREE.Quaternion();
    let update_position = false;
    let update_rotation = false;

    switch ( event.code ) {

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
            angle = 5;
            update_rotation = true;
            break;
        case "KeyD":
            angle = -5;
            update_rotation = true;
            break;
    }

    if (update_position) {
        p.applyQuaternion(r.base.m.quaternion);
        p.add(r.base.m.position);
        r.base.r.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
        world.step(eventQueue);
        r.base.r.recomputeMassPropertiesFromColliders();
    }

    if (update_rotation) {
        angle = THREE.MathUtils.degToRad(angle);
        let q = new THREE.Quaternion();
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        q.multiply(r.base.m.quaternion);
        r.base.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
    }

    // for (let i = 0; i < 10; i++) {
    //     world.step(eventQueue);
    // }
});
