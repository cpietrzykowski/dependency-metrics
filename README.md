# DEPENDENCY METRICS

> this is _not_ a quality assessment tool

Have you ever been curious about the meta-health of your dependencies?

* age of repository
* vague popularity metrics (stars)

## Known Issues

* there are better npm dependency tools (deep analysis, etc.)
* not all npm packages expose/lead to a github based repository (this is required for some metrics)
* master is used for commit vitals
* a lot of assumptions used in determining certain metrics
* uses GitHub REST API v3 (set GITHUB_ACCESSTOKEN if you get locked out)

# TODO

* deep vitals
* use lock files
* integrate [node-semver](https://github.com/npm/node-semver)
* implement as local web app (the npm registry does not have CORS enabled)
