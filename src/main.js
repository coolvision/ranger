
import * as THREE from 'three';
import RAPIER from '../lib/rapier.es';

import { S1 } from './robots/s1.js'
import { load_a1 } from './robots/a1.js'
import * as utils from './rapier_utils.js'
import {camera, scene, renderer, stats, scene_setup, env_setup, add_controls, update_fn} from './setup.js'

let transform_ctrl;
let pointer_target = new THREE.Mesh();

let world;
let eventQueue;
let ground_collider;
let boxes = [];

let control_trunk = true;

let socket;
let motion_task = {
    done: true,
    type: "",
    v: 0,
};

let a1_robot;

await init();
async function init() {

    scene_setup();

    await RAPIER.init();
    let gravity = {x: 0.0, y: -9.81, z: 0.0};
    world = new RAPIER.World(gravity);
    eventQueue = new RAPIER.EventQueue(true);
    let ip = world.integrationParameters;
    ip.erp = 0.8;
    ip.maxStabilizationIterations = 10;

    let groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 1, 10.0);
    groundColliderDesc.setTranslation(0, -1, 0);
    ground_collider = world.createCollider(groundColliderDesc);
    ground_collider.ignore_controller = true;

    scene.add(pointer_target);
    pointer_target.position.set(0, 0.5, 0);
    pointer_target.rotateX(-Math.PI/2);
    transform_ctrl = add_controls(camera, renderer, scene, pointer_target);

    env_setup();

    a1_robot = await load_a1(pointer_target.position, scene, world, eventQueue);

    console.log("a1_robot", a1_robot)

    pointer_target.position.set(-0.1, 0.3, 1);
    update();
    world.step(eventQueue);
    pointer_target.position.set(0.0, 0.3, 1);
    // for (let j of a1_robot.feet_links) {
    //     a1_robot.feet_targets[j].position.y = 0;
    //     a1_robot.feet_targets[j].position.z += 1;
    // }
    // for (let i = 0; i < 5; i++) {
    //     update();
    //     world.step(eventQueue);
    // }

    for (let j of a1_robot.feet_links) {
        let w = a1_robot.feet_targets[j].position.clone();
        let p = a1_robot.links["trunk"].m.worldToLocal(w);
        a1_robot.feet_walk_targets[j].position.copy(p);
    }

    for (let j in a1_robot.joints) {

        if (j == "FR_calf_joint") {

            let m1 = a1_robot.joints[j].link1.m;
            let m2 = a1_robot.joints[j].link2.m;

            let e1 = new THREE.Euler();
            e1.setFromRotationMatrix(m1.matrixWorld);

            let e2 = new THREE.Euler();
            e2.setFromRotationMatrix(m2.matrixWorld);

            console.log("FR_calf_joint", e1, e2)
        }
    }


    update_fn(render)();
}

function update() {

    if (a1_robot.links["trunk"] && control_trunk) {
        let p = pointer_target.position;
        a1_robot.links["trunk"].r.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
        let q = pointer_target.quaternion;
        a1_robot.links["trunk"].r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
    }

    for (let j of a1_robot.feet_links) {
        if (a1_robot.feet_targets[j]) {
            let p = a1_robot.feet_targets[j].position;
            a1_robot.feet_control_links[j].r.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
            let q = a1_robot.feet_targets[j].quaternion;
            a1_robot.feet_control_links[j].r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
        }
    }

    // utils.updateLinks(a1_robot);

    utils.updateLinks(a1_robot.links);
    utils.updateLinks(a1_robot.sim_links);



    for (let j in a1_robot.joints) {

        // if (j == "FR_calf_joint") {
            // console.log("FR_calf_joint",  a1_robot.joints[j].link1, a1_robot.joints[j].link2);
        // if (j.includes("calf_joint")) {
        if (1) {

            let m1 = a1_robot.joints[j].link1.m;
            let m2 = a1_robot.joints[j].link2.m;

            let m_child = a1_robot.joints[j].link2.m.matrixWorld.clone();
            let m_parent = a1_robot.joints[j].link1.m.matrixWorld.clone();
            m_parent.invert();
            m_parent.multiply(m_child);

            let q = new THREE.Quaternion();
            q.setFromRotationMatrix(m_parent);

            let angle = 2 * Math.acos(q.w);
            let s = 1;
            if (1 - q.w * q.w > 0.000001) {
                s = Math.sqrt(1 - q.w * q.w);
            }
            let axis = new THREE.Vector3(q.x/s, q.y/s, q.z/s);

            if (Math.abs(axis.y) > 0.5) {
                if (axis.y < 0) angle = -angle;
            } else if (Math.abs(axis.x) > 0.5) {
                if (axis.x < 0) angle = -angle;
            } else if (Math.abs(axis.z) > 0.5) {
                if (axis.z < 0) angle = -angle;
            }
            if (angle > Math.PI) angle -= Math.PI*2;

            console.log(j, THREE.MathUtils.radToDeg(angle), axis.x, axis.y, axis.z)

            // if (a1_robot.sim_joints[j].mimic)
            //     a1_robot.sim_joints[j].configureMotorPosition(angle, 1000, 10);

            // console.log("FR_calf_joint", e1.x, e1.y, e1.z)
        // }

        // let q1 = a1_robot.joints[j].link1.m.quaternion;
        // let q2 = a1_robot.joints[j].link2.m.quaternion;
        // let a = q2.angleTo(q1);
        // // console.log("joint", j, q1.angleTo(q2), a1_robot.joints[j], a1_robot.sim_joints[j]);
        // if (a1_robot.sim_joints[j].mimic) {
        //     a1_robot.sim_joints[j].configureMotorPosition(a, 10, 1);
        }
    }
}

renderer.render(scene, camera);

export function render() {
    stats.begin();

    world.step(eventQueue);

    update();

    for (let j of a1_robot.feet_links) {
        let w = a1_robot.feet_targets[j].position.clone();
        let p = a1_robot.links["trunk"].m.worldToLocal(w);
        let p2 = a1_robot.feet_walk_targets[j].position;
        let d = p.distanceTo(p2);
        if (d > 0.2) {
            a1_robot.feet_walk_targets[j].material.color = new THREE.Color(0xff0000);
            a1_robot.feet_walk_targets[j].getWorldPosition(w);
            if (w.y < 0) w.y = 0;
            a1_robot.feet_targets[j].position.copy(w);
        } else {
            a1_robot.feet_walk_targets[j].material.color = new THREE.Color(0xffffff);
        }
    }

    renderer.render(scene, camera);

    stats.end();
}

window.addEventListener('keydown', function(event) {
    switch ( event.code ) {
        case "KeyC":
            control_trunk = !control_trunk;
            if (!control_trunk) {
                a1_robot.links["trunk"].r.setBodyType(0);
            } else {
                a1_robot.links["trunk"].r.setBodyType(2);
            }
            break;
        case "KeyZ":
            world.step(eventQueue);
            break;
        case "KeyT":
            transform_ctrl.setMode('translate');
            break;
        case "KeyR":
            transform_ctrl.setMode('rotate');
            break;
    }
});
