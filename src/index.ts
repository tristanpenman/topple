import * as BABYLON from 'babylonjs';
import { cloneDeep } from 'lodash';
import field from './shaders/field';

type Axis = 'x' | 'y' | 'z';

type Tile = 0 | 1 | 2;

type Grid = Tile[][];

type Mode = 'loading' | 'playing' | 'exploded' | 'finished';

interface Level {
  initialOrientation: Axis;
  initialTile: BABYLON.Vector2;
  grid: Grid;
}

interface SceneState {
  animating: boolean;
  blockOrientation: Axis;
  blockTile: BABYLON.Vector2;
  grid: Grid;
  mode: Mode;
  tileMeshes: BABYLON.AbstractMesh[];
  time: number;
}

interface Extents {
  depth: number;
  width: number;
}

const level: Level = {
  initialOrientation: 'y',
  initialTile: new BABYLON.Vector2(2, 3),
  grid: [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 0, 0, 0],
    [0, 1, 1, 1, 2, 1, 0],
    [0, 0, 0, 0, 0, 0, 0]
  ]
};

BABYLON.Effect.ShadersStore['fieldVertexShader'] = field.vs;
BABYLON.Effect.ShadersStore['fieldFragmentShader'] = field.fs;

const onContentLoaded = () => {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const fpsLabel = document.getElementById('fpsLabel');

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

  const findExtents = (grid: Grid): Extents => {
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

  const calculateBlockPosition = (tile: BABYLON.Vector2, orientation: Axis, extents: Extents) => {
    const blockPosition = new BABYLON.Vector2(
      Math.round(tile.x) - extents.width / 2 + 0.5,
      extents.depth / 2 - Math.round(tile.y) - 0.5
    );

    // Adjust position depending on orientation of the block
    if (orientation === 'x') {
      blockPosition.x += 0.5;
    } else if (orientation === 'z') {
      blockPosition.y -= 0.5;
    }

    return blockPosition;
  }

  const createScene = function(engine: BABYLON.Engine, level: Level) {
    const sceneState: SceneState = {
      animating: false,
      blockOrientation: level.initialOrientation,
      blockTile: level.initialTile.clone(),
      grid: cloneDeep(level.grid),
      mode: 'loading',
      tileMeshes: [],
      time: 0
    };

    // Calculate position of block based on effective size of the grid, adopting the convention
    // that tile (0, 0) is the furthest and left-most tile on the player's screen
    const extents = findExtents(level.grid);

    // Create scene and configure environment
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP;
    scene.fogColor = new BABYLON.Color3();

    // Set up physics
    const gravityVector = new BABYLON.Vector3(0, -9.81, 0);
    const physicsPlugin = new BABYLON.CannonJSPlugin();
    scene.enablePhysics(gravityVector, physicsPlugin);

    // Create custom shader material for electric field
    const fieldTexture = new BABYLON.Texture('assets/field.jpg', scene);
    const fieldMaterial = new BABYLON.ShaderMaterial('fieldMaterial', scene, {
      vertex: 'field',
      fragment: 'field',
    }, {
      attributes: ['position', 'normal', 'uv', 'uSpeed', 'vSpeed', 'uScale', 'vScale'],
      uniforms: ['world', 'worldView', 'worldViewProjection', 'view', 'projection', 'time', 'vFogInfos', 'vFogColor']
    });

    fieldMaterial.needAlphaBlending = () => true;
    fieldMaterial.onBind = function(mesh: BABYLON.AbstractMesh) {
      const effect = fieldMaterial.getEffect();
      effect.setMatrix('view', scene.getViewMatrix());
      effect.setFloat4('vFogInfos', scene.fogMode, scene.fogStart, scene.fogEnd, scene.fogDensity);
      effect.setColor3('vFogColor', scene.fogColor);
    };

    fieldMaterial.setFloat('time', 0);
    fieldMaterial.setFloat('uSpeed', 0.02);
    fieldMaterial.setFloat('uScale', 50);
    fieldMaterial.setFloat('vSpeed', 0.02);
    fieldMaterial.setFloat('vScale', 50);
    fieldMaterial.setTexture('textureSampler', fieldTexture);

    // Create a simple camera, looking over the scene
    const camera = new BABYLON.ArcRotateCamera('camera', -Math.PI / 1.5, Math.PI / 4, 10, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, false);
    camera.inputs.remove(camera.inputs.attached.keyboard);

    // Create a basic light, aiming 0, 1, 0 - meaning, to the sky
    const ambientLight = new BABYLON.HemisphericLight('ambientLight', new BABYLON.Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.5;

    // Non-specular material for tiles
    const metalTexture = new BABYLON.Texture('assets/metal.jpg', scene);
    const metalMaterial = new BABYLON.StandardMaterial('metalMaterial', scene);
    metalMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
    metalMaterial.diffuseTexture = metalTexture;
    metalMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    metalMaterial.fogEnabled = false;

    const targetTexture = new BABYLON.Texture('assets/target.jpg', scene);
    const targetMaterial = new BABYLON.StandardMaterial('targetMaterial', scene);
    targetMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
    targetMaterial.diffuseTexture = targetTexture;
    targetMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    targetMaterial.fogEnabled = false;

    // Colored material for block
    const blockMaterial = new BABYLON.StandardMaterial('blockMaterial', scene);
    blockMaterial.diffuseTexture = new BABYLON.Texture('assets/block.jpg', scene);
    blockMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
    blockMaterial.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    blockMaterial.fogEnabled = false;

    // Create mesh for force field
    const fieldMesh = BABYLON.Mesh.CreateGround('fieldMesh', 100, 100, 0, scene);
    fieldMesh.material = fieldMaterial;
    fieldMesh.position.y = -0.01;

    // Rotation gizmo
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

    // Define an animation for rotation about the X axis
    const rotationX = new BABYLON.Animation('rotationX', 'rotation.x', 120,
      BABYLON.Animation.ANIMATIONTYPE_FLOAT,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    // Define an animation for rotation about the Z axis
    const rotationZ = new BABYLON.Animation('rotationZ', 'rotation.z', 120,
      BABYLON.Animation.ANIMATIONTYPE_FLOAT,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    // Create a mesh that will act as the parent for all of the individual pieces
    const piecesMesh = BABYLON.Mesh.CreateSphere('piecesMesh', 6, 0.1, scene);
    piecesMesh.parent = gizmo;
    piecesMesh.position.y += 0.5;
    piecesMesh.visibility = 0;
    piecesMesh.setEnabled(false);

    const pieces: BABYLON.AbstractMesh[] = [];

    // Create the first piece
    const piecesPerUnit = 2;

    // Use shadow generator to cast shadows from block/piece meshes on to tiles
    const shadowGenerator = new BABYLON.ShadowGenerator(1024, pointLight1);
    shadowGenerator.forceBackFacesOnly = true;

    // Point light for the lighting the block and piece meshes
    const pointLight2 = new BABYLON.PointLight('pointLight2', new BABYLON.Vector3(-3, 2, -1), scene);
    pointLight2.intensity = 0.4;

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
      sceneState.mode = 'exploded';

      // Swap solid block for individual pieces
      piecesMesh.setEnabled(true);
      blockMesh.setEnabled(false);

      pieces.forEach((piece, index) => {
        if (index === 0) {
          // Create a physics object for the first piece, ignoring the position of it's parent
          piece.physicsImpostor = new BABYLON.PhysicsImpostor(piece, BABYLON.PhysicsImpostor.BoxImpostor, {
            mass: 1,
            friction: 0.4,
            restitution: 0.5,
            ignoreParent: true
          }, scene);
        } else {
          // Clone that physics imposter for the remaining pieces
          piece.physicsImpostor = pieces[0].physicsImpostor.clone(piece);
        }
      });

      // Explosion characteristics
      const alpha = 6;
      const beta = sceneState.blockOrientation === 'y' ? 8 : 4;
      const delta = -0.5;
      const scaleBase = 5;
      const scaleVariability = 3;

      // Apply an explosive impulse each piece
      pieces.forEach(piece => {
        explode(piece, alpha, beta, delta, scaleBase + scaleVariability * Math.random());
      });

      // TODO: Animate transparency
    };

    const resetTransformations = () => {
      const blockPosition = calculateBlockPosition(sceneState.blockTile, sceneState.blockOrientation, extents);
      gizmo.position = new BABYLON.Vector3(blockPosition.x, 0.0, blockPosition.y);
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

    const resetPieces = () => {
      piecesMesh.setEnabled(false);

      while (pieces.length > 0) {
        pieces.pop().dispose();
      }

      const piece = BABYLON.Mesh.CreateBox(`piece`, 1.0 / piecesPerUnit, scene);
      piece.parent = piecesMesh;
      piece.material = blockMaterial;
      piece.position.x = -0.75;
      piece.position.y = -0.25;
      piece.position.z = -0.25;
      pieces.push(piece);

      for (var x = 0; x < piecesPerUnit * 2; x++) {
        for (var y = 0; y < piecesPerUnit; y++) {
          for (var z = 0; z < piecesPerUnit; z++) {
            if (x > 0 || y > 0 || z > 0) {
              const pieceInstance = piece.createInstance(`pieceInstance[x=${x},y=${y},z=${z}]`);
              pieceInstance.parent = piecesMesh;
              pieceInstance.position.x = (x - piecesPerUnit) / piecesPerUnit + 0.25;
              pieceInstance.position.y = y / piecesPerUnit - 0.25;
              pieceInstance.position.z = (z - piecesPerUnit) / piecesPerUnit + 0.75;
              pieces.push(pieceInstance);
            }
          }
        }
      }

      pointLight2.includedOnlyMeshes = [...pieces, blockMesh];

      shadowGenerator.getShadowMap().renderList = [...pieces, blockMesh];
    }

    const resetLevel = () => {
      pointLight1.includedOnlyMeshes = [];
      while(sceneState.tileMeshes.length > 0) {
        sceneState.tileMeshes.pop().dispose();
      }

      const greyShape = {width: 1, depth: 1, height: 0.3};
      level.grid.forEach((row, rowIndex) => {
        row.forEach((cell, cellIndex) => {
          const name = `tile[row=${rowIndex},col=${cellIndex}`;
          if (cell === 1) {
            const tileMesh = BABYLON.MeshBuilder.CreateBox(name, greyShape, scene);
            tileMesh.receiveShadows = true;
            tileMesh.position.x = cellIndex - extents.width / 2 + 0.5;
            tileMesh.position.z = extents.depth / 2 - rowIndex - 0.5;
            tileMesh.position.y = -0.15;
            tileMesh.material = metalMaterial;
            sceneState.tileMeshes.push(tileMesh);
          } else if (cell === 2) {
            const tileMesh = BABYLON.MeshBuilder.CreateBox(name, greyShape, scene);
            tileMesh.receiveShadows = true;
            tileMesh.position.x = cellIndex - extents.width / 2 + 0.5;
            tileMesh.position.z = extents.depth / 2 - rowIndex - 0.5;
            tileMesh.position.y = -0.15;
            tileMesh.material = targetMaterial;
            sceneState.tileMeshes.push(tileMesh);
          }
        });
      });

      pointLight1.includedOnlyMeshes = sceneState.tileMeshes;

      // Create static physics objects for each of the tiles (saves time later)
      sceneState.tileMeshes.forEach(tileMesh => {
        tileMesh.physicsImpostor = new BABYLON.PhysicsImpostor(tileMesh, BABYLON.PhysicsImpostor.BoxImpostor, {
          mass: 0
        }, scene);
      });

      sceneState.blockOrientation = level.initialOrientation;
      sceneState.blockTile = level.initialTile.clone();
      sceneState.mode = 'playing';

      // Re-activate the force field
      fieldMesh.material = fieldMaterial;

      resetTransformations();
      resetPieces();

      blockMesh.setEnabled(true);
    };

    const isExplosiveTile = (blockTile: BABYLON.Vector2, grid: Grid) =>
      blockTile.y > grid.length - 1 ||
      blockTile.y < 0 ||
      blockTile.x > grid[blockTile.y].length - 1 ||
      blockTile.x < 0 ||
      grid[blockTile.y][blockTile.x] === 0;

    const checkBlock = () => {
      const didWin =
        sceneState.blockOrientation === 'y' &&
        sceneState.blockTile.y < sceneState.grid.length - 1 &&
        sceneState.blockTile.x < sceneState.grid[sceneState.blockTile.y].length - 1 &&
        sceneState.grid[sceneState.blockTile.y][sceneState.blockTile.x] === 2;
      if (didWin) {
        sceneState.mode = 'finished';
        fieldMesh.material = null;
        setTimeout(() => {
          resetLevel();
        }, 1000);
      }

      const shouldExplode =
        isExplosiveTile(sceneState.blockTile, sceneState.grid) ||
        (sceneState.blockOrientation === 'x' && isExplosiveTile(sceneState.blockTile.add(new BABYLON.Vector2(1, 0)), sceneState.grid)) ||
        (sceneState.blockOrientation === 'z' && isExplosiveTile(sceneState.blockTile.add(new BABYLON.Vector2(0, 1)), sceneState.grid));
      if (shouldExplode) {
        explodeBlock();
        setTimeout(() => {
          resetLevel();
        }, 3000);
      }
    }

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
        sceneState.blockTile.x -= 1;
      } else if (sceneState.blockOrientation === 'y') {
        sceneState.blockOrientation = 'x';
        sceneState.blockTile.x -= 2;
      } else {
        sceneState.blockTile.x -= 1;
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
        sceneState.blockTile.x += 2;
      } else if (sceneState.blockOrientation === 'y') {
        sceneState.blockOrientation = 'x';
        sceneState.blockTile.x += 1;
      } else {
        sceneState.blockTile.x += 1;
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
        sceneState.blockTile.y += 1;
      } else if (sceneState.blockOrientation === 'z') {
        sceneState.blockOrientation = 'y';
        sceneState.blockTile.y += 2;
      } else {
        sceneState.blockTile.y += 1;
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
        sceneState.blockTile.y -= 2;
      } else if (sceneState.blockOrientation === 'z') {
        sceneState.blockOrientation = 'y';
        sceneState.blockTile.y -= 1;
      } else {
        sceneState.blockTile.y -= 1;
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
      if (sceneState.mode !== 'playing') {
        return;
      }

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

    resetLevel();
    checkBlock();

    scene.registerBeforeRender(function () {
      sceneState.time += 0.1;
      fieldMaterial.setFloat('time', sceneState.time);
    });

    return scene;
  };

  const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true
  });

  const scene = createScene(engine, level);

  // Update FPS counter once per second
  setInterval(() => {
    fpsLabel.innerHTML = engine.getFps().toFixed() + ' fps';
  }, 1000);

  engine.runRenderLoop(() => {
    scene.render();
  });

  window.addEventListener('resize', resize);
  resize();
};

document.addEventListener('DOMContentLoaded', onContentLoaded);
