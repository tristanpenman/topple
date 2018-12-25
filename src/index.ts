import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';

type Axis = 'x' | 'y' | 'z';

interface SceneState {
  animatingBox: boolean;
  boxOrientation: Axis;
  boxPosition: BABYLON.Vector2;
}

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
    const sceneState: SceneState = {
      animatingBox: false,
      boxOrientation: 'y',
      boxPosition: new BABYLON.Vector2(0, 0)
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
    gizmo.visibility = 0;

    // Box that will cast shadows
    const box = BABYLON.Mesh.CreateBox('box', 1, scene);
    box.parent = gizmo;
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
    shadowGenerator.forceBackFacesOnly = true;
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

    const resetTransformations = () => {
      gizmo.position = new BABYLON.Vector3(sceneState.boxPosition.x, 0.0, sceneState.boxPosition.y);
      gizmo.rotation = new BABYLON.Vector3();
      if (sceneState.boxOrientation === 'x') {
        box.scaling = new BABYLON.Vector3(2.0, 1.0, 1.0);
        box.position.x = 0;
        box.position.y = 0.5;
        box.position.z = 0;
      } else if (sceneState.boxOrientation === 'y') {
        box.scaling = new BABYLON.Vector3(1.0, 2.0, 1.0);
        box.position.x = 0;
        box.position.y = 1.0;
        box.position.z = 0;
      } else {
        box.scaling = new BABYLON.Vector3(1.0, 1.0, 2.0);
        box.position.x = 0;
        box.position.y = 0.5;
        box.position.z = 0;
      }
    };

    const moveGizmoToXMin = () => {
      if (sceneState.boxOrientation === 'x') {
        gizmo.position.x -= 1.0;
        box.position.x = 1.0;
      } else {
        gizmo.position.x -= 0.5;
        box.position.x = 0.5;
      }
    };

    const moveLeftComplete = () => {
      if (sceneState.boxOrientation === 'x') {
        sceneState.boxOrientation = 'y';
        sceneState.boxPosition.x -= 1.5;
      } else if (sceneState.boxOrientation === 'y') {
        sceneState.boxOrientation = 'x';
        sceneState.boxPosition.x -= 1.5;
      } else {
        sceneState.boxPosition.x -= 1;
      }
    };

    const moveLeft = () => {
      if (!sceneState.animatingBox) {
        sceneState.animatingBox = true;
        moveGizmoToXMin();
        rotationZ.setKeys([
          {frame: 0, value: 0},
          {frame: 30, value: Math.PI / 2}
        ]);
        gizmo.animations.push(rotationZ);
        scene.beginAnimation(gizmo, 0, 30, false, 1, () => {
          sceneState.animatingBox = false;
          gizmo.animations.pop();
          moveLeftComplete();
          resetTransformations();
        });
      }
    };

    const moveGizmoToXMax = () => {
      if (sceneState.boxOrientation === 'x') {
        gizmo.position.x += 1.0;
        box.position.x = -1.0;
      } else {
        gizmo.position.x += 0.5;
        box.position.x -= 0.5;
      }
    }

    const moveRightComplete = () => {
      if (sceneState.boxOrientation === 'x') {
        sceneState.boxOrientation = 'y';
        sceneState.boxPosition.x += 1.5;
      } else if (sceneState.boxOrientation === 'y') {
        sceneState.boxOrientation = 'x';
        sceneState.boxPosition.x += 1.5;
      } else {
        sceneState.boxPosition.x += 1.0;
      }
    };

    const moveRight = () => {
      if (!sceneState.animatingBox) {
        sceneState.animatingBox = true;
        moveGizmoToXMax();
        rotationZ.setKeys([
          {frame: 0, value: 0},
          {frame: 30, value: -Math.PI / 2}
        ]);
        gizmo.animations.push(rotationZ);
        scene.beginAnimation(gizmo, 0, 30, false, 1, () => {
          sceneState.animatingBox = false;
          gizmo.animations.pop();
          moveRightComplete();
          resetTransformations();
        })
      }
    };

    const moveGizmoToYMin = () => {
      if (sceneState.boxOrientation === 'z') {
        gizmo.position.z -= 1.0;
        box.position.z = 1.0;
      } else {
        gizmo.position.z -= 0.5;
        box.position.z = 0.5;
      }
    };

    const moveDownComplete = () => {
      if (sceneState.boxOrientation === 'y') {
        sceneState.boxOrientation = 'z';
        sceneState.boxPosition.y -= 1.5;
      } else if (sceneState.boxOrientation === 'z') {
        sceneState.boxOrientation = 'y';
        sceneState.boxPosition.y -= 1.5;
      } else {
        sceneState.boxPosition.y -= 1.0;
      }
    }

    const moveDown = () => {
      if (!sceneState.animatingBox) {
        sceneState.animatingBox = true;
        moveGizmoToYMin();
        rotationX.setKeys([
          {frame: 0, value: 0},
          {frame: 30, value: -Math.PI / 2}
        ]);
        gizmo.animations.push(rotationX);
        scene.beginAnimation(gizmo, 0, 30, false, 1, () => {
          sceneState.animatingBox = false;
          gizmo.animations.pop();
          moveDownComplete();
          resetTransformations();
        });
      }
    }

    const moveGizmoToYMax = () => {
      if (sceneState.boxOrientation === 'z') {
        gizmo.position.z += 1.0;
        box.position.z = -1.0;
      } else {
        gizmo.position.z += 0.5;
        box.position.z = -0.5;
      }
    };

    const moveUpComplete = () => {
      if (sceneState.boxOrientation === 'y') {
        sceneState.boxOrientation = 'z';
        sceneState.boxPosition.y += 1.5;
      } else if (sceneState.boxOrientation === 'z') {
        sceneState.boxOrientation = 'y';
        sceneState.boxPosition.y += 1.5;
      } else {
        sceneState.boxPosition.y += 1.0;
      }
    };

    const moveUp = () => {
      if (!sceneState.animatingBox) {
        sceneState.animatingBox = true;
        moveGizmoToYMax();
        rotationX.setKeys([
          {frame: 0, value: 0},
          {frame: 30, value: Math.PI / 2}
        ]);
        gizmo.animations.push(rotationX);
        scene.beginAnimation(gizmo, 0, 30, false, 1, () => {
          sceneState.animatingBox = false;
          gizmo.animations.pop();
          moveUpComplete();
          resetTransformations();
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

    resetTransformations();

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
