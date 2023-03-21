
import * as THREE from 'three';
import RAPIER from './rapier3d-compat';
import * as utils from './rapier_utils.js'

export class Robot {

    constructor(world, scene) {

        this.parts = [];
        this.joints = [];

        this.gripper_s = 0.001;
        this.gripper_open_1 = -0.05;
        this.gripper_closed_1 = -0.005;
        this.gripper_open_2 = 0.05;
        this.gripper_closed_2 = 0.005;
        this.gripper_open = true;
        let gripper_f = 100;
        let gripper_d = 10;
        let r_d = 100;

        this.platform = world.createCharacterController(0.01);
        this.gripper = world.createCharacterController(0.01);

        let arm_w = 0.05;
        this.base = utils.addBody("position", "cuboid", world, scene, 1, 100, -1, r_d, 0.4, 0.15, 0.4);
        this.mast = utils.addBody("dynamic", "cuboid", world, this.base.m, 1, 100, -1, r_d, 0.075, 1.5, 0.075);
        this.indicator = utils.addBody("dynamic", "cuboid", world, this.base.m, 0, 0, -1, r_d, 0.02, 0.02, 0.02, 0, 0, 0, 0xff0000);
        this.arm_base = utils.addBody("dynamic", "cuboid", world, this.mast.m, 0, 0, -1, r_d, arm_w*4, this.mast.w*Math.sqrt(2), this.mast.w*Math.sqrt(2));
        this.shoulder = utils.addBody("dynamic", "cuboid", world, this.arm_base.m, 0, 0, -1, r_d, arm_w, arm_w, 0.4);
        this.elbow = utils.addBody("dynamic", "cuboid", world, this.shoulder.m, 0, 0, -1, r_d, arm_w, arm_w, 0.2);
        this.forearm = utils.addBody("dynamic", "cuboid", world, this.elbow.m, 0, 0, -1, r_d, arm_w, arm_w, 0.2);
        this.wrist = utils.addBody("dynamic", "cuboid", world, this.forearm.m, 0, 0, -1, r_d, arm_w, arm_w, 0.1);
        this.g3 = utils.addBody("position", "cuboid", world, scene, 0, 0, -1, r_d, 0.16, arm_w, 0.02, 0.5, 0.5, 0.5);
        this.g3.m.position.set(0.5, 0.5, 0.5);

        this.g1 = utils.addBody("position", "cuboid", world, this.g3.m, 0, 0, gripper_f, r_d, 0.01, 0.05, 0.1);
        this.g2 = utils.addBody("position", "cuboid", world, this.g3.m, 0, 0, gripper_f, r_d, 0.01, 0.05, 0.1);
        this.g1.m.position.set(this.gripper_open_1, 0, this.g1.d/2+this.g3.d/2);
        this.g2.m.position.set(this.gripper_open_2, 0, this.g2.d/2+this.g3.d/2);

        this.g1_pad = utils.addBody("position", "cuboid", world, this.g1.m, 0, 0, gripper_f, r_d, 0.001, 0.05, 0.1, 0, 0, 0, 0xffffff);
        this.g2_pad = utils.addBody("position", "cuboid", world, this.g2.m, 0, 0, gripper_f, r_d, 0.001, 0.05, 0.1, 0, 0, 0, 0xffffff);
        this.g1_pad.m.position.set(0.01/2+0.001/2, 0, 0);
        this.g2_pad.m.position.set(-0.01/2-0.001/2, 0, 0);

        this.parts.push(this.base, this.mast, this.indicator, this.arm_base, this.shoulder,
            this.elbow, this.forearm, this.wrist, this.g3, this.g1, this.g2, this.g1_pad, this.g2_pad);
        for (let i in this.parts) {
            this.parts[i].c.is_robot = true;
            this.parts[i].c.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        }
        this.g1_pad.c.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
        this.g2_pad.c.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);

        this.g1.c.attached = true;
        this.g1_pad.c.attached = true;
        this.g2.c.attached = true;
        this.g2_pad.c.attached = true;

        let x = {x: 1.0, y: 0.0, z: 0.0};
        let y = {x: 0.0, y: 1.0, z: 0.0};
        let z = {x: 0.0, y: 0.0, z: 1.0};

