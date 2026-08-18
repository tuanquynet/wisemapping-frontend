# WiseMapping Frond End

WiseMapping Front End constitutes an integral component of the MindMap Open Source Project, which commenced its journey in 2010. However, until 2021, substantial architectural updates were sparse. In 2021, a pivotal initiative was undertaken to instigate significant transformations, aimed at revitalizing both the visual aesthetics and underlying technological framework of the project.

Within this repository, WiseMapping Front End encapsulates all user interface-related elements, comprising three principal modules:

- Web2D: A lightweight abstraction layer over SVG, facilitating chart rendering with elegance and efficiency.
- Mindplot: Comprising pure vanilla ES6 classes, this module assumes responsibility for rendering mind maps and facilitating seamless editing functionalities.
- Editor: REACT component wrapper on mindplot
- Webapp: A REACT application that serves as the cornerstone of the entire mind map editing experience, orchestrating a fluid and intuitive user interaction paradigm.

For those interested in delving deeper into the implementation details, the corresponding backend repository can be accessed at https://github.com/wisemapping/wisemapping-open-source.

## Getting started

Make sure you have NodeJs installed (version compatible with `package.json` engine), and yarn installed (`npm i -g yarn`).

```sh
nvm use   # NOTE: .nvmrc is stale at v16 — use Node >=24 per package.json engines
yarn install
```

Please refer to each package's Readme.md for anything specific to the package.

If you want to contribute, please check out [CONTRIBUTING.md](./CONTRIBUTING.md).

## Useful scripts

Each package might provide the following scripts. You can run these for all packages by running it from the root folder. Alternatively you can run it for a specific package by passing the `--scope` option.

### build

> Production builds

`yarn build`

## playground

> start a devServer with some browsable examples

`yarn workspace @wisemapping/editor playground`

web2d and mindplot have no `playground` script; use Storybook instead: `yarn workspace @wisemapping/web2d storybook` / `yarn workspace @wisemapping/mindplot storybook`

## test

> run all the tests

`yarn test`

> run only integration tests

`yarn test:integration`

> run only unit tests

`yarn test:unit`

**Note:** Integration tests use fixed ports per package (see `CLAUDE.md`'s Common commands section).

## Image Snapshot Testing

We use [cypress-image-snapshot](https://www.npmjs.com/package/cypress-image-snapshot) for snapshot testing. This is a relatively cheap way of identifying behavior changes based on page screenshots. See [visual testing docs](https://docs.cypress.io/guides/tooling/visual-testing) for more information.

When a test that contains a `matchImageSnapshot` call is run, it compares the snapshot to the corresponding one in the `snapshots` directory. If Any change is detected, the test will fail, and the diff can be found in the `cypress/snapshots/*/__diff_output__` folder. If the change is intentional, we should "accept" those changes by updating the snapshot and include it in the commit.

There is a [caveat](https://github.com/jaredpalmer/cypress-image-snapshot/issues/98) where colors, fonts or ui may differ depending on the host machine running the tests.

`cypress-image-snapshot` is host-sensitive (fonts/AA differ between machines) — expect diffs when running locally on a different OS than CI runs on. Commit updated PNGs alongside the code change when a diff is intentional.

# Members

## Founder

- Paulo Veiga <pveiga@wisemapping.com>

## Past Individual Contributors

- Ezequiel Bergamaschi <ezequielbergamaschi@gmail.com>

## License

The source code is Licensed under the WiseMapping Open License, Version 1.0 (the “License”);
You may obtain a copy of the License at: [https://github.com/wisemapping/wisemapping-open-source/blob/develop/LICENSE.md](https://github.com/wisemapping/wisemapping-open-source/blob/develop/LICENSE.md)
