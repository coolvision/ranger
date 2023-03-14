
import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
// import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import RAPIER from './rapier3d-compat';

let container;
let camera, scene, renderer;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const onUpPosition = new THREE.Vector2();
const onDownPosition = new THREE.Vector2();

const geometry = new THREE.BoxGeometry( 20, 20, 20 );
let transform_ctrl;
let pointer_target = new THREE.Mesh();

let world;
let gc;
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
let stop_arm_motion = false;
let lgt = new THREE.Vector3();
let curr_gt = new THREE.Vector3();
let target_direction = new THREE.Vector3();
let target_rotation = new THREE.Quaternion();


let print_frames_i = 0;
let frame_i = 0;

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
    let j = world.createImpulseJoint(RAPIER.JointData.fixed(
            {x: x1, y: y1, z: z1}, {w: 1.0, x: 0.0, y: 0.0, z: 0.0},
            {x: x2, y: y2, z: z2}, {w: 1.0, x: 0.0, y: 0.0, z: 0.0}), r1.r, r2.r, true);
    j.r1 = r1;
    j.r2 = r2;
    return j;
}
function revoluteJoint(r1, r2, axis, x1=0, y1=0, z1=0, x2=0, y2=0, z2=0) {
    let j = world.createImpulseJoint(RAPIER.JointData.revolute(
        {x: x1, y: y1, z: z1}, {x: x2, y: y2, z: z2}, axis), r1.r, r2.r, true);
    j.r1 = r1;
    j.r2 = r2;
    return j;
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

    camera.position.set(0, 1, 1.2);

    scene.add(camera);

//==============================================================================
    await RAPIER.init();
    let gravity = {x: 0.0, y: -9.81, z: 0.0};
    world = new RAPIER.World(gravity);
    eventQueue = new RAPIER.EventQueue(true);

    let ip = world.integrationParameters;
    ip.erp = 1.0;
    ip.maxStabilizationIterations = 10;





    let offset = 0;
    platform = world.createCharacterController(0.01);
    gripper = world.createCharacterController(0.01);

    let groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 1, 10.0);
    groundColliderDesc.setTranslation(0, -1, 0);
    gc = world.createCollider(groundColliderDesc);
    gc.ignore_controller = true;

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

    r.g1 = addBody("position", "cuboid", world, r.g3.m, 0, 0, gripper_f, r_d, 0.01, 0.05, 0.1);
    r.g2 = addBody("position", "cuboid", world, r.g3.m, 0, 0, gripper_f, r_d, 0.01, 0.05, 0.1);
    r.g1.m.position.set(gripper_open_1, 0, r.g1.d/2);
    r.g2.m.position.set(gripper_open_2, 0, r.g2.d/2);

    r.g1_pad = addBody("position", "cuboid", world, r.g1.m, 0, 0, gripper_f, r_d, 0.001, 0.05, 0.1, 0, 0, 0, 0xffffff);
    r.g2_pad = addBody("position", "cuboid", world, r.g2.m, 0, 0, gripper_f, r_d, 0.001, 0.05, 0.1, 0, 0, 0, 0xffffff);
    r.g1_pad.m.position.set(0.01/2+0.001/2, 0, 0);
    r.g2_pad.m.position.set(-0.01/2-0.001/2, 0, 0);

    parts.push(r.base, r.mast, r.indicator, r.arm_base, r.shoulder,
        r.elbow, r.forearm, r.wrist, r.g3, r.g1, r.g2, r.g1_pad, r.g2_pad);
    for (let i in parts) {
        parts[i].c.is_robot = true;
        parts[i].c.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    }
    r.g1_pad.c.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
    r.g2_pad.c.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);

    r.g1.c.attached = true;
    r.g1_pad.c.attached = true;
    r.g2.c.attached = true;
    r.g2_pad.c.attached = true;

    let x = {x: 1.0, y: 0.0, z: 0.0};
    let y = {x: 0.0, y: 1.0, z: 0.0};
    let z = {x: 0.0, y: 0.0, z: 1.0};

    let j0 = fixedJoint(r.base, r.mast, 0, r.base.h/2, 0, 0, -r.mast.h/2, 0);
    let ji = fixedJoint(r.base, r.indicator, 0, r.base.h/2, r.base.w/2);
    let j1 = revoluteJoint(r.mast, r.arm_base, y, 0, 0, 0, -arm_w*0.75, 0, 0);
    let j2 = revoluteJoint(r.arm_base, r.shoulder, x, r.arm_base.w/2, 0, 0, -arm_w/2, 0, -r.shoulder.d/2);
    let j3 = revoluteJoint(r.shoulder, r.elbow, x,  -arm_w/2, 0, r.shoulder.d/2-arm_w/2,  arm_w/2, 0, -r.elbow.d/2);
    let j4 = revoluteJoint(r.elbow, r.forearm, z, 0, 0, r.elbow.d/2, 0, 0, -r.forearm.d/2);
    let j5 = revoluteJoint(r.forearm, r.wrist, x, arm_w/2, 0, r.forearm.d/2-arm_w/2, -arm_w/2, 0, -r.wrist.d/2);
    let j6 = revoluteJoint(r.wrist, r.g3, z, 0, 0, r.wrist.d/2, 0, 0, -r.g3.d/2);

    joints.push(j0, j1, j2, j3, j4, j5, j6);
    j1.setContactsEnabled(false);
    ji.setContactsEnabled(false);

    r.base.r.setNextKinematicTranslation({x: 0, y: r.base.h/2, z: 0}, true);
    world.step(eventQueue);
    r.base.r.recomputeMassPropertiesFromColliders();
    r.base.m.add(pointer_target);

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

    size = 0.05;
    for (let i = 1; i < 5; i++) {
        for (let j = 1; j < 5; j++) {
            let p = new THREE.Vector3(-0.25 + i/10, 1, -0.25 + j/10);
            p.z += 0.75;
            let c = new THREE.Color();
            c.setHex(0xffffff * Math.random());
            let box = addBody("dynamic", "cuboid", world, scene, 1, 0, -1, 0, size, size, size, p.x, p.y, p.z, c);
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
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.damping = 0.2;
    controls.addEventListener('change', render);

    renderer.setAnimationLoop(render);
}


function render() {

    frame_i++;

    for (let i = 0; i < boxes.length; i++) {
        let p = boxes[i].r.translation();
        let q = boxes[i].r.rotation();
        boxes[i].m.position.set(p.x, p.y, p.z);
        boxes[i].m.quaternion.set(q.x, q.y, q.z, q.w);
    }

//==============================================================================

    stop_arm_motion = false;
    for (let i in parts) {
        if (!parts[i].c.attached) continue;
        world.contactsWith(parts[i].c, (c2) => {
            if (!c2.is_robot && !c2.ignore_controller) {
                if (parts[i].c.contactCollider(c2, 0.001)) {
                    console.log("stop_arm_motion", i, c2);
                    // stop_arm_motion = true;
                }
            }
        });
    }

    // for (let j in joints) {
    //     let a1 = joints[j].anchor1();
    //     let a2 = joints[j].anchor2();
    //
    //     let p1 = new THREE.Vector3();
    //     p1.set(a1.x, a1.y, a1.z);
    //     let p2 = new THREE.Vector3();
    //     p2.set(a2.x, a2.y, a2.z);
    //
    //     // console.log("joint L", j, p1, p2);
    //
    //     let w1 = p1.clone();
    //     let w2 = p2.clone();
    //
    //     joints[j].r1.m.localToWorld(w1);
    //     joints[j].r2.m.localToWorld(w2);
    //
    //     if (Math.abs(w1.x-w2.x) > 0.01 ||
    //         Math.abs(w1.y-w2.y) > 0.01 ||
    //         Math.abs(w1.z-w2.z) > 0.01) {
    //
    //         let p3 = new THREE.Vector3();
    //         let p4 = new THREE.Vector3();
    //         joints[j].r1.m.localToWorld(p3);
    //         joints[j].r2.m.localToWorld(p4);
    //
    //         console.log("strain", j, "w1", w1.x, w1.y, w1.z, "w2",  w2.x, w2.y, w2.z);
    //         console.log("z", j, "p1", p3.x, p3.y, p3.z, "p2",  p4.x, p4.y, p4.z);
    //
    //         stop_arm_motion = true;
    //     } else {
    //
    //         let p3 = new THREE.Vector3();
    //         let p4 = new THREE.Vector3();
    //         joints[j].r1.m.localToWorld(p3);
    //         joints[j].r2.m.localToWorld(p4);
    //
    //         if (j == 5) {
    //             console.log("fine", j, "w1", w1.x, w1.y, w1.z, "w2",  w2.x, w2.y, w2.z);
    //             console.log("z", j, "p1", p3.x, p3.y, p3.z, "p2",  p4.x, p4.y, p4.z);
    //         }
    //     }
    // }

    let p = new THREE.Vector3();
    pointer_target.getWorldPosition(p);
    let gt = r.g3.r.translation();
    let t = {x: p.x-gt.x, y: p.y-gt.y, z: p.z-gt.z};
    gripper.computeColliderMovement(r.g3.c, t,
            0, -1, function(c) {return !(c.is_robot || c.ignore_controller);});
    let cm = gripper.computedMovement();
    r.g3.r.setNextKinematicTranslation({x: gt.x+cm.x, y: gt.y+cm.y, z: gt.z+cm.z}, true);

    // if (!stop_arm_motion) {
    //
    //     console.log("!stop_arm_motion");
    //
    //     for (let i in parts) {
    //         let q = parts[i].r.rotation();
    //         let q1 = new THREE.Quaternion();
    //         q1.set(q.x, q.y, q.z, q.w);
    //         let p = parts[i].r.translation();
    //         let p1 = new THREE.Vector3();
    //         p1.set(p.x, p.y, p.z);
    //         parts[i].lgt = p1;
    //         parts[i].lgr = q1;
    //         if (parts[i].t == "dynamic") parts[i].r.setBodyType(0);
    //
    //         // if (i >= 6 && i <= 7) console.log("save", i, parts[i].r.translation().x,
    //         //     parts[i].r.translation().y,
    //         //     parts[i].r.translation().z);
    //     }
    // } else {
    //
    //     console.log("do stop_arm_motion");
    //
    //     for (let i in parts) {
    //         if (parts[i].lgt && parts[i].lgr) {
    //             let p = parts[i].lgt.clone();
    //             let q = parts[i].lgr.clone();
    //
    //             parts[i].r.setBodyType(2);
    //             parts[i].r.setTranslation({x: p.x, y: p.y, z: p.z}, true);
    //             parts[i].r.setRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
    //
    //             let z = new RAPIER.Vector3(0, 0, 0);
    //
    //             parts[i].r.setAngvel(z, true);
    //             parts[i].r.setLinvel(z, true);
    //             parts[i].r.resetForces(true);
    //             parts[i].r.resetTorques(true);
    //             parts[i].r.recomputeMassPropertiesFromColliders();
    //
    //             // if (i >= 6 && i <= 7) console.log("restore", i, parts[i].r.translation().x,
    //             //     parts[i].r.translation().y,
    //             //     parts[i].r.translation().z);
    //         }
    //     }
    // }

    for (let i in parts) {
        if (parts[i].c.attached) continue;

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


    r.g1_pad.c.touch = "off";
    r.g2_pad.c.touch = "off";
    eventQueue.drainContactForceEvents(event => {
        let d = event.maxForceDirection();
        let dv = new THREE.Vector3(d.x, d.y, d.z);
        let c1 = world.getCollider(event.collider1());
        let c2 = world.getCollider(event.collider2());
        c1.touch = "on";
        c2.touch = "on";
    });

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
        if (gp1.x < gripper_closed_1 && r.g1_pad.c.touch == "off") {
            r.g1.m.position.set(gp1.x+gripper_s, gp1.y, gp1.z);
        }
        if (gp2.x > gripper_closed_2 && r.g2_pad.c.touch == "off") {
            r.g2.m.position.set(gp2.x-gripper_s, gp2.y, gp2.z);
        }
    }


    updateKinematic(r.g1);
    updateKinematic(r.g1_pad);
    updateKinematic(r.g2);
    updateKinematic(r.g2_pad);

    let d = target_direction.clone();
    d.applyQuaternion(r.base.m.quaternion);
    platform.setSlideEnabled(true);
    platform.computeColliderMovement(r.base.c, {x: d.x, y: d.y, z: d.z},
            0, -1, function(c) {return !c.is_robot;});
    let pt = platform.computedMovement();
    let T = r.base.r.translation();
    r.base.r.setNextKinematicTranslation({x: pt.x+T.x, y: pt.y+T.y, z: pt.z+T.z}, true);
//==============================================================================

    world.step(eventQueue);

//==============================================================================

    r.g3.r.recomputeMassPropertiesFromColliders();
    let q = new THREE.Quaternion();
    pointer_target.getWorldQuaternion(q);
    r.g3.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);

    r.base.r.recomputeMassPropertiesFromColliders();
    let R = r.base.r.rotation();
    q.set(R.x, R.y, R.z, R.w);
    q.rotateTowards(target_rotation, THREE.MathUtils.degToRad(1));
    r.base.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
//==============================================================================

    renderer.render(scene, camera);
}

