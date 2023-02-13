
import * as THREE from 'three';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';

let container;
let camera, scene, renderer;
const splineHelperObjects = [];
let splinePointsLength = 4;
const positions = [];
const point = new THREE.Vector3();

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const onUpPosition = new THREE.Vector2();
const onDownPosition = new THREE.Vector2();

const geometry = new THREE.BoxGeometry( 20, 20, 20 );
let transform_ctrl;

let world;
let boxes = [];
// let spheres = [];
let gripper = [];

const matrix = new THREE.Matrix4();
const color = new THREE.Color();

await init();

async function init() {

    container = document.getElementById( 'app' );

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0xf0f0f0 );

//==============================================================================
    await RAPIER.init();
    let gravity = {x: 0.0, y: -9.81, z: 0.0};
    world = new RAPIER.World(gravity);

    // Create the ground
    let groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 1, 10.0)
        .setTranslation(0, -1, 0)
    world.createCollider(groundColliderDesc);

    let size = 0.5
    const geometryBox = new THREE.BoxGeometry(size, size, size);
    for (let i = 0; i < 100; i++) {
        let material = new THREE.MeshLambertMaterial();
        let box = new THREE.Mesh(geometryBox, material);

        box.position.set(Math.random() - 0.5, Math.random() * 2, Math.random() - 0.5);
        box.position.multiplyScalar(5);
        box.material.color.setHex(0xffffff * Math.random());

        let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(box.position.x, box.position.y, box.position.z);
        let rigidBody = world.createRigidBody(rigidBodyDesc);
        let colliderDesc = RAPIER.ColliderDesc.cuboid(size/2, size/2, size/2);
        let collider = world.createCollider(colliderDesc, rigidBody);

        box.rigidBody = rigidBody;

        scene.add(box);
        boxes.push(box);
    }

    let gripperGeometry1 = new THREE.BoxGeometry(0.1, 0.5, 1);
    let material = new THREE.MeshLambertMaterial();
    let g = new THREE.Mesh(gripperGeometry1, material);
    g.position.set(0, 2, 0);
    g.material.color.setHex(0x555555);
    gripper.push(g);
    scene.add(g);
//==============================================================================


    camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.1, 100 );
    camera.position.set( 0, 5, 5 );
    scene.add( camera );

    scene.add( new THREE.AmbientLight( 0xf0f0f0 ) );
    const light = new THREE.SpotLight( 0xffffff, 1.5 );
    light.position.set( 0, 15, 2 );
    light.angle = Math.PI * 0.2;
    light.castShadow = true;
    light.shadow.camera.near = 2;
    light.shadow.camera.far = 20;
    light.shadow.bias = - 0.000222;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    scene.add( light );

    const planeGeometry = new THREE.PlaneGeometry( 20, 20 );
    planeGeometry.rotateX( - Math.PI / 2 );
    const planeMaterial = new THREE.ShadowMaterial( { color: 0x000000, opacity: 0.2 } );

    const plane = new THREE.Mesh( planeGeometry, planeMaterial );
    plane.position.y = - 2;
    plane.receiveShadow = true;
    scene.add( plane );

    const helper = new THREE.GridHelper( 20, 20 );
    // helper.position.y = - 1.99;
    helper.material.opacity = 0.25;
    helper.material.transparent = true;
    scene.add( helper );

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMap.enabled = true;
    container.appendChild( renderer.domElement );

    // Controls
    const controls = new OrbitControls( camera, renderer.domElement );
    controls.damping = 0.2;
    controls.addEventListener( 'change', render );

    transform_ctrl = new TransformControls(camera, renderer.domElement);
    transform_ctrl.addEventListener('change', render);
    transform_ctrl.addEventListener('dragging-changed', function (event) {
        controls.enabled = ! event.value;
    });
    transform_ctrl.attach(g);
    scene.add(transform_ctrl);


    renderer.setAnimationLoop(render);
}

function render() {

    world.step();

    for (let i = 0; i < boxes.length; i++) {
        let p = boxes[i].rigidBody.translation();
        let q = boxes[i].rigidBody.rotation();

        boxes[i].position.set(p.x, p.y, p.z);
        boxes[i].quaternion.set(q.x, q.y, q.z, q.w);
    }

    renderer.render(scene, camera);

}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    render();
}