        this.j0 = utils.fixedJoint(world, this.base, this.mast, 0, this.base.h/2, 0, 0, -this.mast.h/2, 0);
        this.ji = utils.fixedJoint(world, this.base, this.indicator, 0, this.base.h/2, this.base.w/2);
        this.j1 = utils.revoluteJoint(world, this.mast, this.arm_base, y, 0, 0, 0, -arm_w*0.75, 0, 0);
        this.j2 = utils.revoluteJoint(world, this.arm_base, this.shoulder, x, this.arm_base.w/2, 0, 0, -arm_w/2, 0, -this.shoulder.d/2);
        this.j3 = utils.revoluteJoint(world, this.shoulder, this.elbow, x,  -arm_w/2, 0, this.shoulder.d/2-arm_w/2,  arm_w/2, 0, -this.elbow.d/2);
        this.j4 = utils.revoluteJoint(world, this.elbow, this.forearm, z, 0, 0, this.elbow.d/2, 0, 0, -this.forearm.d/2);
        this.j5 = utils.revoluteJoint(world, this.forearm, this.wrist, x, arm_w/2, 0, this.forearm.d/2-arm_w/2, -arm_w/2, 0, -this.wrist.d/2);
        this.j6 = utils.revoluteJoint(world, this.wrist, this.g3, z, 0, 0, this.wrist.d/2, 0, 0, -this.g3.d/2);

