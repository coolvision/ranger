
import * as THREE from 'three';
import RAPIER from './rapier3d-compat';

export class Robot {

    constructor() {

        // let parts = [];
        // let joints = [];
        // let gripper_v = 10;
        // let gripper_s = 0.001;
        // let gripper_f = 100;
        // let gripper_d = 10;
        // let gripper_open_1 = -0.05;
        // let gripper_closed_1 = -0.005;
        // let gripper_open_2 = 0.05;
        // let gripper_closed_2 = 0.005;
        // let r_d = 100;
        // let gripper_open = true;
        // let platform, gripper;
        //
        // let offset = 0;
        // platform = world.createCharacterController(0.01);
        // gripper = world.createCharacterController(0.01);
        //
        // let groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 1, 10.0);
        // groundColliderDesc.setTranslation(0, -1, 0);
        // gc = world.createCollider(groundColliderDesc);
        // gc.ignore_controller = true;
        //
        // let arm_w = 0.05;
        // r.base = addBody("position", "cuboid", world, scene, 0, 0, -1, r_d, 0.4, 0.15, 0.4);
        // r.mast = addBody("dynamic", "cuboid", world, r.base.m, 0, 0, -1, r_d, 0.075, 1.5, 0.075);
        // r.indicator = addBody("dynamic", "cuboid", world, r.base.m, 0, 0, -1, r_d, 0.02, 0.02, 0.02, 0, 0, 0, 0xff0000);
        // r.arm_base = addBody("dynamic", "cuboid", world, r.mast.m, 0, 0, -1, r_d, arm_w*4, r.mast.w*Math.sqrt(2), r.mast.w*Math.sqrt(2));
        // r.shoulder = addBody("dynamic", "cuboid", world, r.arm_base.m, 0, 0, -1, r_d, arm_w, arm_w, 0.4);
        // r.elbow = addBody("dynamic", "cuboid", world, r.shoulder.m, 0, 0, -1, r_d, arm_w, arm_w, 0.2);
        // r.forearm = addBody("dynamic", "cuboid", world, r.elbow.m, 0, 0, -1, r_d, arm_w, arm_w, 0.2);
        // r.wrist = addBody("dynamic", "cuboid", world, r.forearm.m, 0, 0, -1, r_d, arm_w, arm_w, 0.1);
        // r.g3 = addBody("position", "cuboid", world, scene, 0, 0, -1, r_d, 0.16, arm_w, 0.02, 0.5, 0.5, 0.5);
        // r.g3.m.position.set(0.5, 0.5, 0.5);
        //
        // r.g1 = addBody("position", "cuboid", world, r.g3.m, 0, 0, gripper_f, r_d, 0.01, 0.05, 0.1);
        // r.g2 = addBody("position", "cuboid", world, r.g3.m, 0, 0, gripper_f, r_d, 0.01, 0.05, 0.1);
        // r.g1.m.position.set(gripper_open_1, 0, r.g1.d/2);
        // r.g2.m.position.set(gripper_open_2, 0, r.g2.d/2);
        //
        // r.g1_pad = addBody("position", "cuboid", world, r.g1.m, 0, 0, gripper_f, r_d, 0.001, 0.05, 0.1, 0, 0, 0, 0xffffff);
        // r.g2_pad = addBody("position", "cuboid", world, r.g2.m, 0, 0, gripper_f, r_d, 0.001, 0.05, 0.1, 0, 0, 0, 0xffffff);
        // r.g1_pad.m.position.set(0.01/2+0.001/2, 0, 0);
        // r.g2_pad.m.position.set(-0.01/2-0.001/2, 0, 0);
        //
        // parts.push(r.base, r.mast, r.indicator, r.arm_base, r.shoulder,
        //     r.elbow, r.forearm, r.wrist, r.g3, r.g1, r.g2, r.g1_pad, r.g2_pad);
        // for (let i in parts) {
        //     parts[i].c.is_robot = true;
        //     parts[i].c.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        // }
        // r.g1_pad.c.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
        // r.g2_pad.c.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
        //
        // r.g1.c.attached = true;
        // r.g1_pad.c.attached = true;
        // r.g2.c.attached = true;
        // r.g2_pad.c.attached = true;
        //
        // let x = {x: 1.0, y: 0.0, z: 0.0};
        // let y = {x: 0.0, y: 1.0, z: 0.0};
        // let z = {x: 0.0, y: 0.0, z: 1.0};
        //
        // let j0 = fixedJoint(r.base, r.mast, 0, r.base.h/2, 0, 0, -r.mast.h/2, 0);
        // let ji = fixedJoint(r.base, r.indicator, 0, r.base.h/2, r.base.w/2);
        // let j1 = revoluteJoint(r.mast, r.arm_base, y, 0, 0, 0, -arm_w*0.75, 0, 0);
        // let j2 = revoluteJoint(r.arm_base, r.shoulder, x, r.arm_base.w/2, 0, 0, -arm_w/2, 0, -r.shoulder.d/2);
        // let j3 = revoluteJoint(r.shoulder, r.elbow, x,  -arm_w/2, 0, r.shoulder.d/2-arm_w/2,  arm_w/2, 0, -r.elbow.d/2);
        // let j4 = revoluteJoint(r.elbow, r.forearm, z, 0, 0, r.elbow.d/2, 0, 0, -r.forearm.d/2);
        // let j5 = revoluteJoint(r.forearm, r.wrist, x, arm_w/2, 0, r.forearm.d/2-arm_w/2, -arm_w/2, 0, -r.wrist.d/2);
        // let j6 = revoluteJoint(r.wrist, r.g3, z, 0, 0, r.wrist.d/2, 0, 0, -r.g3.d/2);
        //
        // joints.push(j0, j1, j2, j3, j4, j5, j6);
        // j1.setContactsEnabled(false);
        // ji.setContactsEnabled(false);
    }


