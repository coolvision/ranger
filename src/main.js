
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

    a1_robot = await load_a1(pointer_target.position, scene, world);

    update_fn(render)();
}

export function render() {
    stats.begin();

    world.step(eventQueue);

    if (a1_robot.links["trunk"] && control_trunk) {
        let p = pointer_target.position;
        a1_robot.links["trunk"].r.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
        let q = pointer_target.quaternion;
        a1_robot.links["trunk"].r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
    }

    for (let j of a1_robot.leg_links) {
        if (a1_robot.leg_targets[j]) {
            let p = a1_robot.leg_targets[j].position;
            a1_robot.control_links[j].r.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
            let q = a1_robot.leg_targets[j].quaternion;
            a1_robot.control_links[j].r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
        }
    }

    utils.updateLinks(a1_robot);

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
    }
});
