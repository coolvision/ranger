
import * as THREE from 'three';
import URDFLoader from '../../lib/URDFLoader.js';
import * as utils from '../rapier_utils.js'
import { camera, scene, renderer, add_controls } from '../setup.js'
import RAPIER from '../../lib/rapier.es';

export async function load_a1(position, scene, world) {

    let r = {
        links: {},
        joints: {},
        leg_targets: {},
        leg_controls: {},
        leg_links: ["FL_foot", "FR_foot", "RL_foot", "RR_foot"],
        control_links: {}
    };

    const loader = new URDFLoader();
    let urdf;
    loader.packages = {
        'a1_description' : '/src/robots/a1_description'            // The equivalent of a (list of) ROS package(s):// directory
    };
    loader.parseCollision = true;
    loader.parseVisual = false;
    urdf = await loader.loadAsync('/src/robots/a1_description/urdf/a1_simple.urdf');
    // urdf = await loader.loadAsync('/src/robots/a1_description/urdf/a1.urdf');

    urdf.position.copy(position);
    urdf.rotateX(-Math.PI/2);
    scene.add(urdf);

    console.log("urdf", urdf);

    for (let i in urdf.links) {
        let l = urdf.links[i];
        let c = null;
        let v = null;
        for (let j in l.children) {
            if (l.children[j].type == "URDFCollider") {
                c = l.children[j].children[0];
            }
        }
        for (let j in l.children) {
            if (l.children[j].type == "URDFVisual") {
                v = l.children[j];
            }
        }

        if (c && c.type == "Mesh") {

            let u = c.parent;

            let p = new THREE.Vector3();
            u.getWorldPosition(p);
            let q = new THREE.Quaternion();
            u.getWorldQuaternion(q);

            p.copy(u.position);
            q.copy(u.quaternion);

            r.links[i] = utils.addLink("dynamic", c, world, scene, p, q);
            r.links[i].v = v;

            // scene.add(v);
            r.links[i].r.setGravityScale(0);
            if (l == "trunk") {
                // r.links[i].r.setGravityScale(0);
            } else {
                // r.links[i].r.setGravityScale(-0.1);
            }
        }
    }

    for (let j in urdf.joints) {

        let child_name = urdf.joints[j].children[0].name;
        let parent_name = urdf.joints[j].parent.name;

        let child_link = r.links[child_name];
        let parent_link = r.links[parent_name];
        let p = urdf.joints[j].position;
        let a = urdf.joints[j].axis;

        let joint;

        // if (urdf.joints[j]._jointType == "fixed") {
        // //
        //     let params = RAPIER.JointData.fixed(
        //         {x: p.x, y: p.y, z: p.z},
        //         {w: 1.0, x: 0.0, y: 0.0, z: 0.0},
        //         {x: 0, y: 0, z: 0},
        //         {w: 1.0, x: 0.0, y: 0.0, z: 0.0});
        //
        //     // joint = utils.fixedJoint(world, child_link, parent_link, 0, 0, 0, p.x, p.y, p.z);
        //
        //     joint = world.createMultibodyJoint(params, parent_link.r, child_link.r, true);
        //     // joint = world.createImpulseJoint(params, parent_link.r, child_link.r, true);
        //
        // // } else if (urdf.joints[j]._jointType == "revolute") {
        // } else {

        if (urdf.joints[j]._jointType == "revolute") {

            let params = RAPIER.JointData.revolute({x: p.x, y: p.y, z: p.z},
                {x: 0, y: 0, z: 0},
                {x: a.x, y: a.y, z: a.z});
            // let l1 = urdf.joints[j].limit.lower;
            // let l2 = urdf.joints[j].limit.upper;
            // params.limitsEnabled = true;
            // params.limits = [l1, l2];

            joint = world.createMultibodyJoint(params, parent_link.r, child_link.r, true);
            joint.setContactsEnabled(false);

        }
        //  else {
        //     console.log("joint", urdf.joints[j]._jointType);
        // }

        r.joints[j] = joint;
    }

    // for (let j of r.leg_links) {
    //
    //     r.leg_targets[j] = new THREE.Mesh();
    //     scene.add(r.leg_targets[j]);
    //     r.leg_targets[j].position.copy(r.links[j].m.position);
    //     r.leg_targets[j].quaternion.copy(r.links[j].m.quaternion);
    //     r.leg_controls[j] = add_controls(camera, renderer, scene, r.leg_targets[j]);
    //
    //     let body_desc = RAPIER.RigidBodyDesc.kinematicPositionBased();
    //     let rigid_body = world.createRigidBody(body_desc);
    //     r.control_links[j] = {
    //         r: rigid_body
    //     }
    //     world.createImpulseJoint(RAPIER.JointData.spherical({x: 0, y: 0, z: 0},
    //          {x: 0, y: 0, z: 0}), r.links[j].r, rigid_body, true);
    // }

    return r;
}