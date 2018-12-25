import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';

const onContentLoaded = () => {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const fpsLabel = document.getElementById("fpsLabel");

  // Handle window resize events, with high DPI display support
  const resize = () => {
    const desiredWidth = window.innerWidth;
    const desiredHeight = window.innerHeight;
    const devicePixelRatio = 1; // window.devicePixelRatio || 1;
    canvas.style.width = `${desiredWidth}px`;
    canvas.style.height = `${desiredHeight}px`;
    canvas.width = desiredWidth * devicePixelRatio;
    canvas.height = desiredHeight * devicePixelRatio;
  };

  const createScene = function(engine: BABYLON.Engine) {
    const sceneState = {
      animatingBox: false
    };

    const scene = new BABYLON.Scene(engine);

    // Create a simple camera, looking over the scene
    const camera = new BABYLON.UniversalCamera("camera", new BABYLON.Vector3(-3, 5, -7), scene);
    camera.setTarget(BABYLON.Vector3.Zero());

    // Create a basic light, aiming 0, 1, 0 - meaning, to the sky
    const ambientLight = new BABYLON.HemisphericLight('ambientLight', new BABYLON.Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.3;

    // Non-specular material for ground plane
    const groundMaterial = new BABYLON.StandardMaterial("groundMaterial", scene);
    groundMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
    groundMaterial.specularColor = new BABYLON.Color3(0, 0, 0);

    // Create a ground plane that will receive shadows
    const groundPlane = BABYLON.Mesh.CreateGround('groundPlane', 12, 6, 2, scene, false);
    groundPlane.material = groundMaterial;
    groundPlane.receiveShadows = true;

    // Colored material for box
    const boxMaterial = new BABYLON.StandardMaterial("boxMaterial", scene);
    boxMaterial.diffuseColor = new BABYLON.Color3(1, 0, 1);
    boxMaterial.specularColor = new BABYLON.Color3(0.5, 0.6, 0.87);

    // Rottation gizmo
    var gizmo = BABYLON.Mesh.CreateSphere('gizmo', 6, 0.1, scene);
    // gizmo.position = sceneState.position;
    gizmo.visibility = 0;

    // Box that will cast shadows
    const box = BABYLON.Mesh.CreateBox('box', 1, scene);
    box.parent = gizmo;
    box.position.y += 0.5;
    box.material = boxMaterial;

    // Point light for casting shadows from the box
    const pointLight1 = new BABYLON.PointLight('pointLight1', new BABYLON.Vector3(-3, 2, -1), scene);
    pointLight1.intensity = 0.4;
    pointLight1.shadowEnabled = true;
    pointLight1.includedOnlyMeshes = [groundPlane];

    // Point light for the lighting the box
    const pointLight2 = new BABYLON.PointLight('pointLight2', new BABYLON.Vector3(-3, 2, -1), scene);
    pointLight2.intensity = 0.4;
    pointLight2.includedOnlyMeshes = [box];

    // Use shadow generator to cast shadows from box on to ground plane
    const shadowGenerator = new BABYLON.ShadowGenerator(1024, pointLight1);
    shadowGenerator.getShadowMap().renderList.push(box);

    // Define an animation for rotation about the X axis
    const rotationX = new BABYLON.Animation("rotationX", "rotation.x", 60,
      BABYLON.Animation.ANIMATIONTYPE_FLOAT,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    // Define an animation for rotation about the Z axis
    const rotationZ = new BABYLON.Animation("rotationZ", "rotation.z", 60,
      BABYLON.Animation.ANIMATIONTYPE_FLOAT,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const moveLeft = () => {
      if (!sceneState.animatingBox) {
        sceneState.animatingBox = true;
        gizmo.position.x -= 0.5;  // Move gizmo to bottom left edge of box
        box.position.x = 0.5;     // Change relative position of box, so that it does move
        rotationZ.setKeys([
          {frame: 0, value: 0},
          {frame: 30, value: Math.PI / 2}
        ]);
        gizmo.animations.push(rotationZ);
        scene.beginAnimation(gizmo, 0, 30, false, 1, () => {
          sceneState.animatingBox = false;
          gizmo.animations.pop();
          gizmo.position.x -= 0.5;  // Move gizmo to center of new tile
          gizmo.rotation.z = 0;     // Reset rotation of gizmo, so that axis are consistent
          box.position.x = 0;       // Reset position of box, relative to gizmo
        });
      }
    };

    const moveRight = () => {
      if (!sceneState.animatingBox) {
        sceneState.animatingBox = true;
        gizmo.position.x += 0.5;  // Move gizmo to bottom right edge of box
        box.position.x = -0.5;
        rotationZ.setKeys([
          {frame: 0, value: 0},
          {frame: 30, value: -Math.PI / 2}
        ]);
        gizmo.animations.push(rotationZ);
        scene.beginAnimation(gizmo, 0, 30, false, 1, () => {
          sceneState.animatingBox = false;
          gizmo.animations.pop();
          gizmo.position.x += 0.5;
          gizmo.rotation.z = 0;
          box.position.x = 0;
        })
      }
    };

    const moveDown = () => {
      if (!sceneState.animatingBox) {
        sceneState.animatingBox = true;
        gizmo.position.z -= 0.5;
        box.position.z = 0.5;
        rotationX.setKeys([
          {frame: 0, value: 0},
          {frame: 30, value: -Math.PI / 2}
        ]);
        gizmo.animations.push(rotationX);
        scene.beginAnimation(gizmo, 0, 30, false, 1, () => {
          sceneState.animatingBox = false;
          gizmo.animations.pop();
          gizmo.position.z -= 0.5;  // Move gizmo to center of new tile
          gizmo.rotation.x = 0;     // Reset rotation of gizmo, so that axis are consistent
          box.position.z = 0;       // Reset position of box, relative to gizmo
        });
      }
    }

    const moveUp = () => {
      if (!sceneState.animatingBox) {
        sceneState.animatingBox = true;
        gizmo.position.z += 0.5;
        box.position.z = -0.5;
        rotationX.setKeys([
          {frame: 0, value: 0},
          {frame: 30, value: Math.PI / 2}
        ]);
        gizmo.animations.push(rotationX);
        scene.beginAnimation(gizmo, 0, 30, false, 1, () => {
          sceneState.animatingBox = false;
          gizmo.animations.pop();
          gizmo.position.z += 0.5;
          gizmo.rotation.x = 0;
          box.position.z = 0;
        });
      }
    };

    scene.onKeyboardObservable.add((kbInfo) => {
      if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
        switch (kbInfo.event.key) {
          case 'ArrowDown':
            moveDown();
            break;
          case 'ArrowUp':
            moveUp();
            break;
          case 'ArrowLeft':
            moveLeft();
            break;
          case 'ArrowRight':
            moveRight();
            break;
        }
      }
    });

    return scene;
  };

  const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true
  });

  const scene = createScene(engine);

  // Update FPS counter once per second
  setInterval(() => {
    fpsLabel.innerHTML = engine.getFps().toFixed() + " fps";
  }, 1000);

  engine.runRenderLoop(() => {
    scene.render();
  });

  window.addEventListener('resize', resize);
  resize();
};

document.addEventListener('DOMContentLoaded', onContentLoaded);
