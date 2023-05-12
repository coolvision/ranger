
// 
// window.addEventListener('keydown', function(event) {
//
//     let update_position = false;
//     let update_rotation = false;
//
//     switch ( event.code ) {
//         case "KeyC":
//             control_trunk = !control_trunk;
//             if (!control_trunk) {
//                 a1_robot.links["trunk"].r.setBodyType(0);
//             } else {
//                 a1_robot.links["trunk"].r.setBodyType(2);
//             }
//             break;
//         case "KeyN":
//             robot.saveState();
//             break;
//         case "KeyM":
//             robot.restoreState();
//             break;
//         case "KeyT":
//             transform_ctrl.setMode('translate');
//             break;
//         case "KeyR":
//             transform_ctrl.setMode('rotate');
//             break;
//         case "KeyZ":
//             // controls.enableZoom = !controls.enableZoom;
//             world.step(eventQueue);
//             break;
//         case "KeyG":
//             robot.gripper_open = !robot.gripper_open;
//             break;
//         case "KeyW":
//             task("translation", 0.1);
//             break;
//         case "KeyS":
//             task("translation", -0.1);
//             break;
//         case "KeyA":
//             task("rotation", 5);
//             break;
//         case "KeyD":
//             task("rotation", -5);
//             update_rotation = true;
//             break;
//     }
//
// });
//
// function task(type, v) {
//     motion_task.done = false;
//     motion_task.type = type;
//     motion_task.v = v;
// }

// window.addEventListener('keyup', function(event) {
//     if (event.code == "KeyW" || event.code == "KeyS") {
//         target_direction.set(0, 0, 0);
//     }
//     if (event.code == "KeyA" || event.code == "KeyD") {
//         let R = robot.base.r.rotation();
//         target_rotation.set(R.x, R.y, R.z, R.w);
//     }
// });
//


// function connect() {
//     socket = new WebSocket("ws://localhost:8000/websocket");
//
//     socket.addEventListener("message", (event) => {
//         console.log(event.data,  JSON.parse(event.data));
//         let e = JSON.parse(event.data);
//
//         if (e.left) task("rotation", 1);
//         if (e.right) task("rotation", -1);
//         if (e.up) task("translation", 0.01);
//         if (e.down) task("translation", -0.01);
//
//         let t = 0.01;
//         if (e.g_left) task("g_translation", [t, 0, 0]);
//         if (e.g_right) task("g_translation", [-t, 0, 0]);
//         if (e.g_up) task("g_translation", [0, t, 0]);
//         if (e.g_down) task("g_translation", [0, -t, 0]);
//         if (e.g_fw) task("g_translation", [0, 0, t]);
//         if (e.g_bw) task("g_translation", [0, 0, -t]);
//
//         let a = THREE.MathUtils.degToRad(5);
//         if (e.g_yaw1) task("g_rotation", [a, 0, 0]);
//         if (e.g_yaw2) task("g_rotation", [-a, 0, 0]);
//         if (e.g_pitch1) task("g_rotation", [0, -a, 0]);
//         if (e.g_pitch2) task("g_rotation", [0, a, 0]);
//         if (e.g_roll1) task("g_rotation", [0, 0, -a]);
//         if (e.g_roll2) task("g_rotation", [0, 0, a]);
//
//         if (e.gripper_toggle) robot.gripper_open = !robot.gripper_open;
//
//     });
//     socket.addEventListener("close", (event) => {
//         console.log(event);
//         setTimeout(function() {
//             connect();
//         }, 1000);
//     });
//     socket.addEventListener("close", (event) => {
//         console.log(event);
//         socket.close();
//     });
// }
// connect();
