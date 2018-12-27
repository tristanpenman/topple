import * as BABYLON from 'babylonjs';
import { cloneDeep } from 'lodash';

type Axis = 'x' | 'y' | 'z';

type Tile = 0 | 1;

type Grid = Tile[][];

interface Level {
  initialOrientation: Axis;
  initialTile: BABYLON.Vector2;
  grid: Grid;
}

interface SceneState {
  animating: boolean;
  blockOrientation: Axis;
  blockPosition: BABYLON.Vector2;
  grid: Grid;
}

const level: Level = {
  initialOrientation: 'x',
  initialTile: new BABYLON.Vector2(2, 2),
  grid: [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0]
  ]
};

const onContentLoaded = () => {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const fpsLabel = document.getElementById("fpsLabel");

  // Handle window resize events, with high DPI display support
  const resize = () => {
    const desiredWidth = window.innerWidth;
    const desiredHeight = window.innerHeight;
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.style.width = `${desiredWidth}px`;
    canvas.style.height = `${desiredHeight}px`;
    canvas.width = desiredWidth * devicePixelRatio;
    canvas.height = desiredHeight * devicePixelRatio;
  };

  const findExtents = (grid: Grid) => {
    const lengths = grid.map(row => {
      const index = row.lastIndexOf(1);
      return index === -1 ? row.length : index + 1;
    });

    const depth = grid.map(row => row.some(cell => cell === 1)).lastIndexOf(true);

    return {
      width: Math.max(...lengths),
      depth: depth === -1 ? grid.length : depth + 1
    };
  };

  const createScene = function(engine: BABYLON.Engine, level: Level) {
    // Calculate position of block based on effective size of the grid, adopting the convention
    // that tile (0, 0) is the furthest and left-most tile on the player's screen
    const extents = findExtents(level.grid);
    const blockPosition = new BABYLON.Vector2(
      Math.round(level.initialTile.x) - extents.width / 2 + 0.5,
      extents.depth / 2 - Math.round(level.initialTile.y) - 0.5
    );

    // Adjust position depending on orientation of the block
    if (level.initialOrientation === 'x') {
      blockPosition.x += 0.5;
    } else if (level.initialOrientation === 'z') {
      blockPosition.y += 0.5;
    }

    const sceneState: SceneState = {
      animating: false,
      blockOrientation: level.initialOrientation,
      blockPosition,
      grid: cloneDeep(level.grid)
    };

    const scene = new BABYLON.Scene(engine);
    const gravityVector = new BABYLON.Vector3(0, -9.81, 0);
    const physicsPlugin = new BABYLON.CannonJSPlugin();
    scene.enablePhysics(gravityVector, physicsPlugin);

    // Create a simple camera, looking over the scene
    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 1.5, Math.PI / 4, 10, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, false);
    camera.inputs.remove(camera.inputs.attached.keyboard);

    // Create a basic light, aiming 0, 1, 0 - meaning, to the sky
    const ambientLight = new BABYLON.HemisphericLight('ambientLight', new BABYLON.Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.3;

    // Non-specular material for tiles
    const tileMaterial = new BABYLON.StandardMaterial("tileMaterial", scene);
    tileMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
    tileMaterial.specularColor = new BABYLON.Color3(0, 0, 0);

    const blueMaterial = new BABYLON.StandardMaterial("blueMaterial", scene);
    blueMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.6, 1);
    blueMaterial.specularColor = new BABYLON.Color3(0, 0, 0);

    const greyShape = {width: 1, depth: 1, height: 0.1};
    const blueShape = {width: 1, depth: 1, height: 0.08};
    const tileMeshes: BABYLON.Mesh[] = [];
    level.grid.forEach((row, rowIndex) => {
      row.forEach((cell, cellIndex) => {
        const name = `tile[row=${rowIndex},col=${cellIndex}`;
        if (cell === 1) {
          const tileMesh = BABYLON.MeshBuilder.CreateBox(name, greyShape, scene);
          tileMesh.receiveShadows = true;
          tileMesh.position.x = cellIndex - extents.width / 2 + 0.5;
          tileMesh.position.z = extents.depth / 2 - rowIndex - 0.5;
          tileMesh.position.y = -0.05;
          tileMesh.material = tileMaterial;
          tileMeshes.push(tileMesh);
        } else {
          const tileMesh = BABYLON.MeshBuilder.CreateBox(name, blueShape, scene);
          tileMesh.receiveShadows = true;
          tileMesh.position.x = cellIndex - extents.width / 2 + 0.5;
          tileMesh.position.z = extents.depth / 2 - rowIndex - 0.5;
          tileMesh.position.y = -0.06;
          tileMesh.material = blueMaterial;
          tileMeshes.push(tileMesh);
        }
      });
    });

    // Colored material for block
    const blockMaterial = new BABYLON.StandardMaterial("blockMaterial", scene);
    blockMaterial.diffuseColor = new BABYLON.Color3(0.8, 0.3, 1);
    blockMaterial.specularColor = new BABYLON.Color3(0.5, 0.6, 0.87);

    // Rottation gizmo
    var gizmo = BABYLON.Mesh.CreateSphere('gizmo', 6, 0.1, scene);
    gizmo.visibility = 0;

    // Block, which will cast shadows
    const blockMesh = BABYLON.Mesh.CreateBox('blockMesh', 1, scene);
    blockMesh.parent = gizmo;
    blockMesh.material = blockMaterial;

    // Point light for casting shadows from the block
    const pointLight1 = new BABYLON.PointLight('pointLight1', new BABYLON.Vector3(-3, 2, -1), scene);
    pointLight1.intensity = 0.4;
    pointLight1.shadowEnabled = true;
    pointLight1.includedOnlyMeshes = tileMeshes;

    // Define an animation for rotation about the X axis
    const rotationX = new BABYLON.Animation("rotationX", "rotation.x", 120,
      BABYLON.Animation.ANIMATIONTYPE_FLOAT,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    // Define an animation for rotation about the Z axis
    const rotationZ = new BABYLON.Animation("rotationZ", "rotation.z", 120,
      BABYLON.Animation.ANIMATIONTYPE_FLOAT,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    // Create a mesh that will act as the parent for all of the individual pieces
    const piecesMesh = BABYLON.Mesh.CreateSphere('piecesMesh', 6, 0.1, scene);
    piecesMesh.parent = gizmo;
    piecesMesh.position.y += 0.5;
    piecesMesh.visibility = 0;
    piecesMesh.setEnabled(false);

    // Create the first piece
    const piecesPerUnit = 2;
    const piece = BABYLON.Mesh.CreateBox(`piece`, 1.0 / piecesPerUnit, scene);
    piece.parent = piecesMesh;
    piece.material = blockMaterial;
    piece.position.x = -0.75;
    piece.position.y = -0.25;
    piece.position.z = -0.25;

    // Create the remaining pieces as instances of the mesh for the first piece
    const pieceInstances: BABYLON.InstancedMesh[] = [];
    for (var x = 0; x < piecesPerUnit * 2; x++) {
      for (var y = 0; y < piecesPerUnit; y++) {
        for (var z = 0; z < piecesPerUnit; z++) {
          if (x > 0 || y > 0 || z > 0) {
            const pieceInstance = piece.createInstance(`pieceInstance[x=${x},y=${y},z=${z}]`);
            pieceInstance.parent = piecesMesh;
            pieceInstance.position.x = (x - piecesPerUnit) / piecesPerUnit + 0.25;
            pieceInstance.position.y = y / piecesPerUnit - 0.25;
            pieceInstance.position.z = (z - piecesPerUnit) / piecesPerUnit + 0.75;
            pieceInstances.push(pieceInstance);
          }
        }
      }
    }

    // Use shadow generator to cast shadows from block/piece meshes on to tiles
    const shadowGenerator = new BABYLON.ShadowGenerator(1024, pointLight1);
    shadowGenerator.forceBackFacesOnly = true;
    shadowGenerator.getShadowMap().renderList.push(...pieceInstances, piece, blockMesh);

    // Point light for the lighting the block and piece meshes
    const pointLight2 = new BABYLON.PointLight('pointLight2', new BABYLON.Vector3(-3, 2, -1), scene);
    pointLight2.intensity = 0.4;
    pointLight2.includedOnlyMeshes = [...pieceInstances, piece, blockMesh];

    // Create static physics objects for each of the tiles (saves time later)
    tileMeshes.forEach(tileMesh => {
      tileMesh.physicsImpostor = new BABYLON.PhysicsImpostor(tileMesh, BABYLON.PhysicsImpostor.BoxImpostor, {
        mass: 0
      }, scene);
    });

    const explode = (mesh: BABYLON.AbstractMesh, alpha: number, beta: number, delta: number, scale: number) => {
      // Calculate force to apply, using _alpha_ to weight the force along the Y axis, and _beta_
      // to modulate some random jitter that is applied on the X axis and Z axis. This value is
      // normalised before finally being scaled by _scale_.
      const force = mesh.position.clone();
      force.x += (Math.random() - 0.5) * beta;
      force.y += alpha;
      force.z += (Math.random() - 0.5) * beta;
      force.normalize().scaleInPlace(scale);

      // Calculate the contact point, using _delta_ to weight how much the position of the mesh in
      // its local coordinate system should affect the position of the contact point.
      const contactPoint = mesh.getAbsolutePosition();
      contactPoint.x += mesh.position.x * delta;
      contactPoint.z += mesh.position.z * delta;

      mesh.applyImpulse(force, contactPoint);
    };

    const explodeBlock = () => {
      // Swap solid block for individual pieces
      piecesMesh.setEnabled(true);
      blockMesh.setEnabled(false);

      // Create a physics object for the first piece, ignoring the position of it's parent
      piece.physicsImpostor = new BABYLON.PhysicsImpostor(piece, BABYLON.PhysicsImpostor.BoxImpostor, {
        mass: 1,
        friction: 0.4,
        restitution: 0.5,
        ignoreParent: true
      }, scene);

      // Clone that physics imposter for the remaining pieces
      pieceInstances.forEach(pieceInstance => {
        pieceInstance.physicsImpostor = piece.physicsImpostor.clone(pieceInstance)
      });

      // Explosion characteristics
      const alpha = 6;
      const beta = sceneState.blockOrientation === 'y' ? 8 : 4;
      const delta = -0.5;
      const scaleBase = 5;
      const scaleVariability = 3;

      // Apply an explosive impulse to the first piece
      explode(piece, alpha, beta, delta, scaleBase + scaleVariability * Math.random());

      // And do so for the remaining pieces
      pieceInstances.forEach(pieceInstance => {
        explode(pieceInstance, alpha, beta, delta, scaleBase + scaleVariability * Math.random());
      });

      // TODO: Animate transparency
    };

    const checkBlock = () => {
      // TODO: Check block position before exploding it
      explodeBlock();
    }

    const resetTransformations = () => {
      gizmo.position = new BABYLON.Vector3(sceneState.blockPosition.x, 0.0, sceneState.blockPosition.y);
      gizmo.rotation = new BABYLON.Vector3();
      if (sceneState.blockOrientation === 'x') {
        blockMesh.scaling = new BABYLON.Vector3(2.0, 1.0, 1.0);
        blockMesh.position.x = 0;
        blockMesh.position.y = 0.5;
        blockMesh.position.z = 0;
      } else if (sceneState.blockOrientation === 'y') {
        blockMesh.scaling = new BABYLON.Vector3(1.0, 2.0, 1.0);
        blockMesh.position.x = 0;
        blockMesh.position.y = 1.0;
        blockMesh.position.z = 0;
      } else {
        blockMesh.scaling = new BABYLON.Vector3(1.0, 1.0, 2.0);
        blockMesh.position.x = 0;
        blockMesh.position.y = 0.5;
        blockMesh.position.z = 0;
      }
    };

    const moveGizmoToXMin = () => {
      if (sceneState.blockOrientation === 'x') {
        gizmo.position.x -= 1.0;
        blockMesh.position.x = 1.0;
      } else {
        gizmo.position.x -= 0.5;
        blockMesh.position.x = 0.5;
      }
    };

    const moveLeftComplete = () => {
      if (sceneState.blockOrientation === 'x') {
        sceneState.blockOrientation = 'y';
        sceneState.blockPosition.x -= 1.5;
      } else if (sceneState.blockOrientation === 'y') {
        sceneState.blockOrientation = 'x';
        sceneState.blockPosition.x -= 1.5;
      } else {
        sceneState.blockPosition.x -= 1;
      }
    };

    const moveLeft = () => {
      if (!sceneState.animating) {
        sceneState.animating = true;
        moveGizmoToXMin();
        rotationZ.setKeys([
          {frame: 0, value: 0},
          {frame: 30, value: Math.PI / 2}
        ]);
        gizmo.animations.push(rotationZ);
        scene.beginAnimation(gizmo, 0, 30, false, 1, () => {
          sceneState.animating = false;
          gizmo.animations.pop();
          moveLeftComplete();
          resetTransformations();
          checkBlock();
        });
      }
    };

    const moveGizmoToXMax = () => {
      if (sceneState.blockOrientation === 'x') {
        gizmo.position.x += 1.0;
        blockMesh.position.x = -1.0;
      } else {
        gizmo.position.x += 0.5;
        blockMesh.position.x -= 0.5;
      }
    }

    const moveRightComplete = () => {
      if (sceneState.blockOrientation === 'x') {
        sceneState.blockOrientation = 'y';
        sceneState.blockPosition.x += 1.5;
      } else if (sceneState.blockOrientation === 'y') {
        sceneState.blockOrientation = 'x';
        sceneState.blockPosition.x += 1.5;
      } else {
        sceneState.blockPosition.x += 1.0;
      }
    };

    const moveRight = () => {
      if (!sceneState.animating) {
        sceneState.animating = true;
        moveGizmoToXMax();
        rotationZ.setKeys([
          {frame: 0, value: 0},
          {frame: 30, value: -Math.PI / 2}
        ]);
        gizmo.animations.push(rotationZ);
        scene.beginAnimation(gizmo, 0, 30, false, 1, () => {
          sceneState.animating = false;
          gizmo.animations.pop();
          moveRightComplete();
          resetTransformations();
          checkBlock();
        })
      }
    };

    const moveGizmoToYMin = () => {
      if (sceneState.blockOrientation === 'z') {
        gizmo.position.z -= 1.0;
        blockMesh.position.z = 1.0;
      } else {
        gizmo.position.z -= 0.5;
        blockMesh.position.z = 0.5;
      }
    };

    const moveDownComplete = () => {
      if (sceneState.blockOrientation === 'y') {
        sceneState.blockOrientation = 'z';
        sceneState.blockPosition.y -= 1.5;
      } else if (sceneState.blockOrientation === 'z') {
        sceneState.blockOrientation = 'y';
        sceneState.blockPosition.y -= 1.5;
      } else {
        sceneState.blockPosition.y -= 1.0;
      }
    }

    const moveDown = () => {
      if (!sceneState.animating) {
        sceneState.animating = true;
        moveGizmoToYMin();
        rotationX.setKeys([
          {frame: 0, value: 0},
          {frame: 30, value: -Math.PI / 2}
        ]);
        gizmo.animations.push(rotationX);
        scene.beginAnimation(gizmo, 0, 30, false, 1, () => {
          sceneState.animating = false;
          gizmo.animations.pop();
          moveDownComplete();
          resetTransformations();
          checkBlock();
        });
      }
    }

    const moveGizmoToYMax = () => {
      if (sceneState.blockOrientation === 'z') {
        gizmo.position.z += 1.0;
        blockMesh.position.z = -1.0;
      } else {
        gizmo.position.z += 0.5;
        blockMesh.position.z = -0.5;
      }
    };

    const moveUpComplete = () => {
      if (sceneState.blockOrientation === 'y') {
        sceneState.blockOrientation = 'z';
        sceneState.blockPosition.y += 1.5;
      } else if (sceneState.blockOrientation === 'z') {
        sceneState.blockOrientation = 'y';
        sceneState.blockPosition.y += 1.5;
      } else {
        sceneState.blockPosition.y += 1.0;
      }
    };

    const moveUp = () => {
      if (!sceneState.animating) {
        sceneState.animating = true;
        moveGizmoToYMax();
        rotationX.setKeys([
          {frame: 0, value: 0},
          {frame: 30, value: Math.PI / 2}
        ]);
        gizmo.animations.push(rotationX);
        scene.beginAnimation(gizmo, 0, 30, false, 1, () => {
          sceneState.animating = false;
          gizmo.animations.pop();
          moveUpComplete();
          resetTransformations();
          checkBlock();
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

    // TODO: Check whether initial position should result in an explosion

    return scene;
  };

  const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true
  });

  const scene = createScene(engine, level);

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
