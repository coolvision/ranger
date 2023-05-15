
import * as THREE from 'three';
// import RAPIER from '../lib/rapier3d-compat';
import RAPIER from '../lib/rapier.es';
// import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';

export function addLink(type, v, c, world, scene, p, q) {

    let body_desc;
    if (type == "position") {
        body_desc = RAPIER.RigidBodyDesc.kinematicPositionBased();
    } else {
        body_desc = RAPIER.RigidBodyDesc.dynamic();
    }
    body_desc.setCanSleep(false);
    // body_desc.setCcdEnabled(true);

    let rigid_body = world.createRigidBody(body_desc);

    let link = c.parent.parent;
    let p1 = new THREE.Vector3();
    link.getWorldPosition(p1);
    let q1 = new THREE.Quaternion();
    link.getWorldQuaternion(q1);

    scene.add(c);
    c.position.copy(p1);
    c.quaternion.copy(q1);

    rigid_body.setTranslation({x: p1.x, y: p1.y, z: p1.z}, true);
    rigid_body.setRotation({w: q1.w, x: q1.x, y: q1.y, z: q1.z}, true);

    // let m = new THREE.Object3D();
    // m.position.copy(p1);
    // m.quaternion.copy(q1);
    // c.position.set(9, 0, 0);
    // c.quaternion.identity();
    // m.add(c);

    // rigid_body.setAdditionalMass(10);
    // rigid_body.setAdditionalMass(m);
    // rigid_body.setGravityScale(0);
    rigid_body.setAngularDamping(100);

    let collider_desc;
    let params = c.geometry.parameters;
    if (c.geometry.type == "BoxGeometry") {
        collider_desc = RAPIER.ColliderDesc.cuboid(params.width/2, params.height/2, params.depth/2)
            .setTranslation(p.x, p.y, p.z)
            .setRotation({ w: q.w, x: q.x, y: q.y, z: q.z });
    } else if (c.geometry.type == "SphereGeometry") {
        collider_desc = RAPIER.ColliderDesc.ball(params.radius)
            .setTranslation(p.x, p.y, p.z)
            .setRotation({ w: q.w, x: q.x, y: q.y, z: q.z });
    } else if (c.geometry.type == "CylinderGeometry") {

        let q1 = new THREE.Quaternion();
        q1.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI/2);
        q.multiply(q1);

        collider_desc = RAPIER.ColliderDesc.cylinder(params.height/2, params.radiusTop)
            .setTranslation(p.x, p.y, p.z)
            .setRotation({ w: q.w, x: q.x, y: q.y, z: q.z });
    } else {
        console.log("ColliderDesc.convexHull?");
        // collider_desc =
            // RAPIER.ColliderDesc.convexHull(c.geometry.attributes.position.array);
    }
    // collider_desc =
    //     RAPIER.ColliderDesc.convexHull(c.geometry.attributes.position.array)
    //         .setTranslation(p.x, p.y, p.z)
    //         .setRotation({ w: q.w, x: q.x, y: q.y, z: q.z });

    // if (f > 0) {
    //     collider_desc.setFriction(f)
    //     collider_desc.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max);
    // }

    // collider_desc.setFriction(10);
    // collider_desc.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max);

    let collider = world.createCollider(collider_desc, rigid_body);

    c.material = new THREE.MeshLambertMaterial({color: 0x333333});
    c.geometry.applyQuaternion(q);
    c.geometry.translate(p.x, p.y, p.z);

    // scene.add(c);
    // scene.add(v);

    return {
        r: rigid_body,
        c: collider,
        m: c,
        t: type,
        scale: c.scale.clone()
    }
}

export function updateLinks(r) {

    for (let i in r.links) {
        // if (this.parts[i].c.attached) continue;

        r.links[i].r.wakeUp();

        let q = r.links[i].r.rotation();
        let q1 = new THREE.Quaternion();
        q1.set(q.x, q.y, q.z, q.w);

        let p = r.links[i].r.translation();
        let p1 = new THREE.Vector3();
        p1.set(p.x, p.y, p.z);

        let m_body = new THREE.Matrix4();
        m_body.compose(p1, q1, new THREE.Vector3(1, 1, 1));

        let m_parent = r.links[i].m.parent.matrixWorld.clone();
        m_parent.invert();
        m_parent.multiply(m_body);

        r.links[i].m.position.set(0, 0, 0);
        r.links[i].m.quaternion.set(0, 0, 0, 1);
        r.links[i].m.scale.copy(r.links[i].scale);

        r.links[i].m.applyMatrix4(m_parent);

        r.links[i].m.updateWorldMatrix(true, true);
    }
}

export function updateLinks2(r) {

    for (let i in r.links) {
        r.links[i].r.wakeUp();

        r.links[i].m.updateWorldMatrix(true, true);

        let p = new THREE.Vector3();
        r.links[i].m.getWorldPosition(p);
        let q = new THREE.Quaternion();
        r.links[i].m.getWorldQuaternion(q);

        r.links[i].r.setTranslation({x: p.x, y: p.y, z: p.z}, true);
        r.links[i].r.setRotation({w: q.w, x: q.x, y: q.y, z: q.z}, true);
    }
}

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
