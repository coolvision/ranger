
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import Stats from '../lib/stats.module';
// import { render } from './main.js';

export var camera;
export var scene;
export var renderer;
export var stats;
export var controls;

let clock = new THREE.Clock();
let delta = 0;
let interval = 1 / 60;
export function update_fn(f) {
    let update = function() {
        requestAnimationFrame(update);
        delta += clock.getDelta();
        if (delta  > interval) {
           f();
           delta = delta % interval;
        }
    }
    return update;
}

export function add_controls(camera, renderer, scene, target) {

    let transform_ctrl = new TransformControls(camera, renderer.domElement);
    // transform_ctrl.addEventListener('change', render);
    transform_ctrl.addEventListener('dragging-changed', function (event) {
        controls.enabled = ! event.value;
    });
    transform_ctrl.size = 0.5;
    transform_ctrl.setSpace("local");
    transform_ctrl.attach(target);
    scene.add(transform_ctrl);
    return transform_ctrl;
}

export function scene_setup() {

    let container = document.querySelector('body');

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    let w = window.visualViewport.width;
    let h = window.visualViewport.height;
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    window.addEventListener('resize', function() {
        let w = window.visualViewport.width;
        let h = window.visualViewport.height;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        // render();
    });

    scene = new THREE.Scene();
    // scene.background = new THREE.Color(0xf0f0f0);
	scene.background = new THREE.Color(0x999999);

    // camera = new THREE.PerspectiveCamera(70, w / h, 0.1, 100);
    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 1.5, 2.2);
    scene.add(camera);

    stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);
}

export function env_setup() {

    scene.add(new THREE.AmbientLight(0xf0f0f0));
    const light = new THREE.SpotLight(0xffffff, 1.5);
    light.position.set(0, 15, 2);
    light.angle = Math.PI * 0.2;
    light.castShadow = true;
    light.shadow.camera.near = 2;
    light.shadow.camera.far = 20;
    light.shadow.bias = - 0.000222;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    scene.add(light);

    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    planeGeometry.rotateX(- Math.PI / 2);
    const planeMaterial = new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.2});

    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    // plane.position.y = - 2;
    plane.receiveShadow = true;
    scene.add( plane );;

    const helper = new THREE.GridHelper(20, 20);
    helper.material.opacity = 0.25;
    helper.material.transparent = true;
    scene.add( helper );

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.damping = 0.2;
    // controls.addEventListener('change', render);

    const axesHelper = new THREE.AxesHelper(1);
    scene.add(axesHelper);
}