        this.joints.push(this.j0, this.j1, this.j2, this.j3, this.j4, this.j5, this.j6);
        this.j1.setContactsEnabled(false);
        this.ji.setContactsEnabled(false);
    }

    updateModels() {

        for (let i in this.parts) {
            if (this.parts[i].c.attached) continue;

            this.parts[i].r.wakeUp();

            let q = this.parts[i].r.rotation();
            let q1 = new THREE.Quaternion();
            q1.set(q.x, q.y, q.z, q.w);

            let p = this.parts[i].r.translation();
            let p1 = new THREE.Vector3();
            p1.set(p.x, p.y, p.z);

            let m_body = new THREE.Matrix4();
            m_body.compose(p1, q1, new THREE.Vector3(1, 1, 1));

            let m_parent = this.parts[i].m.parent.matrixWorld.clone();
            m_parent.invert();
            m_parent.multiply(m_body);

            this.parts[i].m.position.set(0, 0, 0);
            this.parts[i].m.quaternion.set(0, 0, 0, 1);
            this.parts[i].m.scale.set(1, 1, 1);
            this.parts[i].m.applyMatrix4(m_parent);

            this.parts[i].m.updateWorldMatrix(true, true);
        }
    }

    resetGripperSensors() {
        this.g1_pad.c.touch = "off";
        this.g2_pad.c.touch = "off";
    }

    updateGripperState() {

        let gp1 = this.g1.m.position.clone();
        let gp2 = this.g2.m.position.clone();
        if (this.gripper_open) {
            if (gp1.x > this.gripper_open_1) {
                this.g1.m.position.set(gp1.x-this.gripper_s, gp1.y, gp1.z);
            }
            if (gp2.x < this.gripper_open_2) {
                this.g2.m.position.set(gp2.x+this.gripper_s, gp2.y, gp2.z);
            }
        } else {
            if (gp1.x < this.gripper_closed_1 && this.g1_pad.c.touch == "off") {
                this.g1.m.position.set(gp1.x+this.gripper_s, gp1.y, gp1.z);
            }
            if (gp2.x > this.gripper_closed_2 && this.g2_pad.c.touch == "off") {
                this.g2.m.position.set(gp2.x-this.gripper_s, gp2.y, gp2.z);
            }
        }

        this.updateRigidBody(this.g1);
        this.updateRigidBody(this.g1_pad);
        this.updateRigidBody(this.g2);
        this.updateRigidBody(this.g2_pad);
    }

    updateRigidBody(part) {
        let p = new THREE.Vector3();
        let q = new THREE.Quaternion();
        part.m.updateWorldMatrix(true, true);
        part.m.getWorldPosition(p);
        part.m.getWorldQuaternion(q);
        part.r.setNextKinematicTranslation({x: p.x, y: p.y, z: p.z}, true);
        part.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
        part.r.recomputeMassPropertiesFromColliders();
    }

    setPlatformTranslation(target_direction) {
        let d = target_direction.clone();
        d.applyQuaternion(this.base.m.quaternion);
        this.platform.setSlideEnabled(true);
        this.platform.computeColliderMovement(this.base.c, {x: d.x, y: d.y, z: d.z},
                0, -1, function(c) {return !c.is_robot;});
        let pt = this.platform.computedMovement();
        let T = this.base.r.translation();
        this.base.r.setNextKinematicTranslation({x: pt.x+T.x, y: pt.y+T.y, z: pt.z+T.z}, true);
    }

    setPlatformRotation(target_rotation) {
        this.base.r.recomputeMassPropertiesFromColliders();
        let R = this.base.r.rotation();
        let q = new THREE.Quaternion();
        q.set(R.x, R.y, R.z, R.w);
        q.rotateTowards(target_rotation, THREE.MathUtils.degToRad(1));
        this.base.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
    }

    setGripperTranslation(pointer_target) {
        let p = new THREE.Vector3();
        pointer_target.getWorldPosition(p);
        let gt = this.g3.r.translation();
        let t = {x: p.x-gt.x, y: p.y-gt.y, z: p.z-gt.z};
        this.gripper.computeColliderMovement(this.g3.c, t,
                0, -1, function(c) {return !(c.is_robot || c.ignore_controller);});
        let cm = this.gripper.computedMovement();
        this.g3.r.setNextKinematicTranslation({x: gt.x+cm.x, y: gt.y+cm.y, z: gt.z+cm.z}, true);
    }

    setGripperRotation(pointer_target) {
        this.g3.r.recomputeMassPropertiesFromColliders();
        let q = new THREE.Quaternion();
        pointer_target.getWorldQuaternion(q);
        this.g3.r.setNextKinematicRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
    }

    saveState() {
        for (let i in this.parts) {
            let q = this.parts[i].r.rotation();
            let q1 = new THREE.Quaternion();
            q1.set(q.x, q.y, q.z, q.w);
            let p = this.parts[i].r.translation();
            let p1 = new THREE.Vector3();
            p1.set(p.x, p.y, p.z);
            this.parts[i].lgt = p1;
            this.parts[i].lgr = q1;
            if (this.parts[i].t == "dynamic") this.parts[i].r.setBodyType(0);
        }
    }

    restoreState() {
        for (let i in this.parts) {
            if (this.parts[i].lgt && this.parts[i].lgr) {
                let p = this.parts[i].lgt.clone();
                let q = this.parts[i].lgr.clone();

                this.parts[i].r.setBodyType(2);
                this.parts[i].r.setTranslation({x: p.x, y: p.y, z: p.z}, true);
                this.parts[i].r.setRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);

                let z = new RAPIER.Vector3(0, 0, 0);

                this.parts[i].r.setAngvel(z, true);
                this.parts[i].r.setLinvel(z, true);
                this.parts[i].r.resetForces(true);
                this.parts[i].r.resetTorques(true);
                this.parts[i].r.recomputeMassPropertiesFromColliders();
            }
        }
    }

    checkContacts() {
        stop_arm_motion = false;
        for (let i in this.parts) {
            if (!this.parts[i].c.attached) continue;
            world.contactsWith(this.parts[i].c, (c2) => {
                if (!c2.is_robot && !c2.ignore_controller) {
                    if (this.parts[i].c.contactCollider(c2, 0.001)) {
                        console.log("stop_arm_motion", i, c2);
                        // stop_arm_motion = true;
                    }
                }
            });
        }
    }

    checkJoints() {

        for (let j in joints) {
            let a1 = joints[j].anchor1();
            let a2 = joints[j].anchor2();

            let p1 = new THREE.Vector3();
            p1.set(a1.x, a1.y, a1.z);
            let p2 = new THREE.Vector3();
            p2.set(a2.x, a2.y, a2.z);

            // console.log("joint L", j, p1, p2);

            let w1 = p1.clone();
            let w2 = p2.clone();

            joints[j].r1.m.localToWorld(w1);
            joints[j].r2.m.localToWorld(w2);

            if (Math.abs(w1.x-w2.x) > 0.01 ||
                Math.abs(w1.y-w2.y) > 0.01 ||
                Math.abs(w1.z-w2.z) > 0.01) {

                let p3 = new THREE.Vector3();
                let p4 = new THREE.Vector3();
                joints[j].r1.m.localToWorld(p3);
                joints[j].r2.m.localToWorld(p4);

                stop_arm_motion = true;
            }
        }
    }
}
