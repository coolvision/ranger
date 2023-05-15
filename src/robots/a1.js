
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

    urdf.position.copy(position);
    urdf.rotateX(-Math.PI/2);
    scene.add(urdf);

    console.log("urdf", urdf);

    // let x = 0;
    for (let l in urdf.links) {

        if (urdf.links[l].children.length >= 1) {

            // is it the same for all URDFs?
            // let v = urdf.links[l].children[0].children[0].children[0];
            let c = urdf.links[l].children[0].children[0];

            if (c && c.type == "Mesh") {
                // console.log("visual", v);
                // console.log("collider", c);
                let u = urdf.links[l].children[0];

                // r.links[l] = utils.addLink("dynamic", c, c, world, scene, p.x, p.y, p.z);

                let p = new THREE.Vector3();
                u.getWorldPosition(p);
                let q = new THREE.Quaternion();
                u.getWorldQuaternion(q);

                console.log(l, "local p", u.position, "world", p);
                console.log(l, "local q", u.quaternion, "world", q);

                p.copy(u.position);
                q.copy(u.quaternion);

                if (l == "trunk") {
                    // r.links[l] = utils.addLink("position", c, c, world, scene, p, q);
                    r.links[l] = utils.addLink("dynamic", c, c, world, scene, p, q);
                    // r.links[l].r.setAdditionalMass(0);
                    r.links[l].r.setGravityScale(0);
                } else {
                    r.links[l] = utils.addLink("dynamic", c, c, world, scene, p, q);
                    r.links[l].r.setGravityScale(-0.5);
                }


                if (l.includes("foot")) {
                    // r.links[l].r.setGravityScale(1);
                    // r.links[l].r.setAdditionalMass(0.001);
                }

                r.links[l].c.is_robot = true;

                // let p = new THREE.Vector3(0, 0, 0);
                // console.log("link", l, "position", u.position,
                //                        "quaternion", u.quaternion,
                //                        "world", r.links[l].m.getWorldPosition(p));
            }
        }
    }

    // utils.updateLinks2(r);

    for (let j in urdf.joints) {
        // if (l == "base") continue;
        // if (l == "trunk") continue;
        // console.log("link", l, urdf.links[l]);

        let child_name = urdf.joints[j].children[0].name;
        let parent_name = urdf.joints[j].parent.name;
        console.log("joint", j,
            urdf.joints[j],
            // urdf.joints[j].position,
            "child", child_name, "parent", parent_name);
        let child_link = r.links[child_name];
        let parent_link = r.links[parent_name];
        let p = urdf.joints[j].position;
        let a = urdf.joints[j].axis;

        let joint;
        if (urdf.joints[j]._jointType == "fixed") {
            joint = utils.fixedJoint(world, child_link, parent_link, 0, 0, 0, p.x, p.y, p.z);
        } else if (urdf.joints[j]._jointType == "revolute") {
            // joint = utils.revoluteJoint(world, child_link, parent_link,
            //     {x: a.x, y: a.y, z: a.z}, 0, 0, 0, p.x, p.y, p.z);
            // joint.configureMotorModel(0);
            // joint.configureMotorPosition(0, 100000, 1);

            let params = RAPIER.JointData.revolute({x: p.x, y: p.y, z: p.z},
                {x: 0, y: 0, z: 0},
                {x: a.x, y: a.y, z: a.z});
            let l1 = urdf.joints[j].limit.lower;
            let l2 = urdf.joints[j].limit.upper;
            params.limitsEnabled = true;
            params.limits = [l1, l2];
            console.log("limits", l1, l2);
            // joint = world.createImpulseJoint(params, parent_link.r, child_link.r, true);

            joint = world.createMultibodyJoint(params, parent_link.r, child_link.r, true);

            // joint.configureMotorPosition((l1+l2)/2, 100000, 1);

            // joint.configureMotorModel(1);
            // if (j.includes("calf_joint")) {
            //     joint.configureMotorPosition(0.5, 10000, 0);
            // } else {
            //     joint.configureMotorPosition(0, 10000, 0);
            // }


        } else {
            console.log("joint", urdf.joints[j]._jointType);
        }
        joint.setContactsEnabled(false);

        r.joints[j] = joint;
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
        world.createImpulseJoint(RAPIER.JointData.spherical({x: 0, y: 0, z: 0},
             {x: 0, y: 0, z: 0}), r.links[j].r, rigid_body, true);

    }

    console.log("r", r)

    return r;
}
