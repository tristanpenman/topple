# Block Puzzle

This is a project to create a block puzzle game, in the style of [Bloxorz](), using the [BabylonJS]() 3D engine.

All game code has been written in TypeScript.

## Usage

If you use yarn, getting up and running should be as simple as `yarn`.

You can then start the dev server using `yarn start`.

## State

The block can be in one of three orientations, easily denoted as one of three axis, X, Y, or Z.

We follow the convention that, after each move, the block's position is the center of the face that is currently on the ground plane. This applies for both long and short sides, and must be taken into account when checking whether a block has moved into an invalid position.

## License

This code is licensed under the ISC License.

See the LICENSE file for more information.