    // updateModels() {
    //
    //     for (let i in parts) {
    //         if (parts[i].c.attached) continue;
    //
    //         parts[i].r.wakeUp();
    //
    //         let q = parts[i].r.rotation();
    //         let q1 = new THREE.Quaternion();
    //         q1.set(q.x, q.y, q.z, q.w);
    //
    //         let p = parts[i].r.translation();
    //         let p1 = new THREE.Vector3();
    //         p1.set(p.x, p.y, p.z);
    //
    //         let m_body = new THREE.Matrix4();
    //         m_body.compose(p1, q1, new THREE.Vector3(1, 1, 1));
    //
    //         let m_parent = parts[i].m.parent.matrixWorld.clone();
    //         m_parent.invert();
    //         m_parent.multiply(m_body);
    //
    //         parts[i].m.position.set(0, 0, 0);
    //         parts[i].m.quaternion.set(0, 0, 0, 1);
    //         parts[i].m.scale.set(1, 1, 1);
    //         parts[i].m.applyMatrix4(m_parent);
    //
    //         parts[i].m.updateWorldMatrix(true, true);
    //     }
    // }
    //
    // updateGripperState() {
    //
    //     r.g1_pad.c.touch = "off";
    //     r.g2_pad.c.touch = "off";
    //     eventQueue.drainContactForceEvents(event => {
    //         let d = event.maxForceDirection();
    //         let dv = new THREE.Vector3(d.x, d.y, d.z);
    //         let c1 = world.getCollider(event.collider1());
    //         let c2 = world.getCollider(event.collider2());
    //         c1.touch = "on";
    //         c2.touch = "on";
    //     });
    //
    //     let gp1 = r.g1.m.position.clone();
    //     let gp2 = r.g2.m.position.clone();
    //     if (gripper_open) {
    //         if (gp1.x > gripper_open_1) {
    //             r.g1.m.position.set(gp1.x-gripper_s, gp1.y, gp1.z);
    //         }
    //         if (gp2.x < gripper_open_2) {
    //             r.g2.m.position.set(gp2.x+gripper_s, gp2.y, gp2.z);
    //         }
    //     } else {
    //         if (gp1.x < gripper_closed_1 && r.g1_pad.c.touch == "off") {
    //             r.g1.m.position.set(gp1.x+gripper_s, gp1.y, gp1.z);
    //         }
    //         if (gp2.x > gripper_closed_2 && r.g2_pad.c.touch == "off") {
    //             r.g2.m.position.set(gp2.x-gripper_s, gp2.y, gp2.z);
    //         }
    //     }
    //
    //     updateRigidBody(r.g1);
    //     updateRigidBody(r.g1_pad);
    //     updateRigidBody(r.g2);
    //     updateRigidBody(r.g2_pad);
    // }
    //
    // updateRigidBody(part) {
    //     let p = new THREE.Vector3();
    //     let q = new THREE.Quaternion();
    //     part.m.updateWorldMatrix(true, true);
    //     part.m.getWorldPosition(p);
    //     part.m.getWorldQuaternion(q);
    //     part.r.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
    //     part.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
    //     part.r.recomputeMassPropertiesFromColliders();
    // }
    //
    // setPlatformTranslation() {
    //
    //     let d = target_direction.clone();
    //     d.applyQuaternion(r.base.m.quaternion);
    //     platform.setSlideEnabled(true);
    //     platform.computeColliderMovement(r.base.c, {x: d.x, y: d.y, z: d.z},
    //             0, -1, function(c) {return !c.is_robot;});
    //     let pt = platform.computedMovement();
    //     let T = r.base.r.translation();
    //     r.base.r.setNextKinematicTranslation({x: pt.x+T.x, y: pt.y+T.y, z: pt.z+T.z}, true);
    // }
    //
    // setPlatformRotation() {
    //     r.base.r.recomputeMassPropertiesFromColliders();
    //     let R = r.base.r.rotation();
    //     q.set(R.x, R.y, R.z, R.w);
    //     q.rotateTowards(target_rotation, THREE.MathUtils.degToRad(1));
    //     r.base.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
    // }
    //
    // setGripperTranslation() {
    //     let p = new THREE.Vector3();
    //     pointer_target.getWorldPosition(p);
    //     let gt = r.g3.r.translation();
    //     let t = {x: p.x-gt.x, y: p.y-gt.y, z: p.z-gt.z};
    //     gripper.computeColliderMovement(r.g3.c, t,
    //             0, -1, function(c) {return !(c.is_robot || c.ignore_controller);});
    //     let cm = gripper.computedMovement();
    //     r.g3.r.setNextKinematicTranslation({x: gt.x+cm.x, y: gt.y+cm.y, z: gt.z+cm.z}, true);
    // }
    //
    // setGripperRotation() {
    //
    //     r.g3.r.recomputeMassPropertiesFromColliders();
    //     let q = new THREE.Quaternion();
    //     pointer_target.getWorldQuaternion(q);
    //     r.g3.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
    // }
    //
    // saveState() {
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
    //     }
    // }
    //
    // restoreState() {
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
    //         }
    //     }
    // }
    //
    // checkContacts() {
    //     stop_arm_motion = false;
    //     for (let i in parts) {
    //         if (!parts[i].c.attached) continue;
    //         world.contactsWith(parts[i].c, (c2) => {
    //             if (!c2.is_robot && !c2.ignore_controller) {
    //                 if (parts[i].c.contactCollider(c2, 0.001)) {
    //                     console.log("stop_arm_motion", i, c2);
    //                     // stop_arm_motion = true;
    //                 }
    //             }
    //         });
    //     }
    // }
    //
    // checkJoints() {
    //
    //     for (let j in joints) {
    //         let a1 = joints[j].anchor1();
    //         let a2 = joints[j].anchor2();
    //
    //         let p1 = new THREE.Vector3();
    //         p1.set(a1.x, a1.y, a1.z);
    //         let p2 = new THREE.Vector3();
    //         p2.set(a2.x, a2.y, a2.z);
    //
    //         // console.log("joint L", j, p1, p2);
    //
    //         let w1 = p1.clone();
    //         let w2 = p2.clone();
    //
    //         joints[j].r1.m.localToWorld(w1);
    //         joints[j].r2.m.localToWorld(w2);
    //
    //         if (Math.abs(w1.x-w2.x) > 0.01 ||
    //             Math.abs(w1.y-w2.y) > 0.01 ||
    //             Math.abs(w1.z-w2.z) > 0.01) {
    //
    //             let p3 = new THREE.Vector3();
    //             let p4 = new THREE.Vector3();
    //             joints[j].r1.m.localToWorld(p3);
    //             joints[j].r2.m.localToWorld(p4);
    //
    //             console.log("strain", j, "w1", w1.x, w1.y, w1.z, "w2",  w2.x, w2.y, w2.z);
    //             console.log("z", j, "p1", p3.x, p3.y, p3.z, "p2",  p4.x, p4.y, p4.z);
    //
    //             stop_arm_motion = true;
    //         } else {
    //
    //             let p3 = new THREE.Vector3();
    //             let p4 = new THREE.Vector3();
    //             joints[j].r1.m.localToWorld(p3);
    //             joints[j].r2.m.localToWorld(p4);
    //
    //             if (j == 5) {
    //                 console.log("fine", j, "w1", w1.x, w1.y, w1.z, "w2",  w2.x, w2.y, w2.z);
    //                 console.log("z", j, "p1", p3.x, p3.y, p3.z, "p2",  p4.x, p4.y, p4.z);
    //             }
    //         }
    //     }
    //
    // }

}
