Thanks for your interest in contributing to wisemapping!

Hopefully this document will be improved over time and get to be a [complete CONTRIBUTING document](https://mozillascience.github.io/working-open-workshop/contributing/).

# Sending a Pull Request

1. Create a new branch from `develop`. Convention for branch names is `feature/*` or `bugfix/*`. Eg. `feature/add-contributing-docs`.
2. Make your changes and test them.
3. Run quality checks:
   - `yarn build`
   - `yarn lint`
   - `yarn test`
4. Push your changes and run `yarn build && yarn lint && yarn test` locally — there is no CI pipeline; the Husky pre-push hook is the only automated check.
   - If a snapshot test fails, check the diff in `cypress/snapshots/*/__diff_output__`.
   - If the change is intentional, update the snapshot and commit the new image (see [README.md](./README.md#Image-Snapshot-Testing)).
5. Create the pull request