function updateKinematic(part) {
    let p = new THREE.Vector3();
    let q = new THREE.Quaternion();
    part.m.updateWorldMatrix(true, true);
    part.m.getWorldPosition(p);
    part.m.getWorldQuaternion(q);
    part.r.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
    part.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
    part.r.recomputeMassPropertiesFromColliders();
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
            for (let i in parts) {
                let q = parts[i].r.rotation();
                let q1 = new THREE.Quaternion();
                q1.set(q.x, q.y, q.z, q.w);
                let p = parts[i].r.translation();
                let p1 = new THREE.Vector3();
                p1.set(p.x, p.y, p.z);
                parts[i].lgt = p1;
                parts[i].lgr = q1;
                console.log("save", i, parts[i].lgt, parts[i].lgr);
            }
            break;
        case "KeyM":
            for (let i in parts) {
                let p = parts[i].lgt;
                let q = parts[i].lgr;
                parts[i].r.setTranslation({x: p.x, y: p.y, z: p.z}, true);
                parts[i].r.setRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
                // console.log("restore", i, parts[i].lgt, parts[i].lgr);
            }
            let p2 = r.g3.lgt.clone();
            pointer_target.parent.worldToLocal(p2);
            pointer_target.position.set(p2.x, p2.y, p2.z);
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
