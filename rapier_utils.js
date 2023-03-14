
import * as THREE from 'three';
import RAPIER from './rapier3d-compat';

export function getColliderDesc(world, scene, f, width, height, depth, color=0x333333) {

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

export function addBody(type, shape, world, scene, g, m, f, d,
    width, height, depth, x=0, y=0, z=0, color=0x333333) {

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

export function fixedJoint(world, r1, r2, x1=0, y1=0, z1=0, x2=0, y2=0, z2=0) {
    let j = world.createImpulseJoint(RAPIER.JointData.fixed(
            {x: x1, y: y1, z: z1}, {w: 1.0, x: 0.0, y: 0.0, z: 0.0},
            {x: x2, y: y2, z: z2}, {w: 1.0, x: 0.0, y: 0.0, z: 0.0}), r1.r, r2.r, true);
    j.r1 = r1;
    j.r2 = r2;
    return j;
}

export function revoluteJoint(world, r1, r2, axis, x1=0, y1=0, z1=0, x2=0, y2=0, z2=0) {
    let j = world.createImpulseJoint(RAPIER.JointData.revolute(
        {x: x1, y: y1, z: z1}, {x: x2, y: y2, z: z2}, axis), r1.r, r2.r, true);
    j.r1 = r1;
    j.r2 = r2;
    return j;
}
