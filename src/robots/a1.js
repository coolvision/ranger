
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
        // leg_links: ["FL_calf", "FR_calf", "RL_calf", "RR_calf"],
        // leg_links: ["FL_calf", "FR_calf", "RL_calf", "RR_calf"],

        leg_links: ["FL_foot", "FR_foot", "RL_foot", "RR_foot"],
        // leg_links: ["FL_foot", "FR_foot"],
        control_links: {}
    };

    const loader = new URDFLoader();
    let urdf;
    loader.packages = {
        'a1_description' : '/src/robots/a1_description'            // The equivalent of a (list of) ROS package(s):// directory
    };
    loader.parseCollision = true;
    loader.parseVisual = false;
    urdf = await loader.loadAsync('/src/robots/a1_description/urdf/a1.urdf');
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

            if (i == "trunk") {
                r.links[i] = utils.addLink("position", c, world, scene, p, q);
            } else {
                r.links[i] = utils.addLink("dynamic", c, world, scene, p, q);
            }
            r.links[i].v = v;

            // console.log("add link", i);

            // scene.add(v);
            // r.links[i].r.setGravityScale(0);
            if (i == "trunk") {
                console.log("trunk gravity");
                // r.links[i].r.setGravityScale(-0.1);
            } else {
                // r.links[i].r.setGravityScale(-0.5);
            }
        }
    }

    // addJoint(world, urdf, r, "FL_hip_joint");
    // addJoint(world, urdf, r, "FR_hip_joint");
    // addJoint(world, urdf, r, "RL_hip_joint");
    // addJoint(world, urdf, r, "RR_hip_joint");
    //
    // addJoint(world, urdf, r, "FL_thigh_joint");
    // addJoint(world, urdf, r, "FR_thigh_joint");
    // addJoint(world, urdf, r, "RL_thigh_joint");
    // addJoint(world, urdf, r, "RR_thigh_joint");
    //
    // addJoint(world, urdf, r, "FL_calf_joint");
    // addJoint(world, urdf, r, "FR_calf_joint");
    // addJoint(world, urdf, r, "RL_calf_joint");
    // addJoint(world, urdf, r, "RR_calf_joint");

    for (let j in urdf.joints) {
        addJoint(world, urdf, r, j);
    }

    for (let j of r.leg_links) {

        r.leg_targets[j] = new THREE.Mesh();
        scene.add(r.leg_targets[j]);
        r.leg_targets[j].position.copy(r.links[j].m.position);
        r.leg_targets[j].quaternion.copy(r.links[j].m.quaternion);
        r.leg_controls[j] = add_controls(camera, renderer, scene, r.leg_targets[j]);

        let body_desc = RAPIER.RigidBodyDesc.kinematicPositionBased();
        let rigid_body = world.createRigidBody(body_desc);
        r.control_links[j] = {
            r: rigid_body
        }
        // let params = RAPIER.JointData.revolute(
        //     {x: 0, y: 0, z: 0},
        //     {x: 0, y: 0, z: 0},
        //     {x: 0, y: 1, z: 0});

        world.createImpulseJoint(RAPIER.JointData.spherical({x: 0, y: 0, z: 0},
             {x: 0, y: 0, z: 0}), r.links[j].r, rigid_body, true);

        // world.createImpulseJoint(params, r.links[j].r, rigid_body, true);

    }

    return r;
}

function addJoint(world, urdf, r, j) {

    let child_name = urdf.joints[j].children[0].name;
    let parent_name = urdf.joints[j].parent.name;

    let child_link = r.links[child_name];
    let parent_link = r.links[parent_name];
    let p = urdf.joints[j].position;
    let a = urdf.joints[j].axis;

    let joint;

    // console.log("add joint", j);

    if (j.includes("foot") && urdf.joints[j]._jointType == "fixed") {
    // //
        let params = RAPIER.JointData.fixed(
            {x: p.x, y: p.y, z: p.z},
            {w: 1.0, x: 0.0, y: 0.0, z: 0.0},
            {x: 0, y: 0, z: 0},
            {w: 1.0, x: 0.0, y: 0.0, z: 0.0});

        joint = world.createMultibodyJoint(params, parent_link.r, child_link.r, true);
        joint.setContactsEnabled(false);
    }

    if (urdf.joints[j]._jointType == "revolute") {

        let params = RAPIER.JointData.revolute({x: p.x, y: p.y, z: p.z},
            {x: 0, y: 0, z: 0},
            {x: a.x, y: a.y, z: a.z});
        let l1 = urdf.joints[j].limit.lower;
        let l2 = urdf.joints[j].limit.upper;
        params.limitsEnabled = true;
        params.limits = [l1, l2];

        // console.log("joint", urdf.joints[j], parent_name, child_name, parent_link, child_link);

        if (j.includes("hip")) {
            joint = world.createImpulseJoint(params, parent_link.r, child_link.r, true);
        } else {
            joint = world.createMultibodyJoint(params, parent_link.r, child_link.r, true);
        }
        joint.setContactsEnabled(false);


        // if (j.includes("calf_joint")) {
        //     joint.configureMotorPosition(0.5, 0.01, 0.01);
        // } else {
        //     joint.configureMotorPosition(0, 100000, 0);
        // }

    }
    //  else {
    //     console.log("joint", urdf.joints[j]._jointType);
    // }


    // console.log("connect", "parent", parent_name, "child", child_name)
    // break;

    r.joints[j] = joint;
}
